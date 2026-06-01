#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const MODULE_PATH = path.join(REPO_ROOT, "src/core/target-app-test-host-flow.cjs");
const { createUiElementRegistry } = require(path.join(REPO_ROOT, "src/core/ui-element-registry.cjs"));
const {
  createTargetAppTestHostFlow,
  getTargetAppTestHostFlowRequiredOptions,
  getTargetAppTestHostFlowOptionalOptions,
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
      name: "Main Area",
      type: "area",
      role: "layout",
      parentId: "workspace.root",
      order: 1,
      visible: true,
      editable: true,
      allowedOps: ["inspect", "move", "resize", "rename"],
      lockedOps: ["hide"],
    },
  ].forEach((element) => registry.registerElement(element));
  return registry;
}

function changeRequest(overrides) {
  return {
    changeId: "change-001",
    elementId: "workspace.main.area",
    operation: "resize",
    payload: {
      width: 320,
    },
    createdAt: "2026-01-02T03:04:05.000Z",
    source: "target-app-test-host-flow-test",
    ...overrides,
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
  assert.equal(typeof createTargetAppTestHostFlow, "function");
  assert.equal(typeof getTargetAppTestHostFlowRequiredOptions, "function");
  assert.equal(typeof getTargetAppTestHostFlowOptionalOptions, "function");

  const requiredOptions = getTargetAppTestHostFlowRequiredOptions();
  assert.deepEqual(requiredOptions, ["targetAppId", "registry", "changeRequest"]);
  requiredOptions.push("mutated");
  assert.deepEqual(getTargetAppTestHostFlowRequiredOptions(), ["targetAppId", "registry", "changeRequest"]);

  const optionalOptions = getTargetAppTestHostFlowOptionalOptions();
  assert.deepEqual(optionalOptions, ["layoutProfileId", "uiScope", "initialLayoutState", "initialUiState"]);
  optionalOptions.push("mutated");
  assert.deepEqual(getTargetAppTestHostFlowOptionalOptions(), [
    "layoutProfileId",
    "uiScope",
    "initialLayoutState",
    "initialUiState",
  ]);

  assertFailure(createTargetAppTestHostFlow(), "invalid_target_app_test_host_flow_options");
  assertFailure(createTargetAppTestHostFlow({ registry: createValidRegistry(), changeRequest: changeRequest() }), "invalid_target_app_test_host_flow_options");
  assertFailure(createTargetAppTestHostFlow({ targetAppId: "neutral-app", changeRequest: changeRequest() }), "missing_registry");
  assertFailure(createTargetAppTestHostFlow({ targetAppId: "neutral-app", registry: createValidRegistry() }), "missing_change_request");

  const initialLayoutState = {
    selected: { elementId: "workspace.main.area" },
    panels: [{ id: "tree", width: 280 }],
  };
  const validResult = createTargetAppTestHostFlow({
    targetAppId: "neutral-app",
    registry: createValidRegistry(),
    changeRequest: changeRequest(),
    layoutProfileId: "neutral-layout",
    uiScope: "workspace",
    initialLayoutState,
    initialUiState: { selectedElementId: "workspace.main.area", expandedElementIds: ["workspace.root"] },
  });

  assert.equal(validResult.ok, true);
  assert.deepEqual(validResult.errors, []);
  assert.equal(validResult.targetAppId, "neutral-app");
  assert.equal(validResult.layoutProfileId, "neutral-layout");
  assert.equal(validResult.uiScope, "workspace");
  assert.equal(typeof validResult.bootstrap, "object");
  assert.equal(validResult.bootstrap.ok, true);
  assert.equal(typeof validResult.bootstrap.editorCore, "object");
  assert.equal(typeof validResult.treeViewModel, "object");
  assert.equal(validResult.treeViewModel.root.id, "workspace.root");
  assert.equal(typeof validResult.detailsViewModel, "object");
  assert.equal(validResult.detailsViewModel.elementId, "workspace.main.area");
  assert.equal(typeof validResult.changeDraftViewModel, "object");
  assert.equal(validResult.changeDraftViewModel.validation.ok, true);
  assert.equal(validResult.changeDraftViewModel.canSubmit, true);
  assert.equal(typeof validResult.submitResult, "object");
  assert.equal(validResult.submitResult.executed, false);
  assert.equal(validResult.submitResult.accepted, true);
  assert.equal(validResult.submittedChangeRequests.length, 1);
  assert.deepEqual(validResult.submittedChangeRequests[0], changeRequest());
  assert.deepEqual(validResult.bootstrap.layoutState, initialLayoutState);
  assert.deepEqual(validResult.capabilities, {
    hasBootstrap: true,
    hasTreeViewModel: true,
    hasDetailsViewModel: true,
    hasChangeDraftViewModel: true,
    canSubmit: true,
    didSubmitToTestHost: true,
    executed: false,
  });

  const deniedResult = createTargetAppTestHostFlow({
    targetAppId: "neutral-app",
    registry: createValidRegistry(),
    changeRequest: changeRequest({ operation: "hide" }),
  });
  assert.equal(deniedResult.ok, false);
  assert.equal(deniedResult.capabilities.canSubmit, false);
  assert.equal(deniedResult.submitResult, null);
  assert.equal(deniedResult.submittedChangeRequests.length, 0);
  assertFailure(deniedResult, "change_draft_not_submittable");
  assert.equal(deniedResult.changeDraftViewModel.validation.errors.some((error) => error.code === "operation_not_allowed"), true);

  const unknownElementResult = createTargetAppTestHostFlow({
    targetAppId: "neutral-app",
    registry: createValidRegistry(),
    changeRequest: changeRequest({ elementId: "workspace.unknown" }),
  });
  assert.equal(unknownElementResult.ok, false);
  assert.equal(unknownElementResult.capabilities.canSubmit, false);
  assert.equal(unknownElementResult.detailsViewModel, null);
  assert.equal(unknownElementResult.submitResult, null);
  assert.equal(unknownElementResult.submittedChangeRequests.length, 0);
  assert.equal(unknownElementResult.changeDraftViewModel.validation.errors.some((error) => error.code === "unknown_element"), true);

  const treeSnapshot = JSON.stringify(validResult.treeViewModel);
  validResult.treeViewModel.root.id = "mutated";
  validResult.treeViewModel.nodes[0].path.push("mutated");
  assert.equal(validResult.bootstrap.treeViewModel.root.id, "workspace.root");
  assert.notEqual(JSON.stringify(validResult.bootstrap.treeViewModel), JSON.stringify(validResult.treeViewModel));
  assert.equal(treeSnapshot.includes("workspace.root"), true);

  validResult.submittedChangeRequests[0].payload.width = 999;
  const freshResult = createTargetAppTestHostFlow({
    targetAppId: "neutral-app",
    registry: createValidRegistry(),
    changeRequest: changeRequest(),
  });
  assert.equal(freshResult.submittedChangeRequests[0].payload.width, 320);
  assert.equal(freshResult.submitResult.executed, false);
  assert.equal(freshResult.capabilities.executed, false);

  const moduleText = fs.readFileSync(MODULE_PATH, "utf8");
  assertNoForbiddenFragments(moduleText, "target-app-test-host-flow");
  [
    "fs",
    "child_process",
    "express",
    "react",
    "vue",
    "svelte",
    "document",
    "window",
    "localStorage",
    "indexedDB",
    "sql",
    "database",
    "executeChange",
    "saveLayoutState",
  ].forEach((fragment) => {
    assert.equal(moduleText.includes(fragment), false, `Unzulaessiges Fragment: ${fragment}`);
  });

  console.log("TESTS OK: target-app-test-host-flow");
}

run();
