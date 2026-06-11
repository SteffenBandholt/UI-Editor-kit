#!/usr/bin/env node

const assert = require("node:assert/strict");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const PREVIEW_RUNTIME_PATH = path.join(REPO_ROOT, "src/runtime/preview/index.cjs");

function createNode(id = "", parentElement = null) {
  return {
    parentElement,
    attributes: id ? { "data-ui-editor-id": id } : {},
    getAttribute(name) {
      return Object.hasOwn(this.attributes, String(name)) ? this.attributes[String(name)] : null;
    },
  };
}

function createSampleState(registryElement) {
  return {
    activeUiScope: "sample.screen",
    selectedElement: registryElement,
    pendingChangeRequests: [],
    changeRequestSequence: 0,
  };
}

function createNextChangeRequestId(currentState) {
  currentState.changeRequestSequence += 1;
  return `preview-${currentState.changeRequestSequence}`;
}

function run() {
  const runtime = require(PREVIEW_RUNTIME_PATH);

  [
    "getElementAllowedOps",
    "getElementLockedOps",
    "getChangeRequestOperation",
    "isPreviewOperationAllowed",
    "getNodeUiEditorId",
    "findAncestorUiEditorElementById",
    "normalizePreviewTargetMode",
    "getPreviewTargetMode",
    "resolvePreviewTargetElement",
    "getPreviewTargetElement",
    "getPreviewTargetElementId",
    "upsertPreviewChangeRequest",
    "removePendingChangeRequestsForTarget",
    "getPendingChangeRequestSummary",
  ].forEach((exportName) => {
    assert.equal(typeof runtime[exportName], "function", `missing preview API export: ${exportName}`);
  });

  assert.equal(runtime.getChangeRequestOperation("resizeWidth"), "width");
  assert.equal(runtime.getChangeRequestOperation("resizeHeight"), "height");
  assert.equal(runtime.getChangeRequestOperation("hide"), "visibility");
  assert.equal(runtime.getChangeRequestOperation("show"), "visibility");

  assert.equal(runtime.isPreviewOperationAllowed({ allowedOps: ["inspect", "resize"], lockedOps: [] }, "resizeWidth"), true);
  assert.equal(runtime.isPreviewOperationAllowed({ allowedOps: ["inspect", "width"], lockedOps: [] }, "resizeWidth"), true);
  assert.equal(runtime.isPreviewOperationAllowed({ allowedOps: ["inspect", "width"], lockedOps: [] }, "resizeHeight"), false);
  assert.equal(runtime.isPreviewOperationAllowed({ allowedOps: ["inspect", "resize"], lockedOps: ["width"] }, "resizeWidth"), false);
  assert.equal(runtime.isPreviewOperationAllowed({ allowedOps: ["inspect", "resize", "width"], lockedOps: ["resize"] }, "resizeWidth"), true);
  assert.equal(runtime.isPreviewOperationAllowed({ allowedOps: ["inspect", "move"], lockedOps: ["move"] }, "move"), false);

  const root = createNode("sample.root");
  const field = createNode("sample.field", root);
  const input = createNode("sample.field.input", field);
  assert.equal(runtime.getPreviewTargetMode({ previewTargetMode: "self" }), "self");
  assert.equal(runtime.getPreviewTargetMode({ previewTarget: { mode: "container" } }), "parent");
  assert.equal(runtime.getPreviewTargetMode({ editGranularity: "unknown" }), "auto");
  assert.equal(runtime.getNodeUiEditorId(input), "sample.field.input");
  assert.equal(runtime.findAncestorUiEditorElementById(input, "sample.field"), field);
  assert.equal(runtime.resolvePreviewTargetElement({
    selectionElement: { id: "sample.field.input", parentId: "sample.field", previewTargetMode: "parent" },
    targetNode: input,
  }), field);
  assert.equal(runtime.resolvePreviewTargetElement({
    selectionElement: { id: "sample.field.input", parentId: "sample.field", previewTargetMode: "self" },
    targetNode: input,
  }), input);

  const registryElement = { id: "sample.field.input", previewTargetMode: "self" };
  const state = createSampleState(registryElement);
  const notifications = [];
  const upsert = (operation, payload) => runtime.upsertPreviewChangeRequest({
    state,
    registry: { targetAppId: "sample-app", moduleId: "sample", uiScope: "sample.screen" },
    registryElement,
    targetNode: input,
    operation,
    payload,
    getNextChangeRequestId: createNextChangeRequestId,
    notify(currentState) {
      notifications.push(currentState.pendingChangeRequests.length);
    },
  });

  upsert("move", { dx: 3, dy: 0 });
  upsert("move", { dx: 2, dy: 4 });
  upsert("resizeWidth", { delta: 5 });
  upsert("resizeWidth", { delta: -2 });
  upsert("resizeHeight", { delta: 7 });
  upsert("hide", {});
  upsert("show", {});

  assert.equal(state.pendingChangeRequests.length, 4);
  assert.deepEqual(state.pendingChangeRequests.find((request) => request.operation === "move").payload, { dx: 5, dy: 4 });
  assert.deepEqual(state.pendingChangeRequests.find((request) => request.operation === "width").payload, { delta: 3 });
  assert.deepEqual(state.pendingChangeRequests.find((request) => request.operation === "height").payload, { delta: 7 });
  assert.deepEqual(state.pendingChangeRequests.find((request) => request.operation === "visibility").payload, { visible: true });
  assert.equal(state.pendingChangeRequests.every((request) => request.source === "preview" && request.persistent === false), true);
  assert.deepEqual(
    runtime.getPendingChangeRequestSummary(state, "sample.field.input").operations.sort(),
    ["height", "move", "visibility", "width"]
  );

  const otherNode = createNode("sample.other");
  const otherElement = { id: "sample.other", previewTargetMode: "self" };
  runtime.upsertPreviewChangeRequest({
    state,
    registryElement: otherElement,
    targetNode: otherNode,
    operation: "move",
    payload: { dx: 1, dy: 1 },
    getNextChangeRequestId: createNextChangeRequestId,
  });
  const removed = runtime.removePendingChangeRequestsForTarget({
    state,
    targetNode: input,
    notify(currentState) {
      notifications.push(currentState.pendingChangeRequests.length);
    },
  });
  assert.equal(removed, 4);
  assert.equal(state.pendingChangeRequests.length, 1);
  assert.equal(state.pendingChangeRequests[0].targetElementId, "sample.other");
  assert.equal(notifications.length > 0, true);

  const hostState = createSampleState(registryElement);
  runtime.upsertPreviewChangeRequest({
    state: hostState,
    hostContext: { targetAppId: "sample-app", moduleId: "sample-host", scopeId: "sample.screen" },
    registry: { targetAppId: "registry-app", moduleId: "sample-registry", uiScope: "sample.registry" },
    registryElement,
    targetNode: input,
    operation: "move",
    payload: { dx: 1, dy: 0 },
    getNextChangeRequestId: createNextChangeRequestId,
  });
  assert.equal(hostState.pendingChangeRequests[0].targetAppId, "sample-app");
  assert.equal(hostState.pendingChangeRequests[0].moduleId, "sample-host");
  assert.equal(hostState.pendingChangeRequests[0].scopeId, "sample.screen");

  const fallbackState = createSampleState(registryElement);
  runtime.upsertPreviewChangeRequest({
    state: fallbackState,
    registry: {},
    registryElement,
    targetNode: input,
    operation: "move",
    payload: { dx: 1, dy: 0 },
    getNextChangeRequestId: createNextChangeRequestId,
  });
  assert.equal(fallbackState.pendingChangeRequests[0].targetAppId, "unknown-host");

  console.log("TESTS OK: preview-runtime");
}

run();
