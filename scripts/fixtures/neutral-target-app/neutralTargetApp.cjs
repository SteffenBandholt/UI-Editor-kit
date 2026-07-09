"use strict";

const { createEditorCore } = require("../../../src/core/editor-core.cjs");
const { createChangeRequest } = require("../../../src/core/change-request-model.cjs");
const { validateChangeRequest } = require("../../../src/core/change-request-validator.cjs");
const { createTargetAppAdapterManifest } = require("../../../src/core/target-app-adapter-manifest.cjs");

const TARGET_APP_INFO = Object.freeze({
  targetAppId: "neutral-target-app",
  targetAppName: "Neutral Target App",
  adapterName: "neutral-target-app-adapter",
  adapterVersion: "1.0.0",
});

const SCOPE_PAIRS = Object.freeze([
  Object.freeze({ uiScope: "scope.alpha", layoutScope: "layout.alpha" }),
  Object.freeze({ uiScope: "scope.beta", layoutScope: "layout.beta" }),
]);

const ELEMENTS_BY_SCOPE = Object.freeze({
  "scope.alpha": Object.freeze([
    Object.freeze({ id: "scope.alpha.root", name: "Alpha Root", type: "root", role: "layout", parentId: null, order: 0, visible: true, editable: false, allowedOps: ["inspect"], lockedOps: ["move", "resize", "hide", "reset"], uiScope: "scope.alpha", layoutScope: "layout.alpha" }),
    Object.freeze({ id: "scope.alpha.header", name: "Alpha Header", type: "area", role: "layout", parentId: "scope.alpha.root", order: 1, visible: true, editable: true, allowedOps: ["inspect", "resize"], lockedOps: ["move", "hide", "reset"], uiScope: "scope.alpha", layoutScope: "layout.alpha" }),
    Object.freeze({ id: "scope.alpha.group.primary", name: "Alpha Group", type: "group", role: "structure", parentId: "scope.alpha.root", order: 2, visible: true, editable: true, allowedOps: ["inspect", "move", "resize"], lockedOps: ["hide", "reset"], uiScope: "scope.alpha", layoutScope: "layout.alpha" }),
    Object.freeze({ id: "scope.alpha.field.title", name: "Alpha Field", type: "field", role: "content", parentId: "scope.alpha.group.primary", order: 3, visible: true, editable: true, allowedOps: ["inspect", "move", "resize"], lockedOps: ["hide", "rename", "reset"], uiScope: "scope.alpha", layoutScope: "layout.alpha" }),
    Object.freeze({ id: "scope.alpha.action.confirm", name: "Alpha Action", type: "button", role: "action", parentId: "scope.alpha.group.primary", order: 4, visible: true, editable: true, allowedOps: ["inspect", "move"], lockedOps: ["hide", "executeTargetAction", "modifyDomainData", "reset"], uiScope: "scope.alpha", layoutScope: "layout.alpha" }),
  ]),
  "scope.beta": Object.freeze([
    Object.freeze({ id: "scope.beta.root", name: "Beta Root", type: "root", role: "layout", parentId: null, order: 0, visible: true, editable: false, allowedOps: ["inspect"], lockedOps: ["move", "resize", "hide", "reset"], uiScope: "scope.beta", layoutScope: "layout.beta" }),
    Object.freeze({ id: "scope.beta.header", name: "Beta Header", type: "area", role: "layout", parentId: "scope.beta.root", order: 1, visible: true, editable: true, allowedOps: ["inspect", "resize"], lockedOps: ["move", "hide", "reset"], uiScope: "scope.beta", layoutScope: "layout.beta" }),
    Object.freeze({ id: "scope.beta.group.primary", name: "Beta Group", type: "group", role: "structure", parentId: "scope.beta.root", order: 2, visible: true, editable: true, allowedOps: ["inspect", "move", "resize"], lockedOps: ["hide", "reset"], uiScope: "scope.beta", layoutScope: "layout.beta" }),
    Object.freeze({ id: "scope.beta.field.title", name: "Beta Field", type: "field", role: "content", parentId: "scope.beta.group.primary", order: 3, visible: true, editable: true, allowedOps: ["inspect", "move", "resize"], lockedOps: ["hide", "rename", "reset"], uiScope: "scope.beta", layoutScope: "layout.beta" }),
    Object.freeze({ id: "scope.beta.action.confirm", name: "Beta Action", type: "button", role: "action", parentId: "scope.beta.group.primary", order: 4, visible: true, editable: true, allowedOps: ["inspect", "move"], lockedOps: ["hide", "executeTargetAction", "modifyDomainData", "reset"], uiScope: "scope.beta", layoutScope: "layout.beta" }),
  ]),
});

function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value && typeof value === "object") {
    const clone = {};
    Object.keys(value).forEach((key) => {
      clone[key] = cloneValue(value[key]);
    });
    return clone;
  }
  return value;
}

function getNeutralTargetAppInfo() {
  return cloneValue(TARGET_APP_INFO);
}

function getNeutralTargetAppScopes() {
  return cloneValue(SCOPE_PAIRS);
}

function resolveNeutralLayoutScope(uiScope) {
  const scopePair = SCOPE_PAIRS.find((entry) => entry.uiScope === uiScope);
  return scopePair ? scopePair.layoutScope : null;
}

function assertKnownUiScope(uiScope) {
  if (!resolveNeutralLayoutScope(uiScope)) {
    throw new Error(`Unknown neutral uiScope: ${String(uiScope)}`);
  }
}

function listElementsForScope(uiScope) {
  assertKnownUiScope(uiScope);
  return cloneValue(ELEMENTS_BY_SCOPE[uiScope]);
}

function createNeutralTargetAppRegistry(options) {
  const uiScope = options && options.uiScope ? options.uiScope : "scope.alpha";
  const elements = listElementsForScope(uiScope);

  return {
    getElementById(elementId) {
      return cloneValue(elements.find((element) => element.id === elementId) || null);
    },

    listElements() {
      return cloneValue(elements);
    },

    size() {
      return elements.length;
    },
  };
}

function createNeutralTargetAppAdapterManifest(options) {
  const safeOptions = options && typeof options === "object" && !Array.isArray(options) ? options : {};
  const uiScope = safeOptions.uiScope || "scope.alpha";
  const layoutScope = resolveNeutralLayoutScope(uiScope);
  assertKnownUiScope(uiScope);

  return createTargetAppAdapterManifest({
    targetAppId: TARGET_APP_INFO.targetAppId,
    adapterName: TARGET_APP_INFO.adapterName,
    adapterVersion: TARGET_APP_INFO.adapterVersion,
    uiScope,
    layoutScope,
    layoutProfileId: `${layoutScope}.profile`,
    supportedElementTypes: ["root", "area", "group", "field", "button"],
    supportedRoles: ["layout", "structure", "content", "action"],
    supportedOperations: ["inspect", "move", "resize"],
    lockedOperations: ["hide", "rename", "reset", "executeTargetAction", "modifyDomainData"],
    persistenceMode: safeOptions.layoutControls === false ? "none" : "memory-only",
    executionMode: "test-host",
    riskClass: "low",
    rollbackStrategy: "neutral-memory-reset",
    testStrategy: "neutral-fixture-contract-test",
    manifestVersion: "1.0",
    description: "Neutral target fixture for the official adapter contract.",
    uiToLayoutScope: SCOPE_PAIRS.reduce((mapping, entry) => {
      mapping[entry.uiScope] = entry.layoutScope;
      return mapping;
    }, {}),
    saveLayoutState: safeOptions.layoutControls !== false,
    loadLayoutState: safeOptions.layoutControls !== false,
    resetLayoutState: safeOptions.layoutControls !== false,
  });
}

function createInitialLayoutState(uiScope) {
  const layoutScope = resolveNeutralLayoutScope(uiScope);
  return {
    uiScope,
    layoutScope,
    version: 1,
    elements: listElementsForScope(uiScope).reduce((state, element) => {
      state[element.id] = { order: element.order, visible: element.visible };
      return state;
    }, {}),
  };
}

function createNeutralTargetAppHostAdapter(options) {
  const safeOptions = options && typeof options === "object" && !Array.isArray(options) ? options : {};
  const uiScope = safeOptions.uiScope || "scope.alpha";
  const layoutControls = safeOptions.layoutControls !== false;
  const registry = createNeutralTargetAppRegistry({ uiScope });
  const manifest = createNeutralTargetAppAdapterManifest({ uiScope, layoutControls });
  const editorCore = createEditorCore(registry);
  let layoutState = createInitialLayoutState(uiScope);
  let submittedChangeRequests = [];

  const hostAdapter = {
    getAdapterManifest() {
      return cloneValue(manifest);
    },

    getRegistry() {
      return registry;
    },

    getCurrentLayoutState() {
      return cloneValue(layoutState);
    },

    submitChangeRequest(changeRequest) {
      const normalizedChangeRequest = createChangeRequest(changeRequest);
      const validation = validateChangeRequest(normalizedChangeRequest, editorCore);
      if (!validation.ok) {
        return {
          ok: false,
          accepted: false,
          executed: false,
          errors: cloneValue(validation.errors),
        };
      }

      submittedChangeRequests.push(cloneValue(normalizedChangeRequest));
      return {
        ok: true,
        accepted: true,
        executed: false,
        errors: [],
      };
    },

    listSubmittedChangeRequests() {
      return cloneValue(submittedChangeRequests);
    },

    clearSubmittedChangeRequests() {
      submittedChangeRequests = [];
    },
  };

  if (layoutControls) {
    hostAdapter.saveLayoutState = function saveLayoutState(nextLayoutState) {
      if (nextLayoutState && typeof nextLayoutState === "object" && !Array.isArray(nextLayoutState)) {
        layoutState = cloneValue(nextLayoutState);
      }
      return { ok: true, accepted: true, layoutScope: manifest.layoutScope };
    };

    hostAdapter.loadLayoutState = function loadLayoutState() {
      return cloneValue(layoutState);
    };

    hostAdapter.resetLayoutState = function resetLayoutState() {
      layoutState = createInitialLayoutState(uiScope);
      return { ok: true, accepted: true, layoutScope: manifest.layoutScope };
    };
  }

  return hostAdapter;
}

function createNeutralTargetApp(options) {
  const safeOptions = options && typeof options === "object" && !Array.isArray(options) ? options : {};
  const uiScope = safeOptions.uiScope || "scope.alpha";
  return {
    info: getNeutralTargetAppInfo(),
    scopes: getNeutralTargetAppScopes(),
    manifest: createNeutralTargetAppAdapterManifest(safeOptions),
    registry: createNeutralTargetAppRegistry({ uiScope }),
    hostAdapter: createNeutralTargetAppHostAdapter(safeOptions),
  };
}

module.exports = {
  getNeutralTargetAppInfo,
  getNeutralTargetAppScopes,
  resolveNeutralLayoutScope,
  listElementsForScope,
  createNeutralTargetAppRegistry,
  createNeutralTargetAppAdapterManifest,
  createNeutralTargetAppHostAdapter,
  createNeutralTargetApp,
};
