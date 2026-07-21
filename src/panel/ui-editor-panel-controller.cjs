"use strict";
const { RUNTIME_ERROR_CODES } = require("../runtime/runtime-error-codes.cjs");
const { PANEL_MODES } = require("./panel-intents.cjs");
const { createPanelMessageCatalog } = require("./panel-message-catalog.cjs");

const PANEL_ERROR_CODES = Object.freeze({
  NO_SELECTION: "NO_SELECTION",
  CURRENT_VALUE_UNAVAILABLE: "CURRENT_VALUE_UNAVAILABLE",
  INVALID_DIALOG_STATE: "INVALID_DIALOG_STATE",
  BUSY: "BUSY",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
});

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function isFn(source, name) {
  return Boolean(source) && typeof source[name] === "function";
}

function blocked(code, reason, details) {
  return { ok: false, blocked: true, code, messageKey: code, ...(reason ? { reason } : {}), ...(details ? { details } : {}) };
}

function okWithCode(result, successCode) {
  if (result && result.ok === false) return result;
  return { ...(result || { ok: true }), ok: true, code: successCode, messageKey: successCode };
}

function opsFor(element) {
  const allowedOps = Array.isArray(element && element.allowedOps) ? element.allowedOps.slice() : [];
  const lockedOps = Array.isArray(element && element.lockedOps) ? element.lockedOps : [];
  const sourceEffective = Array.isArray(element && element.effectiveOps) ? element.effectiveOps : allowedOps;
  return {
    allowedOps,
    effectiveOps: sourceEffective.filter((operation) => !lockedOps.includes(operation)),
  };
}

function modesFrom(effectiveOps) {
  const modes = [];
  if (effectiveOps.includes("move")) modes.push(PANEL_MODES.MOVE);
  if (effectiveOps.includes("resize")) modes.push(PANEL_MODES.WIDTH, PANEL_MODES.HEIGHT);
  return modes;
}

function createUiEditorPanelController(options) {
  const cfg = options || {};
  if (!cfg.runtime) throw new Error("runtime is required");
  if (!cfg.registry) throw new Error("registry is required");

  const runtime = cfg.runtime;
  const registry = cfg.registry;
  const messages = createPanelMessageCatalog(cfg.messages);
  const listeners = new Set();
  let destroyed = false;

  const state = {
    selectedElementId: null,
    selectedElementName: "",
    editable: false,
    allowedOps: [],
    effectiveOps: [],
    availableModes: [],
    mode: cfg.initialMode || PANEL_MODES.MOVE,
    stepSize: Number(cfg.stepSize) || 5,
    dialog: { open: false },
    lastResult: null,
    busy: false,
    runtimeStatus: null,
    persistenceStatus: { available: true, persistent: true },
    messages,
  };

  function emit() {
    if (!destroyed) listeners.forEach((listener) => listener(getState()));
  }

  function safeRegistryGet(elementId) {
    if (!isFn(registry, "getElementById")) {
      return blocked(RUNTIME_ERROR_CODES.INVALID_REGISTRY, "registry.getElementById is required.");
    }
    try {
      return { ok: true, value: registry.getElementById(elementId) };
    } catch (error) {
      return blocked(RUNTIME_ERROR_CODES.REGISTRY_READ_FAILED, error.message || "registry read failed.");
    }
  }

  function refreshStatus() {
    if (isFn(runtime, "getSessionStatus")) {
      try {
        const status = runtime.getSessionStatus();
        if (status && status.ok !== false) {
          state.runtimeStatus = {
            active: !!status.active,
            changedCount: status.changedCount || 0,
            changedElementIds: status.changedElementIds || [],
          };
        }
      } catch (error) {
        state.lastResult = blocked(PANEL_ERROR_CODES.UNKNOWN_ERROR, error.message);
      }
    }
    if (isFn(runtime, "getPersistenceStatus")) {
      try {
        state.persistenceStatus = runtime.getPersistenceStatus();
      } catch (error) {
        state.persistenceStatus = { available: false, persistent: false, code: RUNTIME_ERROR_CODES.STORAGE_UNAVAILABLE };
        state.lastResult = blocked(PANEL_ERROR_CODES.UNKNOWN_ERROR, error.message);
      }
    }
    return state.runtimeStatus;
  }

  function applySelection(element, inspectResult) {
    const inspectedOps = inspectResult && inspectResult.ok !== false
      ? { allowedOps: inspectResult.allowedOps, effectiveOps: inspectResult.effectiveOps }
      : {};
    const operationState = opsFor({ ...element, ...inspectedOps });
    state.selectedElementId = element.id;
    state.selectedElementName = element.name || element.id;
    state.editable = element.editable !== false;
    state.allowedOps = operationState.allowedOps;
    state.effectiveOps = operationState.effectiveOps;
    state.availableModes = state.editable ? modesFrom(operationState.effectiveOps) : [];
    if (!state.availableModes.includes(state.mode)) state.mode = state.availableModes[0] || PANEL_MODES.MOVE;
  }

  function getState() {
    refreshStatus();
    return clone({ ...state, messages });
  }

  function setLast(result, successCode) {
    state.lastResult = okWithCode(result, successCode);
    if (state.lastResult.rollbackComplete === false) state.lastResult.messageKey = "ROLLBACK_INCOMPLETE";
    refreshStatus();
  }

  async function run(operation, successCode) {
    if (state.busy) {
      state.lastResult = blocked(PANEL_ERROR_CODES.BUSY, "panel is busy.");
      emit();
      return getState();
    }
    state.busy = true;
    emit();
    try {
      setLast(await Promise.resolve().then(operation), successCode);
    } catch (error) {
      state.lastResult = blocked(PANEL_ERROR_CODES.UNKNOWN_ERROR, error.message || "unknown error.", { message: error.message });
    } finally {
      state.busy = false;
      emit();
    }
    return getState();
  }

  function inspectSelected() {
    if (!state.selectedElementId) return blocked(PANEL_ERROR_CODES.NO_SELECTION, "no element selected.");
    if (!isFn(runtime, "inspectElement")) {
      return blocked(PANEL_ERROR_CODES.UNKNOWN_ERROR, "runtime.inspectElement is required.");
    }
    try {
      return runtime.inspectElement(state.selectedElementId);
    } catch (error) {
      return blocked(PANEL_ERROR_CODES.UNKNOWN_ERROR, error.message || "inspect failed.");
    }
  }

  function effectiveLayoutFrom(inspectResult) {
    return clone(
      inspectResult.effectiveLayout ||
      inspectResult.currentValues ||
      (inspectResult.value && (inspectResult.value.effectiveLayout || inspectResult.value.currentValues)) ||
      inspectResult.currentEntry ||
      (inspectResult.value && inspectResult.value.currentEntry) ||
      { elementId: state.selectedElementId }
    );
  }

  function minFor(field) {
    const elementResult = safeRegistryGet(state.selectedElementId);
    if (!elementResult.ok) return elementResult;
    const value = elementResult.value && elementResult.value[field];
    return { ok: true, value: Number.isFinite(value) ? value : 1 };
  }

  function createChange(direction) {
    if (!state.selectedElementId) return blocked(PANEL_ERROR_CODES.NO_SELECTION, "no element selected.");
    if (!state.availableModes.includes(state.mode)) return blocked(RUNTIME_ERROR_CODES.OPERATION_NOT_ALLOWED, "operation is not allowed.");

    const inspected = inspectSelected();
    if (inspected && inspected.ok === false) return inspected;
    const layout = effectiveLayoutFrom(inspected);
    const step = state.stepSize;
    let payload = {};

    if (state.mode === PANEL_MODES.MOVE) {
      if (direction === "left") payload = { x: (Number.isFinite(layout.x) ? layout.x : 0) - step };
      else if (direction === "right") payload = { x: (Number.isFinite(layout.x) ? layout.x : 0) + step };
      else if (direction === "up") payload = { y: (Number.isFinite(layout.y) ? layout.y : 0) - step };
      else if (direction === "down") payload = { y: (Number.isFinite(layout.y) ? layout.y : 0) + step };
      else return blocked(RUNTIME_ERROR_CODES.OPERATION_NOT_ALLOWED, "direction is not allowed for move.");
      return runtime.applyChange({ elementId: state.selectedElementId, operation: "move", payload, source: "ui-editor-panel", changeId: `ui-editor-panel:${Date.now()}`, createdAt: new Date().toISOString() });
    }

    if (state.mode === PANEL_MODES.WIDTH) {
      if (!["left", "right"].includes(direction)) return blocked(RUNTIME_ERROR_CODES.OPERATION_NOT_ALLOWED, "direction is not allowed for width.");
      if (!Number.isFinite(layout.width)) return blocked(PANEL_ERROR_CODES.CURRENT_VALUE_UNAVAILABLE, "current width is unavailable.", { field: "width" });
      const min = minFor("minWidth");
      if (!min.ok) return min;
      const width = layout.width + (direction === "left" ? -step : step);
      if (width < min.value) return blocked("MIN_SIZE_REACHED", "minimum width reached.", { field: "width", min: min.value });
      payload = { width };
      if (Number.isFinite(layout.height)) payload.height = layout.height;
      return runtime.applyChange({ elementId: state.selectedElementId, operation: "resize", payload, source: "ui-editor-panel", changeId: `ui-editor-panel:${Date.now()}`, createdAt: new Date().toISOString() });
    }

    if (state.mode === PANEL_MODES.HEIGHT) {
      if (!["up", "down"].includes(direction)) return blocked(RUNTIME_ERROR_CODES.OPERATION_NOT_ALLOWED, "direction is not allowed for height.");
      if (!Number.isFinite(layout.height)) return blocked(PANEL_ERROR_CODES.CURRENT_VALUE_UNAVAILABLE, "current height is unavailable.", { field: "height" });
      const min = minFor("minHeight");
      if (!min.ok) return min;
      const height = layout.height + (direction === "up" ? -step : step);
      if (height < min.value) return blocked("MIN_SIZE_REACHED", "minimum height reached.", { field: "height", min: min.value });
      payload = { height };
      if (Number.isFinite(layout.width)) payload.width = layout.width;
      return runtime.applyChange({ elementId: state.selectedElementId, operation: "resize", payload, source: "ui-editor-panel", changeId: `ui-editor-panel:${Date.now()}`, createdAt: new Date().toISOString() });
    }

    return blocked(RUNTIME_ERROR_CODES.OPERATION_NOT_ALLOWED, "mode is not allowed.");
  }

  function invalidDialog() {
    state.lastResult = blocked(PANEL_ERROR_CODES.INVALID_DIALOG_STATE, "dialog is not open or has unexpected type.");
    emit();
    return getState();
  }

  return {
    selectElement(elementId) {
      const elementResult = safeRegistryGet(elementId);
      if (!elementResult.ok) {
        state.lastResult = elementResult;
        emit();
        return getState();
      }
      const element = elementResult.value;
      if (!element) {
        state.lastResult = blocked(RUNTIME_ERROR_CODES.UNKNOWN_ELEMENT, "unknown element.");
        emit();
        return getState();
      }
      const inspected = isFn(runtime, "inspectElement") ? (() => { try { return runtime.inspectElement(elementId); } catch (error) { return blocked(PANEL_ERROR_CODES.UNKNOWN_ERROR, error.message); } })() : null;
      applySelection(element, inspected);
      state.lastResult = inspected && inspected.ok === false ? inspected : null;
      emit();
      return getState();
    },
    clearSelection() {
      state.selectedElementId = null;
      state.selectedElementName = "";
      state.editable = false;
      state.allowedOps = [];
      state.effectiveOps = [];
      state.availableModes = [];
      state.lastResult = blocked(PANEL_ERROR_CODES.NO_SELECTION, "no element selected.");
      emit();
      return getState();
    },
    setMode(mode) {
      if (![PANEL_MODES.MOVE, PANEL_MODES.WIDTH, PANEL_MODES.HEIGHT].includes(mode) || !state.availableModes.includes(mode)) {
        state.lastResult = blocked(RUNTIME_ERROR_CODES.OPERATION_NOT_ALLOWED, "mode is not available.");
      } else {
        state.mode = mode;
      }
      emit();
      return getState();
    },
    setStepSize(stepSize) {
      state.stepSize = Math.max(1, Number(stepSize) || 5);
      emit();
      return getState();
    },
    activateDirection(direction) { return run(() => createChange(direction), "CHANGE_APPLIED"); },
    activateCenter() { return run(() => state.selectedElementId ? runtime.discardElementChanges(state.selectedElementId) : blocked(PANEL_ERROR_CODES.NO_SELECTION, "no element selected."), "ELEMENT_CHANGES_DISCARDED"); },
    save() { return run(() => runtime.saveLayout(), "LAYOUT_SAVED"); },
    load() { return run(() => runtime.loadLayout(), "LAYOUT_LOADED"); },
    discardAll() { return run(() => runtime.discardAllChanges(), "ALL_CHANGES_DISCARDED"); },
    requestResetElement() {
      if (!state.selectedElementId) state.lastResult = blocked(PANEL_ERROR_CODES.NO_SELECTION, "no element selected.");
      else state.dialog = { open: true, type: "reset-element", title: messages.get("RESET_ELEMENT_TITLE"), message: messages.get("RESET_ELEMENT_MESSAGE"), confirmLabel: "Element auf Standard zurücksetzen", cancelLabel: "Abbrechen", destructive: true, elementId: state.selectedElementId, elementName: state.selectedElementName };
      emit();
      return getState();
    },
    confirmResetElement() {
      if (!state.dialog || state.dialog.open !== true || state.dialog.type !== "reset-element" || typeof state.dialog.elementId !== "string") return invalidDialog();
      const elementId = state.dialog.elementId;
      state.dialog = { open: false };
      return run(() => runtime.resetElementToDefaults(elementId), "ELEMENT_RESET_TO_DEFAULTS");
    },
    cancelResetElement() { state.dialog = { open: false }; emit(); return getState(); },
    requestResetLayout() {
      state.dialog = { open: true, type: "reset-layout", title: messages.get("RESET_LAYOUT_TITLE"), message: messages.get("RESET_LAYOUT_MESSAGE"), confirmLabel: "Standardlayout wiederherstellen", cancelLabel: "Abbrechen", destructive: true };
      emit();
      return getState();
    },
    confirmResetLayout() {
      if (!state.dialog || state.dialog.open !== true || state.dialog.type !== "reset-layout") return invalidDialog();
      state.dialog = { open: false };
      return run(() => runtime.resetLayoutToDefaults(), "LAYOUT_RESET_TO_DEFAULTS");
    },
    cancelResetLayout() { state.dialog = { open: false }; emit(); return getState(); },
    refresh() { refreshStatus(); emit(); return getState(); },
    getState,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    destroy() { destroyed = true; listeners.clear(); },
  };
}

module.exports = { createUiEditorPanelController, PANEL_ERROR_CODES };
