"use strict";

const { SelectionContractErrorCodes } = require("./selectionTargetContract.js");

const SELECTION_CONTROLLER_METHODS = Object.freeze([
  "start",
  "stop",
  "destroy",
  "isActive",
  "getState",
  "refreshHover",
  "syncWithSelection",
]);

const SELECTION_HOST_REQUIRED_METHODS = Object.freeze([
  "getElementRef",
  "getSelectedElementId",
  "selectElement",
]);

function createResult(errors) {
  return Object.freeze({ ok: errors.length === 0, errors });
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateOptionalFunction(host, name, errors) {
  if (host[name] !== undefined && typeof host[name] !== "function") {
    errors.push({ code: SelectionContractErrorCodes.INVALID_HOST_CALLBACK, method: name, message: `${name} muss eine Funktion sein, falls gesetzt.` });
  }
}

function validateSelectionHost(host) {
  const errors = [];
  if (!isObject(host)) {
    return createResult([{ code: SelectionContractErrorCodes.INVALID_HOST, message: "SelectionHost muss ein Objekt sein." }]);
  }

  SELECTION_HOST_REQUIRED_METHODS.forEach((method) => {
    if (typeof host[method] !== "function") {
      errors.push({ code: SelectionContractErrorCodes.MISSING_HOST_METHOD, method, message: `SelectionHost muss ${method}() bereitstellen.` });
    }
  });

  [
    "listSelectableElementIds",
    "listSelectableTargets",
    "getElementMeta",
    "isExcludedTarget",
    "onStateChange",
    "onSelection",
    "onError",
    "getInteractionRoot",
  ].forEach((method) => validateOptionalFunction(host, method, errors));

  if (typeof host.listSelectableElementIds !== "function" && typeof host.listSelectableTargets !== "function") {
    errors.push({ code: SelectionContractErrorCodes.MISSING_HOST_METHOD, method: "listSelectableElementIds", message: "SelectionHost muss listSelectableElementIds() oder listSelectableTargets() bereitstellen." });
  }

  return createResult(errors);
}

function validateSelectionControllerContract(controller) {
  const errors = [];
  if (!isObject(controller)) {
    return createResult([{ code: SelectionContractErrorCodes.INVALID_CONTROLLER, message: "SelectionController muss ein Objekt sein." }]);
  }

  SELECTION_CONTROLLER_METHODS.forEach((method) => {
    if (typeof controller[method] !== "function") {
      errors.push({ code: SelectionContractErrorCodes.MISSING_CONTROLLER_METHOD, method, message: `SelectionController muss ${method}() bereitstellen.` });
    }
  });

  return createResult(errors);
}

function normalizeSelectedElementId(value) {
  if (value == null) {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const selectedElementId = value.trim();
  return selectedElementId === "" ? null : selectedElementId;
}

function readSelectedElementId(host) {
  if (!host || typeof host.getSelectedElementId !== "function") {
    return null;
  }

  try {
    return normalizeSelectedElementId(host.getSelectedElementId());
  } catch (_error) {
    return null;
  }
}

function createSelectionStateSnapshot(host, partialState) {
  const selectedElementId = readSelectedElementId(host);
  const state = partialState || {};
  return Object.freeze({
    active: Boolean(state.active),
    hoveredElementId: state.hoveredElementId || null,
    selectedElementId,
    boundTargetCount: Number.isFinite(state.boundTargetCount) ? state.boundTargetCount : 0,
    unavailableElementIds: Array.isArray(state.unavailableElementIds) ? state.unavailableElementIds.slice() : [],
  });
}

module.exports = {
  SELECTION_CONTROLLER_METHODS,
  SELECTION_HOST_REQUIRED_METHODS,
  validateSelectionHost,
  validateSelectionControllerContract,
  createSelectionStateSnapshot,
};
