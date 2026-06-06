#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const MODULE_PATH = path.join(REPO_ROOT, "src/core/target-app-bootstrap.cjs");
const { createUiElementRegistry } = require(path.join(REPO_ROOT, "src/core/ui-element-registry.cjs"));
const { createTestHostAdapter } = require(path.join(REPO_ROOT, "src/core/test-host-adapter.cjs"));
const {
  createTargetAppBootstrap,
  getTargetAppBootstrapRequiredOptions,
  getTargetAppBootstrapOptionalOptions,
} = require(MODULE_PATH);

function createValidRegistry() {
  const registry = createUiElementRegistry();
  [
    {
      id: "workspace.root",
      name: "Root",
      type: "root",
      role: "layout",
      parentId: null,
      order: 0,
      visible: true,
      editable: false,
      allowedOps: ["inspect"],
      lockedOps: [],
    },
    {
      id: "workspace.main.area",
      name: "Bereich",
      type: "area",
      role: "layout",
      parentId: "workspace.root",
      order: 1,
      visible: true,
      editable: true,
      allowedOps: ["inspect", "move"],
      lockedOps: [],
    },
  ].forEach((element) => registry.registerElement(element));
  return registry;
}

function createCountingHostAdapter(registry, layoutState) {
  const calls = {
    getRegistry: 0,
    getCurrentLayoutState: 0,
    submitChangeRequest: 0,
    saveLayoutStateRecord: 0,
    writeFile: 0,
    database: 0,
    createUi: 0,
  };

  return {
    calls,
    getRegistry() {
      calls.getRegistry += 1;
      return registry;
    },
    getCurrentLayoutState() {
      calls.getCurrentLayoutState += 1;
      return JSON.parse(JSON.stringify(layoutState));
    },
    submitChangeRequest() {
      calls.submitChangeRequest += 1;
      return { ok: true };
    },
    saveLayoutStateRecord() {
      calls.saveLayoutStateRecord += 1;
    },
    writeFile() {
      calls.writeFile += 1;
    },
    database() {
      calls.database += 1;
    },
    createUi() {
      calls.createUi += 1;
    },
  };
}

function assertFailure(result, code) {
  assert.equal(result.ok, false);
  assert.equal(Array.isArray(result.errors), true);
  assert.equal(result.errors.some((error) => error.code === code), true, `Fehlercode fehlt: ${code}`);
}

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

function run() {
  assert.equal(typeof createTargetAppBootstrap, "function");
  assert.equal(typeof getTargetAppBootstrapRequiredOptions, "function");
  assert.equal(typeof getTargetAppBootstrapOptionalOptions, "function");

  const requiredOptions = getTargetAppBootstrapRequiredOptions();
  assert.deepEqual(requiredOptions, ["targetAppId", "hostAdapter"]);
  requiredOptions.push("mutated");
  assert.deepEqual(getTargetAppBootstrapRequiredOptions(), ["targetAppId", "hostAdapter"]);

  const optionalOptions = getTargetAppBootstrapOptionalOptions();
  assert.deepEqual(optionalOptions, [
    "layoutProfileId",
    "uiScope",
    "availableScopes",
    "activeScopeId",
    "fallbackScopeId",
    "hostContext",
    "initialUiState",
  ]);
  optionalOptions.push("mutated");
  assert.deepEqual(getTargetAppBootstrapOptionalOptions(), [
    "layoutProfileId",
    "uiScope",
    "availableScopes",
    "activeScopeId",
    "fallbackScopeId",
    "hostContext",
    "initialUiState",
  ]);

  assertFailure(createTargetAppBootstrap(), "invalid_target_app_bootstrap_options");
  assertFailure(createTargetAppBootstrap({ hostAdapter: createCountingHostAdapter(createValidRegistry(), {}) }), "invalid_target_app_id");
  assertFailure(createTargetAppBootstrap({ targetAppId: "neutral-app" }), "invalid_host_adapter");
  assertFailure(createTargetAppBootstrap({ targetAppId: "neutral-app", hostAdapter: {} }), "missing_host_adapter_method");

  const noRegistryHost = createCountingHostAdapter(null, {});
  assertFailure(createTargetAppBootstrap({ targetAppId: "neutral-app", hostAdapter: noRegistryHost }), "missing_registry");
  assert.equal(noRegistryHost.calls.getRegistry, 1);
  assert.equal(noRegistryHost.calls.submitChangeRequest, 0);

  const layoutState = {
    selected: { elementId: "workspace.main.area" },
    panels: [{ id: "tree", width: 320 }],
  };
  const hostAdapter = createCountingHostAdapter(createValidRegistry(), layoutState);
  const result = createTargetAppBootstrap({
    targetAppId: "neutral-app",
    hostAdapter,
    layoutProfileId: "neutral-layout",
    uiScope: "workspace",
    initialUiState: { selectedElementId: "workspace.main.area", expandedElementIds: ["workspace.root"] },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.equal(hostAdapter.calls.getRegistry, 1);
  assert.equal(hostAdapter.calls.getCurrentLayoutState, 1);
  assert.equal(hostAdapter.calls.submitChangeRequest, 0);
  assert.equal(hostAdapter.calls.saveLayoutStateRecord, 0);
  assert.equal(hostAdapter.calls.writeFile, 0);
  assert.equal(hostAdapter.calls.database, 0);
  assert.equal(hostAdapter.calls.createUi, 0);

  assert.equal(typeof result.editorCore, "object");
  assert.equal(typeof result.editorCore.getElementTree, "function");
  assert.equal(typeof result.uiState, "object");
  assert.equal(typeof result.uiState.getState, "function");
  assert.equal(typeof result.treeViewModel, "object");
  assert.equal(result.treeViewModel.root.id, "workspace.root");
  assert.equal(result.targetAppId, "neutral-app");
  assert.equal(result.layoutProfileId, "neutral-layout");
  assert.equal(result.uiScope, "workspace");
  assert.equal(result.availableScopes, undefined);
  assert.deepEqual(result.capabilities, {
    hasRegistry: true,
    hasEditorCore: true,
    hasLayoutState: true,
    hasTreeViewModel: true,
    canCreateChangeDraft: true,
  });

  const treeFromResult = result.treeViewModel;
  const freshTree = createTargetAppBootstrap({ targetAppId: "neutral-app", hostAdapter }).treeViewModel;
  assert.notEqual(treeFromResult, freshTree);
  assert.deepEqual(treeFromResult, freshTree);

  const layoutFromResult = result.layoutState;
  const freshLayout = createTargetAppBootstrap({ targetAppId: "neutral-app", hostAdapter }).layoutState;
  assert.notEqual(layoutFromResult, freshLayout);
  assert.deepEqual(layoutFromResult, freshLayout);

  treeFromResult.root.id = "mutated";
  treeFromResult.nodes[0].path.push("mutated");
  assert.equal(createTargetAppBootstrap({ targetAppId: "neutral-app", hostAdapter }).treeViewModel.root.id, "workspace.root");
  assert.deepEqual(createTargetAppBootstrap({ targetAppId: "neutral-app", hostAdapter }).treeViewModel.nodes[0].path, [
    "workspace.root",
  ]);

  layoutFromResult.selected.elementId = "mutated";
  layoutFromResult.panels[0].width = 999;
  assert.deepEqual(createTargetAppBootstrap({ targetAppId: "neutral-app", hostAdapter }).layoutState, layoutState);

  const testHostAdapter = createTestHostAdapter({ registry: createValidRegistry(), layoutState });
  const testHostResult = createTargetAppBootstrap({ targetAppId: "neutral-app", hostAdapter: testHostAdapter });
  assert.equal(testHostResult.ok, true);
  assert.equal(testHostAdapter.listSubmittedChangeRequests().length, 0);

  const availableScopes = ["workspace.primary", "workspace.secondary", "workspace.fallback"];
  const activeScopeResult = createTargetAppBootstrap({
    targetAppId: "neutral-app",
    hostAdapter,
    uiScope: "workspace.default",
    availableScopes,
    activeScopeId: "workspace.secondary",
    fallbackScopeId: "workspace.fallback",
  });
  assert.equal(activeScopeResult.ok, true);
  assert.equal(activeScopeResult.uiScope, "workspace.secondary");
  assert.deepEqual(activeScopeResult.availableScopes, availableScopes);
  assert.notEqual(activeScopeResult.availableScopes, availableScopes);
  activeScopeResult.availableScopes.push("mutated");
  assert.deepEqual(availableScopes, ["workspace.primary", "workspace.secondary", "workspace.fallback"]);

  const hostContextScopeResult = createTargetAppBootstrap({
    targetAppId: "neutral-app",
    hostAdapter,
    uiScope: "workspace.default",
    availableScopes,
    hostContext: {
      activeScopeId: "workspace.primary",
      fallbackScopeId: "workspace.fallback",
    },
  });
  assert.equal(hostContextScopeResult.ok, true);
  assert.equal(hostContextScopeResult.uiScope, "workspace.primary");

  const fallbackScopeResult = createTargetAppBootstrap({
    targetAppId: "neutral-app",
    hostAdapter,
    uiScope: "workspace.default",
    availableScopes,
    activeScopeId: "workspace.unknown",
    fallbackScopeId: "workspace.fallback",
  });
  assert.equal(fallbackScopeResult.ok, true);
  assert.equal(fallbackScopeResult.uiScope, "workspace.fallback");

  const unknownScopeResult = createTargetAppBootstrap({
    targetAppId: "neutral-app",
    hostAdapter,
    uiScope: "workspace.default",
    availableScopes,
    activeScopeId: "workspace.unknown",
    fallbackScopeId: "workspace.also-unknown",
  });
  assert.equal(unknownScopeResult.ok, true);
  assert.equal(unknownScopeResult.uiScope, "workspace.default");

  const noActiveScopeResult = createTargetAppBootstrap({
    targetAppId: "neutral-app",
    hostAdapter,
    uiScope: "workspace.default",
    availableScopes,
    fallbackScopeId: "workspace.fallback",
  });
  assert.equal(noActiveScopeResult.ok, true);
  assert.equal(noActiveScopeResult.uiScope, "workspace.fallback");

  const legacyScopeResult = createTargetAppBootstrap({
    targetAppId: "neutral-app",
    hostAdapter,
    uiScope: "workspace.default",
  });
  assert.equal(legacyScopeResult.ok, true);
  assert.equal(legacyScopeResult.uiScope, "workspace.default");

  assert.deepEqual(availableScopes, ["workspace.primary", "workspace.secondary", "workspace.fallback"]);

  const moduleText = fs.readFileSync(MODULE_PATH, "utf8");
  assertNoForbiddenFragments(moduleText, "target-app-bootstrap");

  console.log("TESTS OK: target-app-bootstrap");
}

run();
