"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createMemoryLayoutStateStore } = require("../../src/core/layout-state-store.cjs");
const {
  validateTargetAppAdapterPath,
  createTargetAppAdapterRuntime,
  getTargetAppAdapterPathSummary,
} = require("../../src/core/target-app-adapter-path.cjs");
const {
  createNeutralTargetAppHostAdapter,
  createNeutralTargetAppAdapterManifest,
} = require("../fixtures/neutral-target-app/neutralTargetApp.cjs");

function assertOkPath(uiScope, layoutScope) {
  const hostAdapter = createNeutralTargetAppHostAdapter({ uiScope });
  const result = validateTargetAppAdapterPath({ hostAdapter });
  assert.equal(result.ok, true);
  assert.equal(result.status, "ok");
  assert.equal(result.uiScope, uiScope);
  assert.equal(result.layoutScope, layoutScope);
  assert.equal(result.layoutProfileId, `${layoutScope}.profile`);
  assert.equal(result.registryElementCount, 5);
  assert.ok(result.capabilities.includes("runtime-launcher"));
  assert.ok(result.capabilities.includes("layout-state-store"));
}

assertOkPath("scope.alpha", "layout.alpha");
assertOkPath("scope.beta", "layout.beta");

{
  const runtime = createTargetAppAdapterRuntime({ hostAdapter: createNeutralTargetAppHostAdapter({ uiScope: "scope.alpha" }) });
  assert.equal(runtime.ok, true);
  assert.equal(runtime.runtime.runtimeStatus.ok, true);
  assert.equal(runtime.runtime.viewModels.runtimeStatus.ok, true);
  assert.equal(runtime.runtime.viewModels.runtimeStatus.targetAppId, "neutral-target-app");
  assert.equal(runtime.runtime.viewModels.scope.uiScope, "scope.alpha");
  assert.equal(runtime.runtime.viewModels.scope.layoutScope, "layout.alpha");
  assert.equal(runtime.runtime.viewModels.selection.ok, true);
  assert.equal(runtime.runtime.viewModels.selection.selectedElementId, "scope.alpha.root");
  assert.equal(runtime.runtime.viewModels.layoutControls.controls.save.available, true);
  assert.equal(runtime.runtime.viewModels.layoutControls.controls.load.available, true);
  assert.equal(runtime.runtime.viewModels.layoutControls.controls.reset.available, true);
}

{
  const hostAdapter = createNeutralTargetAppHostAdapter({ uiScope: "scope.beta" });
  const layoutStore = createMemoryLayoutStateStore();
  const runtime = createTargetAppAdapterRuntime({ hostAdapter, layoutStore });
  assert.equal(runtime.ok, true);
  const selector = {
    targetAppId: "neutral-target-app",
    uiScope: "scope.beta",
    layoutScope: "layout.beta",
    layoutProfileId: "layout.beta.profile",
  };
  assert.equal(layoutStore.loadLayoutState(selector).status, "layout_profile_not_found");
  const save = layoutStore.saveLayoutState({ schemaVersion: 1, ...selector, version: 2, source: "saved", elements: {} });
  assert.equal(save.ok, true);
  assert.equal(layoutStore.loadLayoutState(selector).layoutState.layoutScope, "layout.beta");
  assert.equal(layoutStore.resetLayoutState(selector).status, "layout_state_reset");
  assert.equal(layoutStore.loadLayoutState(selector).status, "layout_profile_not_found");
}

{
  const hostAdapter = createNeutralTargetAppHostAdapter({ uiScope: "scope.alpha" });
  const manifest = hostAdapter.getAdapterManifest();
  hostAdapter.getAdapterManifest = () => ({ ...manifest, uiScope: "scope.unknown" });
  const result = getTargetAppAdapterPathSummary({ hostAdapter });
  assert.equal(result.ok, false);
  assert.equal(result.blockCode, "unknown_scope");
}

{
  const result = validateTargetAppAdapterPath({ adapterManifest: createNeutralTargetAppAdapterManifest({ uiScope: "scope.alpha" }) });
  assert.equal(result.ok, false);
  assert.equal(result.blockCode, "missing_host_adapter");
}

{
  const hostAdapter = createNeutralTargetAppHostAdapter({ uiScope: "scope.alpha" });
  hostAdapter.getAdapterManifest = () => ({ targetAppId: "neutral-target-app" });
  const result = validateTargetAppAdapterPath({ hostAdapter });
  assert.equal(result.ok, false);
  assert.equal(result.blockCode, "invalid_adapter_manifest");
}

{
  const hostAdapter = createNeutralTargetAppHostAdapter({ uiScope: "scope.alpha" });
  hostAdapter.getRegistry = () => ({ listElements: () => [{ id: "broken" }] });
  const result = validateTargetAppAdapterPath({ hostAdapter });
  assert.equal(result.ok, false);
  assert.equal(result.blockCode, "invalid_registry");
}

{
  const hostAdapter = createNeutralTargetAppHostAdapter({ uiScope: "scope.alpha" });
  const layoutStore = {
    saveLayoutState() { return { ok: true }; },
    loadLayoutState() { return { ok: false, status: "layout_profile_not_found", errors: [{ code: "layout_profile_not_found" }] }; },
    resetLayoutState() { return { ok: true }; },
  };
  const result = validateTargetAppAdapterPath({ hostAdapter, layoutStore });
  assert.equal(result.ok, false);
  assert.equal(result.blockCode, "layout_profile_not_found");
}

{
  const checkedFiles = [
    "src/core/target-app-adapter-path.cjs",
    "docs/M46_OFFIZIELLER_ADAPTER_INSTALLER_PFAD.md",
  ];
  const forbiddenPatterns = [
    /Restarbeiten/i,
    /Protokoll/i,
    /TOPS/i,
    /database|\bDB\b|sql/i,
    /PDF|Druck|Mail|Audio/i,
    /querySelector|getElementById\(|MutationObserver|dom\s*scan/i,
    /auto.*detect|auto.*register|automatische\s+Registry-Befuellung/i,
  ];
  checkedFiles.forEach((file) => {
    const fullPath = path.join(__dirname, "..", "..", file);
    if (!fs.existsSync(fullPath)) return;
    const content = fs.readFileSync(fullPath, "utf8");
    forbiddenPatterns.forEach((pattern) => assert.equal(pattern.test(content), false, `${file} matched ${pattern}`));
  });
}

console.log("target-app-adapter-path tests passed");
