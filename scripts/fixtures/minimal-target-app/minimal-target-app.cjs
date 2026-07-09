"use strict";

const {
  createMemoryLayoutStateStore,
  createTargetAppAdapterRuntime,
} = require("../../../src/index.cjs");
const {
  createNeutralTargetAppHostAdapter,
  getNeutralTargetAppInfo,
} = require("../neutral-target-app/neutralTargetApp.cjs");

function createMinimalTargetAppExample(options) {
  const safeOptions = options && typeof options === "object" && !Array.isArray(options) ? options : {};
  const uiScope = safeOptions.uiScope || "scope.alpha";
  const hostAdapter = createNeutralTargetAppHostAdapter({ uiScope });
  const adapterManifest = hostAdapter.getAdapterManifest();
  const registry = hostAdapter.getRegistry();
  const layoutStore = createMemoryLayoutStateStore();
  const runtime = createTargetAppAdapterRuntime({ hostAdapter, registry, layoutStore });

  if (!runtime.ok) {
    return { ok: false, targetAppInfo: getNeutralTargetAppInfo(), adapterManifest, registry, layoutStore, runtime };
  }

  const selector = {
    targetAppId: adapterManifest.targetAppId,
    uiScope: adapterManifest.uiScope,
    layoutScope: adapterManifest.layoutScope,
    layoutProfileId: adapterManifest.layoutProfileId,
  };
  const layoutState = {
    schemaVersion: 1,
    ...selector,
    version: 2,
    source: "saved",
    elements: {
      [`${uiScope}.root`]: { order: 0 },
    },
  };
  const save = layoutStore.saveLayoutState(layoutState);
  const load = layoutStore.loadLayoutState(selector);
  const reset = layoutStore.resetLayoutState(selector);

  return {
    ok: true,
    targetAppInfo: getNeutralTargetAppInfo(),
    adapterManifest,
    hostAdapter,
    registry,
    runtime,
    viewModels: runtime.runtime.viewModels,
    layoutStore,
    layoutResults: { save, load, reset },
  };
}

if (require.main === module) {
  const example = createMinimalTargetAppExample();
  console.log(JSON.stringify({
    ok: example.ok,
    targetAppId: example.adapterManifest.targetAppId,
    adapterName: example.adapterManifest.adapterName,
    uiScope: example.adapterManifest.uiScope,
    layoutScope: example.adapterManifest.layoutScope,
    runtimeStatus: example.runtime.status,
    viewModels: Object.keys(example.viewModels || {}),
    layoutResults: {
      save: example.layoutResults && example.layoutResults.save.status,
      load: example.layoutResults && example.layoutResults.load.status,
      reset: example.layoutResults && example.layoutResults.reset.status,
    },
  }, null, 2));
}

module.exports = { createMinimalTargetAppExample };
