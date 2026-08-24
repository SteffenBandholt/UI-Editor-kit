#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const {
  RUNTIME_ERROR_CODES,
  createRegistryFingerprint,
  createUiEditorPanelController,
  createUiEditorRuntime,
  createUiScopeFingerprint,
  loadTargetStartupLayout,
  validateLayoutEntryForElement,
  validateRegistrationSnapshot,
  validateTargetStartupLayoutProfile,
  validateUiComponentContracts,
} = require("../../src/index.cjs");
const { createUiElementRegistry } = require("../../src/core/ui-element-registry.cjs");

const context = {
  targetAppId: "sample-app",
  moduleId: "sample-module",
  scopeId: "sample.scope",
  layoutProfileId: "standard",
};
const original = Object.freeze({ elementId: "sample.free", x: 0, y: 0, width: 100, height: 40 });

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function registryElement(overrides = {}) {
  return {
    id: "sample.free",
    name: "Freies Element",
    type: "card",
    role: "layout",
    parentId: null,
    order: 0,
    visible: true,
    editable: true,
    allowedOps: ["move", "resizeWidth", "resizeHeight"],
    lockedOps: [],
    baseline: { x: 0, y: 0, width: 100, height: 40 },
    ...overrides,
  };
}

function registryFor(element = registryElement()) {
  const registry = createUiElementRegistry();
  registry.registerElement(element);
  return registry;
}

function createHost(initial = original) {
  const defaults = clone(original);
  let state = clone(initial);
  return {
    validateElementRef: () => ({ ok: true }),
    captureElementLayoutState: () => clone(state),
    applyLayoutEntry(_elementId, entry) {
      const values = entry.element || entry;
      state = { ...state, ...clone(values), elementId: entry.elementId };
      return { ok: true };
    },
    clearElementLayout() { state = clone(defaults); return { ok: true }; },
    restoreElementLayoutState(_elementId, snapshot) { state = clone(snapshot || defaults); return { ok: true }; },
    getCurrentLayoutEntry: () => clone(state),
    dump: () => clone(state),
  };
}

function createStorage() {
  let entries = [];
  return {
    available: true,
    persistent: true,
    readResult: () => ({ ok: true, entries: clone(entries) }),
    write(_context, next) { entries = clone(next); return { ok: true }; },
    clear() { entries = []; return { ok: true }; },
    deleteEntry(_context, elementId) { entries = entries.filter((entry) => entry.elementId !== elementId); return { ok: true }; },
    dump: () => clone(entries),
  };
}

function component(element) {
  return {
    componentId: "sample.component",
    scopeId: "sample.scope",
    requiredSlots: ["root"],
    slots: [{
      slotId: "root",
      required: true,
      referenceKind: "single",
      presence: "always",
      element: {
        ...element,
        id: "sample.component.root",
        parentId: null,
        refKey: "sample.component.root.ref",
        stableIdSource: "declaration",
      },
    }],
  };
}

function profile(registryScope, geometry) {
  return {
    schemaVersion: 2,
    applicationId: "sample-app",
    profileId: "standard",
    savedAt: "2026-08-24T10:00:00.000Z",
    scopes: [{
      scopeId: registryScope.scopeId,
      registryFingerprint: createUiScopeFingerprint(registryScope),
      explicitOperations: { "sample.free": ["move", "resizeWidth", "resizeHeight"] },
      layoutState: { elements: [{ elementId: "sample.free", scopeId: registryScope.scopeId, ...geometry }] },
    }],
  };
}

function registrationSnapshot(childOverrides = {}) {
  const elements = [
    {
      id: "sample.scope", name: "Bereich", type: "root", role: "scopeRoot", parentId: null, order: 0,
      visible: true, editable: false, allowedOps: [], lockedOps: [], semanticKey: "sample.scope",
      registrationStatus: "editorContainer", refKey: "sample.scope.ref", referenceResolved: true,
      baseline: { x: 0, y: 0, width: 800, height: 600, visible: true },
    },
    {
      id: "sample.free", name: "Freies Element", type: "label", role: "content", parentId: "sample.scope", order: 1,
      visible: true, editable: true, allowedOps: ["move", "resizeWidth", "resizeHeight"], lockedOps: [], semanticKey: "sample.free",
      registrationStatus: "editorEnabled", refKey: "sample.free.ref", referenceResolved: true,
      baseline: { x: 0, y: 0, width: 100, height: 40, visible: true },
      ...childOverrides,
    },
  ];
  const registryScopes = [{
    scopeId: "sample.scope", status: "complete", inventoryStatus: "complete",
    expectedElementIds: elements.map((entry) => entry.id), elements,
  }];
  return {
    contract: {
      applicationId: "sample-app", displayName: "Sample App", appVersion: "1.0.0", framework: "electron",
      contractVersion: "1.1", adapterVersion: "1.1", registryVersion: 1,
      registryFingerprint: createRegistryFingerprint(registryScopes), registryStatus: "complete", activeScopes: ["sample.scope"],
      supportedOperations: ["move", "resizeWidth", "resizeHeight"], uiCapability: "layout", pdfCapability: "unavailable",
      labelFieldSeparation: true, visibilityCapability: true,
    },
    registryScopes,
  };
}

async function run() {
  const noBounds = registryElement();
  assert.equal(validateUiComponentContracts({
    components: [component(noBounds)],
    supportedOperations: ["move", "resizeWidth", "resizeHeight"],
  }).ok, true, "Komponentenvertrag ohne Geometriegrenzen muss gültig sein");
  assert.equal(validateUiComponentContracts({
    components: [component(registryElement({ baseline: { ...noBounds.baseline, minX: null, maxWidth: null } }))],
    supportedOperations: ["move", "resizeWidth", "resizeHeight"],
  }).ok, true, "null bezeichnet ausdrücklich unbegrenzt");
  const distribution = await import(pathToFileURL(path.join(__dirname, "../../dist/ui-component-contract.mjs")));
  assert.equal(distribution.validateUiComponentContracts({
    components: [component(noBounds)],
    supportedOperations: ["move", "resizeWidth", "resizeHeight"],
  }).ok, true, "ausgelieferter ESM-Komponentenvertrag muss dieselbe unbegrenzte Semantik besitzen");

  assert.equal(validateRegistrationSnapshot(registrationSnapshot()).ok, true, "Ziel-App-Vertrag braucht keine Fantasiegrenzen");
  assert.equal(validateRegistrationSnapshot(registrationSnapshot({ baseline: { x: 0, y: 0, width: 0, height: 0, minX: null, maxX: null } })).ok, true,
    "Nullgröße und ausdrücklich unbegrenzte Position bleiben technisch darstellbar");
  assert.equal(validateRegistrationSnapshot(registrationSnapshot({ baseline: { x: 0, y: 0, width: 100, height: 40, minWidth: 200, maxWidth: 100 } })).ok, false,
    "widersprüchliche explizite Grenzen bleiben ungültig");
  assert.equal(validateRegistrationSnapshot(registrationSnapshot({ baseline: { x: "0", y: 0, width: 100, height: 40 } })).ok, false,
    "nicht numerische Geometriewerte bleiben im Ziel-App-Vertrag ungültig");

  for (const value of [-5000, 5000]) {
    assert.equal(validateLayoutEntryForElement({ elementId: noBounds.id, x: value, y: value }, noBounds).ok, true);
  }
  for (const [field, value] of [["width", 0], ["width", 5000], ["height", 0], ["height", 5000]]) {
    assert.equal(validateLayoutEntryForElement({ elementId: noBounds.id, [field]: value }, noBounds).ok, true, `${field}=${value} muss unbegrenzt gültig sein`);
  }
  assert.equal(validateLayoutEntryForElement({ elementId: noBounds.id, x: Number.NaN }, noBounds).code, RUNTIME_ERROR_CODES.INVALID_LAYOUT_ENTRY);
  assert.equal(validateLayoutEntryForElement({ elementId: noBounds.id, width: Number.POSITIVE_INFINITY }, noBounds).code, RUNTIME_ERROR_CODES.INVALID_LAYOUT_ENTRY);
  assert.equal(validateLayoutEntryForElement({ elementId: noBounds.id, width: -1 }, noBounds).code, RUNTIME_ERROR_CODES.INVALID_LAYOUT_ENTRY,
    "negative Größen bleiben als technische Wertungültigkeit gesperrt");
  assert.equal(validateLayoutEntryForElement({ elementId: noBounds.id, x: 0 }, registryElement({ baseline: { ...noBounds.baseline, maxX: Number.POSITIVE_INFINITY } })).code,
    RUNTIME_ERROR_CODES.INVALID_REGISTRY, "eine ungültige explizite Grenze darf nicht als unbegrenzt durchrutschen");

  const explicitlyBounded = registryElement({ baseline: {
    x: 0, y: 0, width: 100, height: 40,
    minX: -100, maxX: 100, minY: -200, maxY: 200,
    minWidth: 20, maxWidth: 300, minHeight: 10, maxHeight: 80,
  } });
  for (const [field, value] of [["x", -101], ["x", 101], ["y", -201], ["y", 201], ["width", 19], ["width", 301], ["height", 9], ["height", 81]]) {
    assert.equal(validateLayoutEntryForElement({ elementId: explicitlyBounded.id, [field]: value }, explicitlyBounded).code, RUNTIME_ERROR_CODES.VALUE_OUT_OF_RANGE,
      `${field} muss seine ausdrücklich deklarierte Grenze behalten`);
  }

  const storage = createStorage();
  const firstHost = createHost();
  const firstRuntime = createUiEditorRuntime({ registry: registryFor(noBounds), hostAdapter: firstHost, layoutStorage: storage, targetContext: context });
  assert.equal(firstRuntime.beginSession().ok, true);
  assert.equal(firstRuntime.applyChange({ elementId: noBounds.id, operation: "move", payload: { x: -5000, y: 5000 }, changeId: "free-move", createdAt: "now", source: "test" }).ok, true);
  assert.equal(firstRuntime.applyChange({ elementId: noBounds.id, operation: "resizeWidth", payload: { width: 0 }, changeId: "free-width", createdAt: "now", source: "test" }).ok, true);
  assert.equal(firstRuntime.applyChange({ elementId: noBounds.id, operation: "resizeHeight", payload: { height: 5000 }, changeId: "free-height", createdAt: "now", source: "test" }).ok, true);

  const panel = createUiEditorPanelController({ runtime: firstRuntime, registry: registryFor(noBounds), stepSize: 5 });
  panel.selectElement(noBounds.id);
  panel.setMode("move");
  assert.equal((await panel.activateDirection("left")).lastResult.ok, true, "Panel darf jenseits -5000 weiterbewegen");
  panel.setMode("height");
  assert.equal((await panel.activateDirection("down")).lastResult.ok, true, "Panel darf jenseits 5000 weitervergrößern");
  assert.equal(firstRuntime.saveLayout().ok, true);
  const savedState = clone(firstHost.dump());

  const secondHost = createHost();
  const secondRuntime = createUiEditorRuntime({ registry: registryFor(noBounds), hostAdapter: secondHost, layoutStorage: storage, targetContext: context });
  assert.equal(secondRuntime.beginSession().ok, true);
  assert.equal(secondRuntime.loadLayout().ok, true);
  assert.deepEqual(secondHost.dump(), savedState, "Save/Load muss unbegrenzte Geometrie exakt wiederherstellen");
  assert.equal(secondRuntime.applyChange({ elementId: noBounds.id, operation: "move", payload: { x: 6000 }, changeId: "discard", createdAt: "now", source: "test" }).ok, true);
  assert.equal(secondRuntime.discardElementChanges(noBounds.id).ok, true);
  assert.deepEqual(secondHost.dump(), savedState, "Discard muss zur gespeicherten unbegrenzten Geometrie zurückkehren");
  assert.equal(secondRuntime.resetElementToDefaults(noBounds.id).ok, true);
  assert.deepEqual(secondHost.dump(), original, "Original/Reset muss unverändert funktionieren");

  const freeScope = { scopeId: "sample.scope", status: "complete", elements: [noBounds] };
  const freeProfile = profile(freeScope, { x: -5000, y: 5000, width: 0, height: 5000 });
  const profileOptions = { applicationId: "sample-app", profileId: "standard", activeScopes: ["sample.scope"], registryScopes: [freeScope] };
  assert.equal(validateTargetStartupLayoutProfile(freeProfile, profileOptions).ok, true, "Profilstart darf keine Ersatzgrenze einsetzen");

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "ui-editor-unbounded-"));
  try {
    fs.writeFileSync(path.join(temp, "standard.layout-profile.json"), JSON.stringify(freeProfile));
    const loaded = loadTargetStartupLayout({ profileRoot: temp, applicationId: "sample-app", activeScopes: ["sample.scope"], registryScopes: [freeScope] });
    assert.equal(loaded.ok, true);
    assert.deepEqual(loaded.scopes[0].elements[0], freeProfile.scopes[0].layoutState.elements[0], "Neustart-Load muss Geometrie exakt erhalten");
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }

  const legacyBoundedElement = registryElement({ geometry: { maximumStoredOffset: 2400 } });
  const legacyBoundedScope = { scopeId: "sample.scope", status: "complete", elements: [legacyBoundedElement] };
  const legacyOptions = { ...profileOptions, registryScopes: [legacyBoundedScope] };
  assert.equal(validateTargetStartupLayoutProfile(profile(legacyBoundedScope, { x: 2400, y: -2400, width: 100, height: 40 }), legacyOptions).ok, true);
  assert.equal(validateTargetStartupLayoutProfile(profile(legacyBoundedScope, { x: 2401, y: 0, width: 100, height: 40 }), legacyOptions).ok, false,
    "ausdrücklich deklarierte Bestandsgrenze bleibt kompatibel");

  const nullOverrideElement = registryElement({ baseline: { ...noBounds.baseline, minX: null, maxX: null }, geometry: { maximumStoredOffset: 2400 } });
  const nullOverrideScope = { scopeId: "sample.scope", status: "complete", elements: [nullOverrideElement] };
  assert.equal(validateTargetStartupLayoutProfile(profile(nullOverrideScope, { x: 5000, y: 0, width: 100, height: 40 }), { ...profileOptions, registryScopes: [nullOverrideScope] }).ok, true,
    "ausdrücklich unbegrenzte Richtungen dürfen nicht auf Legacy-Ersatzwerte zurückfallen");

  const boundedScope = { scopeId: "sample.scope", status: "complete", elements: [explicitlyBounded] };
  assert.equal(validateTargetStartupLayoutProfile(profile(boundedScope, { x: 101, y: 0, width: 100, height: 40 }), { ...profileOptions, registryScopes: [boundedScope] }).ok, false,
    "explizite neue Positionsgrenze bleibt verbindlich");
  const invalidBoundsElement = registryElement({ baseline: { ...noBounds.baseline, minY: 20, maxY: 10 } });
  const invalidBoundsScope = { scopeId: "sample.scope", status: "complete", elements: [invalidBoundsElement] };
  assert.equal(validateTargetStartupLayoutProfile(profile(invalidBoundsScope, { x: 0, y: 15, width: 100, height: 40 }), { ...profileOptions, registryScopes: [invalidBoundsScope] }).ok, false,
    "Profilladen muss widersprüchliche explizite Registrygrenzen ablehnen");

  console.log("TESTS OK: optionale und explizite Geometriegrenzen, Profil, Panel, Save/Load, Discard und Reset");
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
