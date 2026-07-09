"use strict";

const { getEditorStatusMessage } = require("./editor-status-messages.cjs");

function cloneValue(value) { if (Array.isArray(value)) return value.map(cloneValue); if (value && typeof value === "object") { const clone = {}; Object.keys(value).forEach((key) => { clone[key] = cloneValue(value[key]); }); return clone; } return value; }
function list(value) { return Array.isArray(value) ? value.map(cloneValue) : []; }
function hasFunction(source, name) { return Boolean(source) && typeof source === "object" && typeof source[name] === "function"; }

function elementMatchesScope(element, scope) {
  if (!scope || !element || typeof element !== "object") return true;
  const elementUiScope = element.uiScope || element.scope || null;
  const elementLayoutScope = element.layoutScope || null;
  if (!elementUiScope && !elementLayoutScope) return true;
  return elementUiScope === scope.uiScope || elementLayoutScope === scope.layoutScope;
}

function getOperationState(allowedOps, lockedOps, operation) {
  if (!operation) return null;
  if (lockedOps.includes(operation)) return "operation_locked";
  if (!allowedOps.includes(operation)) return "operation_not_allowed";
  return "available";
}

function createEditorSelectionViewModel(editorCore, selectedElementId, options) {
  const safeOptions = options && typeof options === "object" && !Array.isArray(options) ? options : {};
  if (!selectedElementId) {
    return { ok: false, status: "no_selection", message: getEditorStatusMessage("no_selection"), selectedElementId: null, selectedElementName: null, availableOperations: [], lockedOperations: [], allowedOperations: [], operationState: null };
  }
  if (!hasFunction(editorCore, "getElementDetails") || !hasFunction(editorCore, "getElementOperations")) {
    throw new TypeError("Selection-ViewModel erwartet einen Editor-Core mit Elementdetails und Operationen.");
  }
  const element = editorCore.getElementDetails(selectedElementId);
  if (element === null) {
    return { ok: false, status: "unknown_element", message: getEditorStatusMessage("unknown_element"), selectedElementId, selectedElementName: null, availableOperations: [], lockedOperations: [], allowedOperations: [], operationState: null };
  }
  if (!elementMatchesScope(element, safeOptions.scope)) {
    return { ok: false, status: "wrong_scope", message: getEditorStatusMessage("wrong_scope"), selectedElementId, selectedElementName: element.name || null, availableOperations: [], lockedOperations: [], allowedOperations: [], operationState: null };
  }
  const operations = editorCore.getElementOperations(selectedElementId) || {};
  const allowedOperations = list(operations.allowedOps);
  const lockedOperations = list(operations.lockedOps);
  const availableOperations = list(operations.availableOps);
  const operationState = getOperationState(allowedOperations, lockedOperations, safeOptions.operation);
  return {
    ok: operationState === null || operationState === "available",
    status: operationState || "selected",
    message: operationState ? getEditorStatusMessage(operationState) : "Element ist ausgewaehlt.",
    selectedElementId,
    selectedElementName: element.name || null,
    element: cloneValue(element),
    availableOperations,
    lockedOperations,
    allowedOperations,
    operationState,
  };
}

function clearEditorSelectionForScopeChange(previousSelection, nextScope) {
  return { ok: true, status: "scope_changed", message: "Scope-Wechsel hat die Auswahl geleert.", previousSelectedElementId: previousSelection || null, selectedElementId: null, uiScope: nextScope && nextScope.uiScope || null, layoutScope: nextScope && nextScope.layoutScope || null };
}

module.exports = { createEditorSelectionViewModel, clearEditorSelectionForScopeChange };
