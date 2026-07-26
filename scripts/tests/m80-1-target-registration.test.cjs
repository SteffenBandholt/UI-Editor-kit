#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  ELECTRON_EDITOR_ERROR_CODES,
  assessExistingTargetRegistration,
  compareRegistrySnapshots,
  createRegistryFingerprint,
  createRegistryRefreshCoordinator,
  reconcileRegistryProfile,
  validateRegistrationSnapshot,
} = require("../../src/index.cjs");

const root = path.resolve(__dirname, "../..");
const OPS = ["resizeWidth", "setVisibility"];

function baseline(overrides = {}) {
  return { x: 0, y: 0, width: 400, height: 200, textOffsetX: 4, textOffsetY: 2, fontSize: 12, visible: true, ...overrides };
}

function element(id, type, parentId, role, overrides = {}) {
  const allowedOps = overrides.allowedOps || (type === "root" ? [] : OPS);
  return {
    id, name: overrides.name || id, type, role, parentId, order: overrides.order || 0,
    visible: true, editable: allowedOps.length > 0, allowedOps, lockedOps: overrides.lockedOps || [],
    semanticKey: overrides.semanticKey || id, registrationStatus: allowedOps.length > 0 ? "editorEnabled" : "editorContainer",
    refKey: overrides.refKey || `ref:${id}`, referenceResolved: overrides.referenceResolved !== false,
    baseline: baseline(overrides.baseline), ...overrides,
  };
}

function completeScope(scopeId = "app.scope", additions = []) {
  const elements = [
    element(scopeId, "root", null, "scopeRoot", { editable: false, allowedOps: [] }),
    element(`${scopeId}.area`, "area", scopeId, "contentArea"),
    element(`${scopeId}.group`, "fieldGroup", `${scopeId}.area`, "formFieldGroup"),
    element(`${scopeId}.label`, "label", `${scopeId}.group`, "fieldLabel"),
    element(`${scopeId}.field`, "field", `${scopeId}.group`, "dataFieldLayout", { fieldKind: "text" }),
    ...additions,
  ];
  return { scopeId, status: "complete", inventoryStatus: "complete", expectedElementIds: elements.map((entry) => entry.id), elements };
}

function snapshot({ version = 1, scopes = [completeScope()], status = "complete", contract = {} } = {}) {
  const registryFingerprint = createRegistryFingerprint(scopes);
  return {
    contract: {
      applicationId: "existing-app", displayName: "Existing App", appVersion: "3.2.1", framework: "electron",
      contractVersion: "1.1", adapterVersion: "1.1", registryVersion: version, registryFingerprint,
      registryStatus: status, activeScopes: scopes.filter((scope) => scope.status === "complete").map((scope) => scope.scopeId),
      supportedOperations: ["resizeWidth", "setVisibility"], uiCapability: "layout", pdfCapability: "unavailable",
      labelFieldSeparation: true, visibilityCapability: true, ...contract,
    },
    registryScopes: scopes,
  };
}

async function run() {
  const first = snapshot();
  assert.equal(assessExistingTargetRegistration({ installed: false }).status, "notInstalled");
  assert.equal(assessExistingTargetRegistration({ installed: true }).status, "registrationRequired");
  assert.equal(assessExistingTargetRegistration({ installed: true, registrationInProgress: true }).status, "registrationInProgress");
  assert.equal(assessExistingTargetRegistration({
    installed: true, adapterAvailable: true, refResolutionAvailable: true, baselineAvailable: true,
    domainActionProtectionAvailable: true, snapshot: first,
  }).status, "complete", "Bestands-App-Prozess bestätigt vollständigen Erstkontakt");
  const reorderedScope = completeScope();
  reorderedScope.elements.reverse();
  reorderedScope.expectedElementIds.reverse();
  const reordered = snapshot({ scopes: [reorderedScope] });
  assert.equal(first.contract.registryFingerprint, reordered.contract.registryFingerprint, "1/2 deterministisch und reihenfolgeunabhängig");

  const changedScope = completeScope("app.scope", [element("app.scope.note", "label", "app.scope.area", "status")]);
  const changed = snapshot({ scopes: [changedScope] });
  assert.notEqual(first.contract.registryFingerprint, changed.contract.registryFingerprint, "3 Strukturänderung ändert Fingerprint");

  const withDomainValues = structuredClone(first);
  withDomainValues.registryScopes[0].elements[4].currentValue = "Kundendaten";
  withDomainValues.registryScopes[0].elements[4].dueDate = "2030-01-01";
  assert.equal(createRegistryFingerprint(withDomainValues.registryScopes), first.contract.registryFingerprint, "4 Fachwerte ausgeschlossen");

  assert.equal(compareRegistrySnapshots(first, snapshot({ version: 2 })).status, "changed", "5 Versionsänderung trotz gleichem Fingerprint erkannt");
  assert.equal(compareRegistrySnapshots(first, changed).status, "changed", "5 Fingerprintänderung erkannt");

  const invalidRole = structuredClone(first);
  invalidRole.registryScopes[0].elements[1].role = "inventedRole";
  invalidRole.contract.registryFingerprint = createRegistryFingerprint(invalidRole.registryScopes);
  const invalidRoleResult = validateRegistrationSnapshot(invalidRole);
  assert.equal(invalidRoleResult.ok, false, "5a unbekannte Rolle wird vor Prozessstart blockiert");
  assert.ok(invalidRoleResult.errors.some((entry) => entry.code === ELECTRON_EDITOR_ERROR_CODES.REGISTRY_ROLE_MISSING));

  let requests = 0;
  let source = first;
  const coordinator = createRegistryRefreshCoordinator({ requestSnapshot: async () => { requests += 1; return source; } });
  assert.equal((await coordinator.refresh("open")).ok, true);
  assert.equal((await coordinator.refresh("focus")).ok, true);
  assert.equal(requests, 2, "6/7 Refresh vor Öffnen und Fokus");
  assert.equal(compareRegistrySnapshots(first, reordered).status, "current", "8 unveränderte Registry aktiv");
  source = changed;
  assert.equal((await coordinator.refresh("open")).code, ELECTRON_EDITOR_ERROR_CODES.REGISTRY_CHANGED, "9 geänderte Registry geladen");

  const invalid = structuredClone(changed);
  invalid.contract.registryFingerprint = `sha256:${"0".repeat(64)}`;
  source = invalid;
  const failed = await coordinator.refresh("open");
  assert.equal(failed.ok, false);
  assert.equal(coordinator.getCurrent().contract.registryFingerprint, changed.contract.registryFingerprint, "10 ungültig ersetzt gültig nicht");

  const blockedScope = { scopeId: "app.unfinished", status: "incomplete", inventoryStatus: "notInventoried", expectedElementIds: [], elements: [], reason: "inventory_pending" };
  const partial = snapshot({ scopes: [completeScope(), blockedScope], status: "incomplete" });
  assert.equal(validateRegistrationSnapshot(partial).ok, true, "11 unvollständiger Scope explizit gesperrt");
  assert.deepEqual(partial.contract.activeScopes, ["app.scope"], "12 vollständiger Scope verwendbar");

  const comparison = compareRegistrySnapshots(first, changed);
  assert.deepEqual(comparison.addedElementIds, ["app.scope.note"], "13 neues Element erkannt");
  const removed = compareRegistrySnapshots(changed, first);
  assert.deepEqual(removed.removedElementIds, ["app.scope.note"], "14 entferntes Element erkannt");

  const profile = Object.fromEntries(first.registryScopes[0].elements.map((entry) => [entry.id, { ...entry.baseline, width: 777 }]));
  const reconciled = reconcileRegistryProfile(first, changed, profile);
  assert.equal(reconciled.active["app.scope.field"].width, 777, "15 stabile Profilwerte erhalten");
  assert.equal(reconciled.active["app.scope.note"].width, 400, "13 neue ID nutzt Baseline");
  assert.equal(reconcileRegistryProfile(changed, first, { ...profile, "app.scope.note": baseline({ width: 333 }) }).archived["app.scope.note"].width, 333, "14 entfernte ID archiviert");

  const movedScope = completeScope();
  movedScope.elements.find((entry) => entry.id === "app.scope.field").parentId = "app.scope.area";
  const moved = snapshot({ scopes: [movedScope] });
  assert.deepEqual(compareRegistrySnapshots(first, moved).migrationRequiredIds, ["app.scope.field"], "16 Parentänderung prüfpflichtig");

  const lessScope = completeScope();
  lessScope.elements.find((entry) => entry.id === "app.scope.field").allowedOps = ["setVisibility"];
  const less = snapshot({ scopes: [lessScope] });
  const lessProfile = reconcileRegistryProfile(first, less, profile);
  assert.deepEqual(lessProfile.removedCapabilities["app.scope.field"], ["resizeWidth"], "17 entfallene Capability erkannt");
  assert.equal(Object.hasOwn(lessProfile.active["app.scope.field"], "width"), false, "17 alte Operation nicht angewendet");

  source = less;
  assert.equal((await coordinator.handleEvent("registryChanged")).ok, true, "18 Registryereignis löst Refresh aus");
  const dirtyCoordinator = createRegistryRefreshCoordinator({ requestSnapshot: async () => source, getDirtyElementIds: () => ["app.scope.field"] });
  source = first; await dirtyCoordinator.refresh("open"); source = changed;
  assert.equal((await dirtyCoordinator.handleEvent("scopeChanged")).code, ELECTRON_EDITOR_ERROR_CODES.REGISTRY_PROFILE_CONFLICT, "19 ungespeicherte Änderungen geschützt");

  const missingRef = structuredClone(first);
  missingRef.registryScopes[0].elements[1].referenceResolved = false;
  missingRef.contract.registryFingerprint = createRegistryFingerprint(missingRef.registryScopes);
  assert.equal(validateRegistrationSnapshot(missingRef).ok, false, "Ref-Auflösung verbindlich");

  const sourceText = fs.readdirSync(path.join(root, "src", "electron-target"))
    .filter((name) => name.endsWith(".cjs"))
    .map((name) => fs.readFileSync(path.join(root, "src", "electron-target", name), "utf8")).join("\n");
  assert.doesNotMatch(sourceText, /\bhttps?:|WebSocket|BrowserWindow|fetch\s*\(/i, "22 kein Browser-/Netzwerkpfad");
  console.log("TESTS OK: M80.1 Bestands-App-Registrierung, Fingerprint, Refresh und Profilabgleich");
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
