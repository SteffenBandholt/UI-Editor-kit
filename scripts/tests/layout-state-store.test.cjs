#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createMemoryLayoutStateStore } = require("../../src/core/layout-state-store.cjs");
const { createEditorLayoutControlViewModel, createEditorLayoutControlResultViewModel } = require("../../src/core/editor-layout-control-view-model.cjs");
const neutralTarget = require("../fixtures/neutral-target-app/neutralTargetApp.cjs");

const STORE_PATH = path.join(__dirname, "../../src/core/layout-state-store.cjs");

function state(uiScope, layoutScope, overrides = {}) {
  return {
    schemaVersion: 1,
    targetAppId: "neutral-target-app",
    uiScope,
    layoutScope,
    layoutProfileId: `${layoutScope}.profile`,
    version: 1,
    source: "saved",
    elements: { [`${uiScope}.header`]: { width: 300, height: 80, order: 1 } },
    ...overrides,
  };
}
function selector(uiScope, layoutScope, overrides = {}) {
  return { targetAppId: "neutral-target-app", uiScope, layoutScope, layoutProfileId: `${layoutScope}.profile`, ...overrides };
}
function run() {
  const store = createMemoryLayoutStateStore();
  const alpha = state("scope.alpha", "layout.alpha");
  const beta = state("scope.beta", "layout.beta", { version: 2, elements: { "scope.beta.header": { width: 500, height: 90 } } });
  assert.equal(store.saveLayoutState(alpha).status, "layout_state_saved");
  assert.equal(store.saveLayoutState(beta).status, "layout_state_saved");
  assert.equal(store.loadLayoutState(selector("scope.alpha", "layout.alpha")).layoutState.elements["scope.alpha.header"].width, 300);
  assert.equal(store.loadLayoutState(selector("scope.beta", "layout.beta")).layoutState.elements["scope.beta.header"].width, 500);
  assert.equal(store.loadLayoutState(selector("scope.beta", "layout.beta", { layoutProfileId: "layout.alpha.profile" })).status, "layout_profile_not_found");
  assert.equal(store.loadLayoutState(selector("scope.alpha", "layout.beta")).status, "layout_profile_not_found");
  assert.equal(store.listLayoutProfiles({ targetAppId: "neutral-target-app", uiScope: "scope.alpha" }).profiles.length, 1);
  assert.equal(store.listLayoutProfiles({ targetAppId: "neutral-target-app", uiScope: "scope.beta" }).profiles.length, 1);

  const loaded = store.loadLayoutState(selector("scope.alpha", "layout.alpha")).layoutState;
  loaded.elements["scope.alpha.header"].width = 1;
  assert.equal(store.loadLayoutState(selector("scope.alpha", "layout.alpha")).layoutState.elements["scope.alpha.header"].width, 300);
  assert.equal(store.resetLayoutState(selector("scope.alpha", "layout.alpha")).status, "layout_state_reset");
  assert.equal(store.loadLayoutState(selector("scope.alpha", "layout.alpha")).status, "layout_profile_not_found");
  assert.equal(store.loadLayoutState(selector("scope.beta", "layout.beta")).ok, true);

  assert.equal(store.saveLayoutState(state("scope.alpha", "layout.alpha", { schemaVersion: 99 })).status, "unsupported_layout_schema_version");
  assert.equal(store.saveLayoutState(state("scope.alpha", "layout.alpha", { recordId: "not-neutral" })).status, "invalid_layout_state");
  assert.equal(store.saveLayoutState(state("scope.alpha", "layout.alpha", { elements: { a: { width: 1, command: "no" } } })).status, "invalid_layout_state");
  assert.equal(store.loadLayoutState(selector("scope.alpha", "layout.alpha", { unknown: "x" })).status, "invalid_layout_state");

  const neutralApp = neutralTarget.createNeutralTargetApp({ uiScope: "scope.alpha" });
  const neutralStore = createMemoryLayoutStateStore();
  const neutralState = state(neutralApp.manifest.uiScope, neutralApp.manifest.layoutScope, { layoutProfileId: neutralApp.manifest.layoutProfileId });
  assert.equal(neutralStore.saveLayoutState(neutralState).ok, true);
  assert.equal(neutralStore.loadLayoutState({ targetAppId: neutralApp.manifest.targetAppId, uiScope: "scope.alpha", layoutScope: "layout.alpha", layoutProfileId: "layout.alpha.profile" }).ok, true);

  const hostAdapter = { getCurrentLayoutState() { return neutralState; }, saveLayoutState() {}, loadLayoutState() {}, resetLayoutState() {} };
  const controls = createEditorLayoutControlViewModel({ hostAdapter, manifest: neutralApp.manifest, layoutState: neutralState });
  assert.equal(controls.controls.save.status, "save_available");
  assert.equal(controls.controls.load.status, "load_available");
  assert.equal(controls.controls.reset.status, "reset_available");
  assert.equal(createEditorLayoutControlViewModel({ hostAdapter, manifest: neutralApp.manifest, status: "invalid_layout_state" }).controls.save.status, "invalid_layout_state");
  assert.equal(createEditorLayoutControlViewModel({ hostAdapter, manifest: neutralApp.manifest, status: "unsupported_layout_schema_version" }).controls.load.status, "unsupported_layout_schema_version");
  assert.equal(createEditorLayoutControlViewModel({ hostAdapter, manifest: neutralApp.manifest, status: "layout_profile_not_found" }).controls.reset.status, "layout_profile_not_found");
  assert.equal(createEditorLayoutControlResultViewModel({ ok: false, status: "layout_profile_not_found" }).status, "layout_profile_not_found");

  const source = fs.readFileSync(STORE_PATH, "utf8").toLowerCase();
  ["write" + "file", "read" + "file", "query" + "selector", "doc" + "ument.", "win" + "dow.", "p" + "df", "m" + "ail", "au" + "dio"].forEach((term) => assert.equal(source.includes(term), false));
  console.log("TESTS OK: layout-state-store");
}
run();
