#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const {
  ELECTRON_EDITOR_ERROR_CODES,
  ELECTRON_TARGET_OPERATIONS,
  LOCAL_TARGET_MAX_MESSAGE_BYTES,
  LOCAL_TARGET_PROTOCOL_VERSION,
  NamedPipeTargetClient,
  createElectronTargetContract,
  createEnvelope,
  createFrameDecoder,
  createSessionIdentifiers,
  encodeFrame,
  validateElectronRegistryScopes,
  validateElectronTargetContract,
  validateEnvelope,
  windowsPipePath,
} = require("../../src/index.cjs");
const { createUiElementRegistry } = require("../../src/core/ui-element-registry.cjs");
const { createUiEditorRuntime } = require("../../src/runtime/step-validating-ui-editor-runtime.cjs");
const { validateChangeRequest } = require("../../src/core/change-request-validator.cjs");
const { createMemoryLayoutStateStore } = require("../../src/core/layout-state-store.cjs");

const root = path.resolve(__dirname, "../..");
const identifiers = createSessionIdentifiers();

function elements() {
  return [
    { id: "pilot.root", name: "Pilot", type: "root", role: "scopeRoot", parentId: null, order: 0, visible: true, editable: true, allowedOps: ["setVisibility"], lockedOps: [] },
    { id: "pilot.fields", name: "Felder", type: "fieldGroup", role: "formFieldGroup", parentId: "pilot.root", order: 1, visible: true, editable: true, allowedOps: ["setVisibility"], lockedOps: [] },
    { id: "pilot.label", name: "Bezeichnung", type: "label", role: "fieldLabel", parentId: "pilot.fields", order: 2, visible: true, editable: true, allowedOps: ["setVisibility"], lockedOps: [] },
    { id: "pilot.field", name: "Feld", type: "field", role: "dataFieldLayout", parentId: "pilot.fields", order: 3, visible: true, editable: true, allowedOps: ["setVisibility"], lockedOps: [], fieldKind: "text" },
    { id: "pilot.action", name: "Fachaktion", type: "button", role: "domainActionLayout", parentId: "pilot.root", order: 4, visible: true, editable: true, allowedOps: ["move", "setVisibility"], lockedOps: ["executeTargetAction", "modifyDomainData", "createRecord", "deleteRecord"], actionKind: "domain" },
  ];
}

function context() { return { targetAppId: "electron-test", moduleId: "pilot", scopeId: "pilot.root", layoutProfileId: "default" }; }
function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function host(initialVisible = true) {
  const values = new Map([["pilot.label", { elementId: "pilot.label", visible: initialVisible }]]);
  let failNext = false;
  return {
    fail() { failNext = true; },
    validateElementRef: () => ({ ok: true }),
    captureElementLayoutState: (id) => clone(values.get(id)),
    restoreElementLayoutState(id, value) { values.set(id, clone(value)); return { ok: true }; },
    getCurrentLayoutEntry: (id) => clone(values.get(id)),
    applyLayoutEntry(id, value) { if (failNext) { failNext = false; return { ok: false }; } values.set(id, clone(value)); return { ok: true }; },
    clearElementLayout(id) { values.delete(id); return { ok: true }; },
    visible: () => values.get("pilot.label")?.visible,
  };
}
function registry() {
  const value = createUiElementRegistry();
  value.registerElement({ id: "pilot.label", name: "Bezeichnung", type: "label", role: "fieldLabel", parentId: null, order: 1, visible: true, editable: true, allowedOps: ["setVisibility"], lockedOps: [] });
  return value;
}
function storage() {
  let entries = [];
  return {
    available: true,
    persistent: true,
    readResult: () => ({ ok: true, entries: clone(entries) }),
    write(_context, next) { entries = clone(next); return { ok: true }; },
    clear() { entries = []; return { ok: true }; },
    deleteEntry(_context, id) { entries = entries.filter((entry) => entry.elementId !== id); return { ok: true }; },
  };
}
function change(visible, id = `visibility-${visible}`) {
  return { changeId: id, elementId: "pilot.label", operation: "setVisibility", payload: { visible }, createdAt: new Date().toISOString(), source: "m80-test" };
}

async function pipeServer({ identifiers: ids, ignoreRequests = false }) {
  let disconnectReason = null;
  const server = net.createServer((socket) => {
    socket.on("data", createFrameDecoder((message) => {
      if (message.messageType === "handshake") {
        socket.write(encodeFrame(createEnvelope({ messageType: "handshakeAccepted", sessionNonce: ids.sessionNonce, replyTo: message.messageId, payload: { action: "handshakeAccepted" } })));
      } else if (message.messageType === "request" && !ignoreRequests) {
        socket.write(encodeFrame(createEnvelope({ messageType: "response", sessionNonce: ids.sessionNonce, replyTo: message.messageId, payload: { action: `${message.payload.action}Accepted` } })));
      } else if (message.messageType === "disconnect") {
        disconnectReason = message.payload.reason;
      }
    }, (error) => socket.destroy(error)));
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(windowsPipePath(ids.pipeName), resolve); });
  return { server, disconnectReason: () => disconnectReason, close: () => new Promise((resolve) => server.close(resolve)) };
}

async function run() {
  const contract = createElectronTargetContract({
    applicationId: "electron-test", displayName: "Electron Test", appVersion: "1.0.0", registryVersion: 1,
    registryFingerprint: `sha256:${"a".repeat(64)}`, registryStatus: "complete",
    activeScopes: ["pilot.root"], profileRoot: "C:\\profiles\\electron-test",
    supportedOperations: ELECTRON_TARGET_OPERATIONS, transportProtocolVersion: LOCAL_TARGET_PROTOCOL_VERSION,
    sessionId: identifiers.sessionId, processId: process.pid,
  });
  assert.equal(validateElectronTargetContract(contract).ok, true, "Electron-Ziel-App-Vertrag valide");
  assert.equal(validateElectronTargetContract({ ...contract, transportProtocolVersion: "0" }).ok, false, "ungültige Protokollversion abgewiesen");
  assert.equal(validateElectronRegistryScopes([{ scopeId: "pilot.root", elements: elements() }], ["pilot.root"]).ok, true, "Label-/Feldstruktur valide");
  const invalidParents = elements().map((item) => item.id === "pilot.field" ? { ...item, parentId: "pilot.label" } : item);
  assert.equal(validateElectronRegistryScopes([{ scopeId: "pilot.root", elements: invalidParents }], ["pilot.root"]).ok, false, "Label ist kein Feld-Parent");

  const core = { hasElement: () => true, canElementPerformOperation: (_id, operation) => operation === "setVisibility", getElementDetails: () => ({ allowedOps: ["setVisibility"], lockedOps: [] }) };
  assert.equal(validateChangeRequest(change(false), core).ok, true, "Visibility-Operation valide und capability-gesteuert");
  assert.equal(validateChangeRequest(change(false), { ...core, canElementPerformOperation: () => false }).ok, false);
  assert.ok(elements().some((item) => item.id === "pilot.label" && item.visible), "Registrybaum enthält Element unabhängig vom Layoutzustand");

  const persisted = createMemoryLayoutStateStore();
  const layout = { schemaVersion: 1, targetAppId: "electron-test", uiScope: "pilot.root", layoutScope: "pilot.root", layoutProfileId: "default", version: 1, source: "saved", elements: { "pilot.label": { visible: false } } };
  assert.equal(persisted.saveLayoutState(layout).ok, true);
  assert.equal(persisted.loadLayoutState({ targetAppId: "electron-test", uiScope: "pilot.root", layoutScope: "pilot.root", layoutProfileId: "default" }).layoutState.elements["pilot.label"].visible, false, "Save/Load für Sichtbarkeit");

  const saved = storage();
  const firstHost = host(true);
  const runtime = createUiEditorRuntime({ registry: registry(), hostAdapter: firstHost, layoutStorage: saved, targetContext: context() });
  runtime.beginSession();
  const hidden = runtime.applyChange(change(false));
  assert.equal(hidden.ok, true, JSON.stringify(hidden));
  assert.equal(firstHost.visible(), false);
  assert.equal(runtime.discardElementChanges("pilot.root", "pilot.label").ok, true);
  assert.equal(firstHost.visible(), true, "Discard stellt Sichtbarkeit wieder her");
  runtime.applyChange(change(false, "save-false"));
  assert.equal(runtime.saveLayout().ok, true);
  runtime.applyChange(change(true, "after-save"));
  assert.equal(runtime.discardAllChanges().ok, true);
  assert.equal(firstHost.visible(), false, "Discard all nutzt gespeicherten Baselinezustand");
  assert.equal(runtime.resetLayoutToDefaults().ok, true);
  assert.equal(firstHost.visible(), undefined, "Reset entfernt gespeicherten Sichtbarkeitswert");
  runtime.beginSession();
  firstHost.fail();
  const failed = runtime.applyChange(change(false, "rollback"));
  assert.equal(failed.ok, false);
  assert.equal(firstHost.visible(), undefined, "Applyfehler rollt Sichtbarkeit zurück");

  const server = await pipeServer({ identifiers });
  const client = new NamedPipeTargetClient({ pipeName: identifiers.pipeName, sessionNonce: identifiers.sessionNonce, timeoutMs: 1_000 });
  await client.connect({ contract });
  assert.equal(client.connected, true, "Named-Pipe-Handshake");
  await client.request("probe", {}, "probeAccepted");
  await client.close("structured_test_disconnect");
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(server.disconnectReason(), "structured_test_disconnect", "strukturierter Disconnect");
  await server.close();

  assert.equal(validateEnvelope(createEnvelope({ messageType: "event", sessionNonce: identifiers.sessionNonce, payload: {} }), "wrong-nonce").code, ELECTRON_EDITOR_ERROR_CODES.SESSION_INVALID, "Nonce-Prüfung");
  assert.equal(validateEnvelope({ ...createEnvelope({ messageType: "request", sessionNonce: identifiers.sessionNonce, payload: { action: "getRegistry" } }), replyTo: null }, identifiers.sessionNonce).ok, true, "C#-Request ohne Korrelation");
  assert.throws(() => encodeFrame(createEnvelope({ messageType: "event", sessionNonce: identifiers.sessionNonce, payload: { value: "x".repeat(LOCAL_TARGET_MAX_MESSAGE_BYTES) } })), (error) => error.code === ELECTRON_EDITOR_ERROR_CODES.MESSAGE_TOO_LARGE, "Nachrichtengrößenlimit");
  const timeoutIds = createSessionIdentifiers();
  const timeoutServer = await pipeServer({ identifiers: timeoutIds, ignoreRequests: true });
  const timeoutClient = new NamedPipeTargetClient({ pipeName: timeoutIds.pipeName, sessionNonce: timeoutIds.sessionNonce, timeoutMs: 50 });
  await timeoutClient.connect({ contract });
  await assert.rejects(timeoutClient.request("never"), (error) => error.code === ELECTRON_EDITOR_ERROR_CODES.PIPE_TIMEOUT, "Timeout");
  await timeoutClient.close();
  await timeoutServer.close();

  const pipeSource = fs.readFileSync(path.join(root, "reference-target-app/src/ReferenceTargetApp.EditorIntegration/Electron/LocalTargetProtocol.cs"), "utf8");
  assert.match(pipeSource, /PipeOptions\.Asynchronous\s*\|\s*PipeOptions\.CurrentUserOnly/);
  assert.match(pipeSource, /NamedPipeServerStream\(pipeName, PipeDirection\.InOut, 1,/);
  const electronSource = fs.readdirSync(path.join(root, "src/electron-target"))
    .filter((name) => name.endsWith(".cjs"))
    .map((name) => fs.readFileSync(path.join(root, "src/electron-target", name), "utf8")).join("\n");
  assert.doesNotMatch(electronSource, /\bhttps?:|WebSocket|BrowserWindow|fetch\s*\(/i, "kein Browser-/Netzwerkcode");
  const editorSource = fs.readFileSync(path.join(root, "reference-target-app/src/ReferenceTargetApp.Wpf/UI/Editor/ElectronTargetEditor.cs"), "utf8");
  assert.match(editorSource, /CreatePdfHostAdapterAsync/, "M81 erweitert denselben nativen Editor um die Electron-PDF-Bruecke");
  assert.doesNotMatch(editorSource, /ReferenceOrderFactory/, "kein Referenz-PDF-Modell für BBM");
  console.log("TESTS OK: M80 Electron-Ziel-App, Sichtbarkeit und lokale Pipe");
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
