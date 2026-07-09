"use strict";

const { getEditorStatusMessage } = require("./editor-status-messages.cjs");

function cloneValue(value) {
  if (Array.isArray(value)) return value.map((entry) => cloneValue(entry));
  if (value && typeof value === "object") {
    const clone = {};
    Object.keys(value).forEach((key) => { clone[key] = cloneValue(value[key]); });
    return clone;
  }
  return value;
}

function asList(value) {
  return Array.isArray(value) ? value.map((entry) => cloneValue(entry)) : [];
}

function firstErrorCode(errors) {
  return errors.length > 0 && typeof errors[0].code === "string" ? errors[0].code : null;
}

function createEditorRuntimeStatusViewModel(runtimeStatus, options) {
  const status = runtimeStatus && typeof runtimeStatus === "object" && !Array.isArray(runtimeStatus) ? runtimeStatus : {};
  const safeOptions = options && typeof options === "object" && !Array.isArray(options) ? options : {};
  const errors = asList(status.errors);
  const blockCode = status.blocked || firstErrorCode(errors) || null;
  const selectedElement = safeOptions.selectedElement && typeof safeOptions.selectedElement === "object" ? safeOptions.selectedElement : null;
  const selectedElementId = status.selectedElementId || (selectedElement && selectedElement.id) || null;

  return {
    ok: Boolean(status.ok) && !blockCode,
    blocked: Boolean(blockCode),
    blockCode,
    message: blockCode ? getEditorStatusMessage(blockCode) : "Runtime ist bereit.",
    targetAppId: status.targetAppId || null,
    adapterName: status.adapterName || null,
    uiScope: status.uiScope || null,
    layoutScope: status.layoutScope || null,
    registryElementCount: Number.isInteger(status.registryElementCount) ? status.registryElementCount : 0,
    selectedElementId,
    selectedElementName: selectedElement && typeof selectedElement.name === "string" ? selectedElement.name : null,
    availableOperations: asList(status.availableOperations),
    lockedOperations: asList(status.lockedOperations),
    errors,
  };
}

module.exports = { createEditorRuntimeStatusViewModel };
