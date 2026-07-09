#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const FIXTURE_DIR = path.join(REPO_ROOT, "scripts/fixtures/neutral-target-app");
const FIXTURE_PATH = path.join(FIXTURE_DIR, "neutralTargetApp.cjs");

const { createEditorCore } = require("../../src/core/editor-core.cjs");
const { createEditorRuntimeLauncher } = require("../../src/core/editor-runtime-launcher.cjs");
const { createEditorRuntimeStatusViewModel } = require("../../src/core/editor-runtime-status-view-model.cjs");
const { createEditorScopeViewModel, createEditorScopeChangeViewModel } = require("../../src/core/editor-scope-view-model.cjs");
const { createEditorSelectionViewModel, clearEditorSelectionForScopeChange } = require("../../src/core/editor-selection-view-model.cjs");
const { createEditorLayoutControlViewModel } = require("../../src/core/editor-layout-control-view-model.cjs");
const { validateHostAdapterContract } = require("../../src/core/host-adapter-contract.cjs");
const { validateTargetAppAdapterManifest } = require("../../src/core/target-app-adapter-manifest.cjs");

const {
  getNeutralTargetAppInfo,
  getNeutralTargetAppScopes,
  resolveNeutralLayoutScope,
  listElementsForScope,
  createNeutralTargetAppRegistry,
  createNeutralTargetAppAdapterManifest,
  createNeutralTargetAppHostAdapter,
  createNeutralTargetApp,
} = require(FIXTURE_PATH);

function assertFixtureDoesNotContainForbiddenFragments() {
  const source = fs.readFileSync(FIXTURE_PATH, "utf8");
  const lowerSource = source.toLowerCase();
  const forbiddenFragments = [
    "queryselector",
    "document.",
    "window.",
    "autodetect",
    "autoregister",
    "scan",
    "db",
    "pdf",
    "druck",
    "mail",
    "audio",
    "bbm",
    "restarbeiten",
    "protokoll",
    "tops",
  ];

  forbiddenFragments.forEach((fragment) => {
    assert.equal(lowerSource.includes(fragment), false, `neutral-target-app must not contain ${fragment}.`);
  });
}

function createChangeRequest(values) {
  return {
    changeId: values.changeId || "neutral-change-001",
    elementId: values.elementId || "scope.alpha.field.title",
    operation: values.operation || "resize",
    payload: values.payload || { width: 320 },
    createdAt: "2026-07-09T00:00:00.000Z",
    source: "neutral-target-app-test",
  };
}

function run() {
  assert.equal(typeof createNeutralTargetApp, "function");
  assert.equal(typeof createNeutralTargetAppHostAdapter, "function");
  assert.equal(typeof createNeutralTargetAppRegistry, "function");
  assert.equal(typeof createNeutralTargetAppAdapterManifest, "function");

  assert.deepEqual(getNeutralTargetAppInfo(), {
    targetAppId: "neutral-target-app",
    targetAppName: "Neutral Target App",
    adapterName: "neutral-target-app-adapter",
    adapterVersion: "1.0.0",
  });

  assert.deepEqual(getNeutralTargetAppScopes(), [
    { uiScope: "scope.alpha", layoutScope: "layout.alpha" },
    { uiScope: "scope.beta", layoutScope: "layout.beta" },
  ]);
  assert.equal(resolveNeutralLayoutScope("scope.alpha"), "layout.alpha");
  assert.equal(resolveNeutralLayoutScope("scope.beta"), "layout.beta");

  const alphaElements = listElementsForScope("scope.alpha");
  const betaElements = listElementsForScope("scope.beta");
  assert.equal(alphaElements.length, 5);
  assert.equal(betaElements.length, 5);
  assert.deepEqual(alphaElements.map((element) => element.type), ["root", "area", "group", "field", "button"]);
  assert.deepEqual(betaElements.map((element) => element.type), ["root", "area", "group", "field", "button"]);

  const hostAdapter = createNeutralTargetAppHostAdapter({ uiScope: "scope.alpha" });
  assert.deepEqual(validateHostAdapterContract(hostAdapter), { ok: true, errors: [] });

  const manifest = hostAdapter.getAdapterManifest();
  assert.deepEqual(validateTargetAppAdapterManifest(manifest), { ok: true, errors: [] });
  assert.equal(manifest.uiScope, "scope.alpha");
  assert.equal(manifest.layoutScope, "layout.alpha");
  assert.deepEqual(manifest.uiToLayoutScope, {
    "scope.alpha": "layout.alpha",
    "scope.beta": "layout.beta",
  });

  const runtimeStatus = createEditorRuntimeLauncher(hostAdapter);
  assert.equal(runtimeStatus.ok, true);
  assert.equal(runtimeStatus.targetAppId, "neutral-target-app");
  assert.equal(runtimeStatus.adapterName, "neutral-target-app-adapter");
  assert.equal(runtimeStatus.uiScope, "scope.alpha");
  assert.equal(runtimeStatus.layoutScope, "layout.alpha");
  assert.equal(runtimeStatus.registryElementCount, 5);

  const statusViewModel = createEditorRuntimeStatusViewModel(runtimeStatus);
  assert.equal(statusViewModel.ok, true);
  assert.equal(statusViewModel.blocked, false);
  assert.equal(statusViewModel.uiScope, "scope.alpha");
  assert.equal(statusViewModel.layoutScope, "layout.alpha");

  const scopeViewModel = createEditorScopeViewModel({
    manifest,
    uiScope: "scope.alpha",
    layoutScope: "layout.alpha",
  });
  assert.equal(scopeViewModel.ok, true);
  assert.equal(scopeViewModel.uiScope, "scope.alpha");
  assert.equal(scopeViewModel.layoutScope, "layout.alpha");
  assert.equal(scopeViewModel.knownScopes.length, 3);

  const registry = createNeutralTargetAppRegistry({ uiScope: "scope.alpha" });
  const editorCore = createEditorCore(registry);
  const selected = createEditorSelectionViewModel(editorCore, "scope.alpha.field.title", {
    scope: { uiScope: "scope.alpha", layoutScope: "layout.alpha" },
    operation: "move",
  });
  assert.equal(selected.ok, true);
  assert.equal(selected.status, "available");
  assert.equal(selected.selectedElementName, "Alpha Field");
  assert.deepEqual(selected.allowedOperations, ["inspect", "move", "resize"]);
  assert.deepEqual(selected.lockedOperations, ["hide", "rename", "reset"]);
  assert.deepEqual(selected.availableOperations, ["inspect", "move", "resize"]);

  const unknownSelection = createEditorSelectionViewModel(editorCore, "scope.alpha.unknown", {
    scope: { uiScope: "scope.alpha", layoutScope: "layout.alpha" },
  });
  assert.equal(unknownSelection.ok, false);
  assert.equal(unknownSelection.status, "unknown_element");

  const wrongScopeSelection = createEditorSelectionViewModel(editorCore, "scope.alpha.field.title", {
    scope: { uiScope: "scope.beta", layoutScope: "layout.beta" },
  });
  assert.equal(wrongScopeSelection.ok, false);
  assert.equal(wrongScopeSelection.status, "wrong_scope");

  const lockedSelection = createEditorSelectionViewModel(editorCore, "scope.alpha.field.title", {
    scope: { uiScope: "scope.alpha", layoutScope: "layout.alpha" },
    operation: "hide",
  });
  assert.equal(lockedSelection.ok, false);
  assert.equal(lockedSelection.status, "operation_locked");

  const noSelection = createEditorSelectionViewModel(editorCore, null, {
    scope: { uiScope: "scope.alpha", layoutScope: "layout.alpha" },
  });
  assert.equal(noSelection.ok, false);
  assert.equal(noSelection.status, "no_selection");

  const scopeChange = createEditorScopeChangeViewModel(
    { uiScope: "scope.alpha", layoutScope: "layout.alpha", selectedElementId: "scope.alpha.field.title" },
    { uiScope: "scope.beta", layoutScope: "layout.beta", knownScopes: getNeutralTargetAppScopes() }
  );
  assert.equal(scopeChange.ok, true);
  assert.equal(scopeChange.selectionCleared, true);
  assert.equal(scopeChange.selectedElementId, null);
  assert.equal(clearEditorSelectionForScopeChange("scope.alpha.field.title", scopeChange).selectedElementId, null);

  const controls = createEditorLayoutControlViewModel({
    hostAdapter,
    manifest,
    layoutState: hostAdapter.getCurrentLayoutState(),
  });
  assert.equal(controls.status, "layout_controls_ready");
  assert.equal(controls.controls.save.status, "save_available");
  assert.equal(controls.controls.load.status, "load_available");
  assert.equal(controls.controls.reset.status, "reset_available");

  const disabledHostAdapter = createNeutralTargetAppHostAdapter({ uiScope: "scope.beta", layoutControls: false });
  const disabledControls = createEditorLayoutControlViewModel({
    hostAdapter: disabledHostAdapter,
    manifest: disabledHostAdapter.getAdapterManifest(),
    layoutState: disabledHostAdapter.getCurrentLayoutState(),
  });
  assert.equal(disabledControls.controls.save.status, "save_blocked");
  assert.equal(disabledControls.controls.load.status, "load_blocked");
  assert.equal(disabledControls.controls.reset.status, "reset_blocked");

  const acceptedChange = hostAdapter.submitChangeRequest(createChangeRequest({}));
  assert.deepEqual(acceptedChange, { ok: true, accepted: true, executed: false, errors: [] });
  assert.equal(hostAdapter.listSubmittedChangeRequests().length, 1);

  const unknownChange = hostAdapter.submitChangeRequest(createChangeRequest({
    changeId: "neutral-change-unknown",
    elementId: "scope.alpha.unknown",
  }));
  assert.equal(unknownChange.ok, false);
  assert.equal(unknownChange.accepted, false);
  assert.equal(unknownChange.errors.some((error) => error.code === "unknown_element"), true);

  const targetApp = createNeutralTargetApp({ uiScope: "scope.beta" });
  assert.equal(targetApp.info.targetAppId, "neutral-target-app");
  assert.equal(targetApp.manifest.uiScope, "scope.beta");
  assert.equal(targetApp.registry.size(), 5);
  assert.equal(createEditorRuntimeLauncher(targetApp.hostAdapter).ok, true);

  assertFixtureDoesNotContainForbiddenFragments();

  console.log("TESTS OK: neutral-target-app");
}

run();
