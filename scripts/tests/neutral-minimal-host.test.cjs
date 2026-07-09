#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const MODULE_PATH = path.join(REPO_ROOT, "src/core/neutral-minimal-host.cjs");
const { validateHostAdapterContract } = require(path.join(REPO_ROOT, "src/core/host-adapter-contract.cjs"));
const { createEditorCore } = require(path.join(REPO_ROOT, "src/core/editor-core.cjs"));
const { createEditorChangeDraftViewModel } = require(path.join(
  REPO_ROOT,
  "src/core/editor-ui-change-draft-view-model.cjs"
));

const {
  createNeutralMinimalHost,
  createNeutralMinimalRegistry,
  createNeutralMinimalChangeRequest,
  runNeutralMinimalHostFlow,
  getNeutralMinimalHostElementIds,
  getNeutralMinimalHostAllowedOperations,
} = require(MODULE_PATH);

function assertNoForbiddenFragments(text, label) {
  const forbiddenFragments = [
    "node:fs",
    "node:path",
    "writeFile",
    "readFile",
    "mkdir",
    "sqlite",
    "postgres",
    "mysql",
    "fetch(",
    "http",
    "document.",
    "window.",
    "querySelector",
    "createElement",
    "innerHTML",
    ["Bro", "wser"].join(""),
    ["HT", "ML"].join(""),
    ["D", "OM"].join(""),
    ["Mini", "-Inspector"].join(""),
    ["Host", "-App-Demo"].join(""),
    ["Layout", "diagnose"].join(""),
    ["data", "-ui"].join(""),
    ["De", "mo"].join(""),
    ["B", "BM"].join(""),
    ["Proto", "koll"].join(""),
    ["Rest", "arbeiten"].join(""),
    ["T", "OP"].join(""),
    ["Bau", "vorhaben"].join(""),
  ];

  forbiddenFragments.forEach((fragment) => {
    assert.equal(text.includes(fragment), false, `${label} enthaelt verbotenen Fragmenttext: ${fragment}`);
  });
}

function assertNeutralElement(element) {
  assert.equal(element.id.startsWith("workspace."), true);
  assert.equal(["Workspace Root", "Workspace Header", "Workspace Content", "Workspace Sidebar"].includes(element.name), true);
  assert.equal(["root", "area"].includes(element.type), true);
  assert.equal(element.role, "layout");
  assert.equal(typeof element.visible, "boolean");
  assert.equal(typeof element.editable, "boolean");
  assert.equal(Array.isArray(element.allowedOps), true);
  assert.equal(Array.isArray(element.lockedOps), true);
  element.allowedOps.concat(element.lockedOps).forEach((operation) => {
    assert.equal(["inspect", "move", "resize", "hide", "reset"].includes(operation), true);
  });
}

function createLockedChangeRequest() {
  return createNeutralMinimalChangeRequest({
    changeId: "neutral-minimal-change-locked",
    elementId: "workspace.header",
    operation: "hide",
    payload: { width: 320 },
  });
}

function createUnknownElementChangeRequest() {
  return createNeutralMinimalChangeRequest({
    changeId: "neutral-minimal-change-unknown",
    elementId: "workspace.unknown",
    operation: "inspect",
    payload: { width: 320 },
  });
}

function run() {
  assert.equal(typeof createNeutralMinimalHost, "function");
  assert.equal(typeof createNeutralMinimalRegistry, "function");
  assert.equal(typeof createNeutralMinimalChangeRequest, "function");
  assert.equal(typeof runNeutralMinimalHostFlow, "function");
  assert.equal(typeof getNeutralMinimalHostElementIds, "function");
  assert.equal(typeof getNeutralMinimalHostAllowedOperations, "function");

  const elementIds = getNeutralMinimalHostElementIds();
  assert.deepEqual(elementIds, ["workspace.root", "workspace.header", "workspace.content", "workspace.sidebar"]);
  elementIds.push("workspace.mutated");
  assert.deepEqual(getNeutralMinimalHostElementIds(), [
    "workspace.root",
    "workspace.header",
    "workspace.content",
    "workspace.sidebar",
  ]);

  const operations = getNeutralMinimalHostAllowedOperations();
  assert.deepEqual(operations["workspace.content"].allowedOps, ["inspect", "move", "resize"]);
  assert.deepEqual(operations["workspace.header"].lockedOps, ["move", "hide", "reset"]);
  operations["workspace.content"].allowedOps.push("mutated");
  operations["workspace.header"].lockedOps.push("mutated");
  const freshOperations = getNeutralMinimalHostAllowedOperations();
  assert.deepEqual(freshOperations["workspace.content"].allowedOps, ["inspect", "move", "resize"]);
  assert.deepEqual(freshOperations["workspace.header"].lockedOps, ["move", "hide", "reset"]);

  const registry = createNeutralMinimalRegistry();
  assert.equal(registry.size(), 4);
  assert.deepEqual(
    registry.listElements().map((element) => element.id),
    ["workspace.root", "workspace.header", "workspace.content", "workspace.sidebar"]
  );
  registry.listElements().forEach(assertNeutralElement);

  const host = createNeutralMinimalHost();
  assert.equal(host.ok, true);
  assert.deepEqual(host.errors, []);
  assert.equal(host.targetAppId, "neutral-minimal-host");
  assert.equal(typeof host.registry.getElementById, "function");
  assert.equal(typeof host.hostAdapter.getRegistry, "function");
  assert.deepEqual(validateHostAdapterContract(host.hostAdapter), { ok: true, errors: [] });
  assert.equal(host.bootstrap.ok, true);
  assert.equal(typeof host.bootstrap.editorCore, "object");
  assert.equal(typeof host.bootstrap.treeViewModel, "object");
  assert.equal(host.bootstrap.treeViewModel.root.id, "workspace.root");
  assert.equal(host.capabilities.hasRegistry, true);
  assert.equal(host.capabilities.hasHostAdapter, true);
  assert.equal(host.capabilities.hasBootstrap, true);
  assert.equal(host.capabilities.hasEditorCore, true);
  assert.equal(host.capabilities.hasTreeViewModel, true);
  assert.equal(host.capabilities.executed, false);
  assert.equal(host.capabilities.storesLayout, false);
  assert.equal(host.capabilities.connectsExternalTarget, false);
  assert.deepEqual(host.hostAdapter.listSubmittedChangeRequests(), []);

  const allowedChangeRequest = createNeutralMinimalChangeRequest();
  assert.deepEqual(allowedChangeRequest, {
    changeId: "neutral-minimal-change-001",
    elementId: "workspace.content",
    operation: "resize",
    payload: { width: 320 },
    createdAt: "2026-06-01T00:00:00.000Z",
    source: "neutral-minimal-host",
    note: "neutral-minimal-check",
  });
  const editorCore = createEditorCore(createNeutralMinimalRegistry());
  const allowedDraft = createEditorChangeDraftViewModel(editorCore, allowedChangeRequest);
  assert.equal(allowedDraft.canSubmit, true);
  assert.equal(allowedDraft.validation.ok, true);

  const flowResult = runNeutralMinimalHostFlow();
  assert.equal(flowResult.ok, true);
  assert.deepEqual(flowResult.errors, []);
  assert.equal(flowResult.executed, false);
  assert.equal(flowResult.flow.ok, true);
  assert.equal(flowResult.flow.submitResult.executed, false);
  assert.equal(flowResult.flow.submitResult.accepted, true);
  assert.equal(flowResult.submittedChangeRequests.length, 1);
  assert.deepEqual(flowResult.submittedChangeRequests[0], allowedChangeRequest);
  assert.equal(flowResult.capabilities.didSubmitToTestHost, true);
  assert.equal(flowResult.capabilities.executed, false);
  assert.equal(flowResult.capabilities.storesLayout, false);
  assert.equal(flowResult.capabilities.connectsExternalTarget, false);
  assert.deepEqual(flowResult.flow.bootstrap.layoutState, {});

  const lockedFlowResult = runNeutralMinimalHostFlow({ changeRequest: createLockedChangeRequest() });
  assert.equal(lockedFlowResult.ok, false);
  assert.equal(lockedFlowResult.executed, false);
  assert.equal(lockedFlowResult.submittedChangeRequests.length, 0);
  assert.equal(lockedFlowResult.flow.changeDraftViewModel.canSubmit, false);
  assert.equal(
    lockedFlowResult.flow.changeDraftViewModel.validation.errors.some((error) => error.code === "operation_locked"),
    true
  );

  const unknownElementFlowResult = runNeutralMinimalHostFlow({ changeRequest: createUnknownElementChangeRequest() });
  assert.equal(unknownElementFlowResult.ok, false);
  assert.equal(unknownElementFlowResult.executed, false);
  assert.equal(unknownElementFlowResult.submittedChangeRequests.length, 0);
  assert.equal(unknownElementFlowResult.flow.changeDraftViewModel.canSubmit, false);
  assert.equal(
    unknownElementFlowResult.flow.changeDraftViewModel.validation.errors.some((error) => error.code === "unknown_element"),
    true
  );

  const coreText = fs.readFileSync(MODULE_PATH, "utf8");
  assertNoForbiddenFragments(coreText, "neutral-minimal-host");
  assert.equal(coreText.includes("createWriteStream"), false);
  assert.equal(coreText.includes("localStorage"), false);
  assert.equal(coreText.includes("sessionStorage"), false);
  assert.equal(coreText.includes("indexedDB"), false);
  assert.equal(coreText.includes("addEventListener"), false);
  assert.equal(coreText.includes("XMLHttpRequest"), false);
  assert.equal(coreText.includes("WebSocket"), false);

  console.log("TESTS OK: neutral-minimal-host");
}

run();
