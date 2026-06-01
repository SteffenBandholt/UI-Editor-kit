"use strict";

const { createUiElementRegistry } = require("./ui-element-registry.cjs");
const { createChangeRequest } = require("./change-request-model.cjs");
const { createTestHostAdapter } = require("./test-host-adapter.cjs");
const { createTargetAppBootstrap } = require("./target-app-bootstrap.cjs");
const { createTargetAppTestHostFlow } = require("./target-app-test-host-flow.cjs");

const NEUTRAL_MINIMAL_TARGET_APP_ID = "neutral-minimal-host";
const NEUTRAL_MINIMAL_LAYOUT_PROFILE_ID = "neutral-minimal-layout";
const NEUTRAL_MINIMAL_UI_SCOPE = "workspace";

const NEUTRAL_MINIMAL_ELEMENTS = Object.freeze([
  Object.freeze({
    id: "workspace.root",
    name: "Workspace Root",
    type: "root",
    role: "layout",
    parentId: null,
    order: 0,
    visible: true,
    editable: false,
    allowedOps: Object.freeze(["inspect"]),
    lockedOps: Object.freeze(["move", "resize", "hide"]),
  }),
  Object.freeze({
    id: "workspace.header",
    name: "Workspace Header",
    type: "area",
    role: "layout",
    parentId: "workspace.root",
    order: 1,
    visible: true,
    editable: true,
    allowedOps: Object.freeze(["inspect", "resize"]),
    lockedOps: Object.freeze(["move", "hide", "reset"]),
  }),
  Object.freeze({
    id: "workspace.content",
    name: "Workspace Content",
    type: "area",
    role: "layout",
    parentId: "workspace.root",
    order: 2,
    visible: true,
    editable: true,
    allowedOps: Object.freeze(["inspect", "move", "resize"]),
    lockedOps: Object.freeze(["hide", "reset"]),
  }),
  Object.freeze({
    id: "workspace.sidebar",
    name: "Workspace Sidebar",
    type: "area",
    role: "layout",
    parentId: "workspace.root",
    order: 3,
    visible: true,
    editable: true,
    allowedOps: Object.freeze(["inspect", "move"]),
    lockedOps: Object.freeze(["hide", "resize", "reset"]),
  }),
]);

function cloneNeutralValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneNeutralValue(entry));
  }

  if (value && typeof value === "object") {
    const clone = {};
    Object.keys(value).forEach((key) => {
      clone[key] = cloneNeutralValue(value[key]);
    });
    return clone;
  }

  return value;
}

function isOptionsObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function createNeutralCapabilities(values) {
  return {
    hasRegistry: Boolean(values && values.hasRegistry),
    hasHostAdapter: Boolean(values && values.hasHostAdapter),
    hasBootstrap: Boolean(values && values.hasBootstrap),
    hasEditorCore: Boolean(values && values.hasEditorCore),
    hasTreeViewModel: Boolean(values && values.hasTreeViewModel),
    canSubmit: Boolean(values && values.canSubmit),
    didSubmitToTestHost: Boolean(values && values.didSubmitToTestHost),
    executed: Boolean(values && values.executed),
    storesLayout: false,
    connectsExternalTarget: false,
  };
}

function createNeutralMinimalRegistry() {
  const registry = createUiElementRegistry();
  NEUTRAL_MINIMAL_ELEMENTS.forEach((element) => {
    registry.registerElement(cloneNeutralValue(element));
  });
  return registry;
}

function getNeutralMinimalHostElementIds() {
  return NEUTRAL_MINIMAL_ELEMENTS.map((element) => element.id);
}

function getNeutralMinimalHostAllowedOperations() {
  return NEUTRAL_MINIMAL_ELEMENTS.reduce((operationsByElementId, element) => {
    operationsByElementId[element.id] = {
      allowedOps: element.allowedOps.slice(),
      lockedOps: element.lockedOps.slice(),
    };
    return operationsByElementId;
  }, {});
}

function createNeutralMinimalChangeRequest(values) {
  const safeValues = isOptionsObject(values) ? values : {};
  return createChangeRequest({
    changeId: safeValues.changeId || "neutral-minimal-change-001",
    elementId: safeValues.elementId || "workspace.content",
    operation: safeValues.operation || "resize",
    payload: cloneNeutralValue(safeValues.payload || { size: "neutral" }),
    createdAt: safeValues.createdAt || "2026-06-01T00:00:00.000Z",
    source: safeValues.source || "neutral-minimal-host",
    note: safeValues.note || "neutral-minimal-check",
  });
}

function createNeutralMinimalHost(options) {
  const safeOptions = isOptionsObject(options) ? options : {};
  const targetAppId = safeOptions.targetAppId || NEUTRAL_MINIMAL_TARGET_APP_ID;
  const registry = createNeutralMinimalRegistry();
  const hostAdapter = createTestHostAdapter({
    registry,
    layoutState: cloneNeutralValue(safeOptions.initialLayoutState || {}),
  });
  const bootstrap = createTargetAppBootstrap({
    targetAppId,
    hostAdapter,
    layoutProfileId: safeOptions.layoutProfileId || NEUTRAL_MINIMAL_LAYOUT_PROFILE_ID,
    uiScope: safeOptions.uiScope || NEUTRAL_MINIMAL_UI_SCOPE,
    initialUiState: cloneNeutralValue(safeOptions.initialUiState),
  });

  return {
    ok: Boolean(bootstrap.ok),
    errors: Array.isArray(bootstrap.errors) ? bootstrap.errors.map((error) => cloneNeutralValue(error)) : [],
    targetAppId,
    registry,
    hostAdapter,
    bootstrap,
    capabilities: createNeutralCapabilities({
      hasRegistry: true,
      hasHostAdapter: true,
      hasBootstrap: Boolean(bootstrap),
      hasEditorCore: Boolean(bootstrap && bootstrap.editorCore),
      hasTreeViewModel: Boolean(bootstrap && bootstrap.treeViewModel),
      executed: false,
    }),
  };
}

function runNeutralMinimalHostFlow(options) {
  const safeOptions = isOptionsObject(options) ? options : {};
  const registry = createNeutralMinimalRegistry();
  const changeRequest = createNeutralMinimalChangeRequest(safeOptions.changeRequest);
  const flow = createTargetAppTestHostFlow({
    targetAppId: safeOptions.targetAppId || NEUTRAL_MINIMAL_TARGET_APP_ID,
    registry,
    changeRequest,
    layoutProfileId: safeOptions.layoutProfileId || NEUTRAL_MINIMAL_LAYOUT_PROFILE_ID,
    uiScope: safeOptions.uiScope || NEUTRAL_MINIMAL_UI_SCOPE,
    initialLayoutState: cloneNeutralValue(safeOptions.initialLayoutState || {}),
    initialUiState: cloneNeutralValue(safeOptions.initialUiState),
  });
  const executed = Boolean(flow && flow.submitResult && flow.submitResult.executed);
  const submittedChangeRequests = Array.isArray(flow && flow.submittedChangeRequests)
    ? flow.submittedChangeRequests.map((request) => cloneNeutralValue(request))
    : [];

  return {
    ok: Boolean(flow && flow.ok && executed === false),
    errors: Array.isArray(flow && flow.errors) ? flow.errors.map((error) => cloneNeutralValue(error)) : [],
    flow,
    submittedChangeRequests,
    executed,
    capabilities: createNeutralCapabilities({
      hasRegistry: true,
      hasHostAdapter: true,
      hasBootstrap: Boolean(flow && flow.bootstrap),
      hasEditorCore: Boolean(flow && flow.bootstrap && flow.bootstrap.editorCore),
      hasTreeViewModel: Boolean(flow && flow.treeViewModel),
      canSubmit: Boolean(flow && flow.capabilities && flow.capabilities.canSubmit),
      didSubmitToTestHost: submittedChangeRequests.length > 0,
      executed,
    }),
  };
}

module.exports = {
  createNeutralMinimalHost,
  createNeutralMinimalRegistry,
  createNeutralMinimalChangeRequest,
  runNeutralMinimalHostFlow,
  getNeutralMinimalHostElementIds,
  getNeutralMinimalHostAllowedOperations,
};
