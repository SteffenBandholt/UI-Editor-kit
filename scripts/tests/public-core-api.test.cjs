#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const publicApiPath = path.join(REPO_ROOT, "src/index.cjs");
const publicApi = require(publicApiPath);
const { createNeutralTargetAppHostAdapter } = require("../fixtures/neutral-target-app/neutralTargetApp.cjs");

const expectedExports = [
  "validateTargetAppAdapterPath",
  "createTargetAppAdapterRuntime",
  "getTargetAppAdapterPathSummary",
  "createEditorRuntimeLauncher",
  "createEditorRuntimeStatusViewModel",
  "createEditorSelectionViewModel",
  "createEditorScopeViewModel",
  "createEditorLayoutControlViewModel",
  "validateLayoutState",
  "normalizeLayoutState",
  "createLayoutState",
  "getLayoutStateProfileKey",
  "assertCompatibleLayoutProfile",
  "createMemoryLayoutStateStore",
  "SELECTION_CONTRACT_VERSION",
  "SelectionContractErrorCodes",
  "validateSelectionTargetContract",
  "validateElementRefResolver",
  "validateSelectionHost",
  "validateSelectionControllerContract",
  "createSelectionStateSnapshot",
  "createSelectionController",
  "createHoverOverlay",
  "createSelectedOverlay",
  "resolveSelectionTarget",
  "SelectionRuntimeErrorCodes",
];
const forbiddenPublicApiPatterns = [
  /BBM/i,
  /Restarbeiten/i,
  /Protokoll/i,
  /TOPS/i,
  /database|\bDB\b|sql/i,
  /PDF|Druck|Mail|Audio/i,
  /querySelector|getElementById\(|MutationObserver|dom\s*scan/i,
  /auto.*detect|auto.*register|automatische\s+Registry-Befuellung/i,
];

assert.equal(fs.existsSync(publicApiPath), true, "src/index.cjs fehlt");
assert.deepEqual(Object.keys(publicApi), expectedExports);
expectedExports.forEach((name) => {
  if (name === "SELECTION_CONTRACT_VERSION") {
    assert.equal(typeof publicApi[name], "string", `${name} ist kein String-Export`);
  } else if (name === "SelectionContractErrorCodes" || name === "SelectionRuntimeErrorCodes") {
    assert.equal(typeof publicApi[name], "object", `${name} ist kein Objekt-Export`);
  } else {
    assert.equal(typeof publicApi[name], "function", `${name} ist kein Funktions-Export`);
  }
});

const publicApiSource = fs.readFileSync(publicApiPath, "utf8");
forbiddenPublicApiPatterns.forEach((pattern) => {
  assert.equal(pattern.test(publicApiSource), false, `src/index.cjs matched ${pattern}`);
});

const minimalExampleSource = fs.readFileSync(path.join(REPO_ROOT, "scripts/fixtures/minimal-target-app/minimal-target-app.cjs"), "utf8");
assert.equal(minimalExampleSource.includes("src/index.cjs"), true);
assert.equal(minimalExampleSource.includes("src/core/target-app-adapter-path.cjs"), false);
assert.equal(minimalExampleSource.includes("src/core/layout-state-store.cjs"), false);

const hostAdapter = createNeutralTargetAppHostAdapter({ uiScope: "scope.alpha" });
const runtime = publicApi.createTargetAppAdapterRuntime({
  hostAdapter,
  layoutStore: publicApi.createMemoryLayoutStateStore(),
});
assert.equal(runtime.ok, true);
assert.equal(runtime.status, "ok");
assert.equal(runtime.runtime.viewModels.runtimeStatus.ok, true);
assert.equal(runtime.runtime.viewModels.scope.uiScope, "scope.alpha");
assert.equal(runtime.runtime.viewModels.selection.ok, true);
assert.equal(runtime.runtime.viewModels.layoutControls.controls.save.available, true);

const selector = {
  targetAppId: "neutral-target-app",
  uiScope: "scope.alpha",
  layoutScope: "layout.alpha",
  layoutProfileId: "default",
};
const layoutState = publicApi.createLayoutState({
  schemaVersion: 1,
  ...selector,
  version: 1,
  source: "saved",
  elements: { "scope.alpha.root": { order: 0 } },
});
const validation = publicApi.validateLayoutState(layoutState);
assert.equal(validation.ok, true);
assert.equal(publicApi.getLayoutStateProfileKey(layoutState), "neutral-target-app\u001fscope.alpha\u001flayout.alpha\u001fdefault");
assert.equal(publicApi.assertCompatibleLayoutProfile(layoutState, selector).ok, true);
const store = publicApi.createMemoryLayoutStateStore();
assert.equal(store.saveLayoutState(layoutState).status, "layout_state_saved");
assert.equal(store.loadLayoutState(selector).status, "layout_state_loaded");
assert.equal(store.resetLayoutState(selector).status, "layout_state_reset");

const launcherStatus = publicApi.createEditorRuntimeLauncher(hostAdapter);
assert.equal(launcherStatus.ok, true);
assert.equal(publicApi.createEditorRuntimeStatusViewModel(launcherStatus).ok, true);
assert.equal(publicApi.createEditorScopeViewModel({ uiScope: "scope.alpha", layoutScope: "layout.alpha" }).ok, true);
assert.equal(publicApi.createEditorSelectionViewModel(runtime.runtime.editorCore, "scope.alpha.root").ok, true);
assert.equal(publicApi.createEditorLayoutControlViewModel({ hostAdapter, manifest: hostAdapter.getAdapterManifest(), layoutState }).ok, true);

console.log("public-core-api tests passed");
