"use strict";

const { createEditorTreeViewModel } = require("../core/editor-ui-tree-view-model.cjs");
const { createEditorDetailsViewModel } = require("../core/editor-ui-details-view-model.cjs");
const { createUiEditorPanelController } = require("../panel/ui-editor-panel-controller.cjs");
const { createUiEditorPanelViewModel } = require("../panel/ui-editor-panel-view-model.cjs");
const { PANEL_LAYERS, PANEL_MODES } = require("../panel/panel-intents.cjs");

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function currentEntry(sessionState, elementId) {
  return sessionState.getSessionEntries().find((entry) => entry.elementId === elementId) || { elementId };
}

function createEditorUiSession(options) {
  const cfg = options || {};
  if (!cfg.editorCore || !cfg.registry || !cfg.sessionState) throw new TypeError("Editor-UI-Session benoetigt Core, Registry und SessionState.");

  const editorCore = cfg.editorCore;
  const registry = cfg.registry;
  const sessionState = cfg.sessionState;
  const scopeId = cfg.scopeId;
  let lastResult = null;

  const runtime = {
    getSessionStatus: () => sessionState.status(),
    getPersistenceStatus: () => ({ available: false, persistent: false }),
    inspectElement(elementId) {
      const element = registry.getElementById(elementId);
      if (!element) return { ok: false, blocked: true, code: "UNKNOWN_ELEMENT", reason: "unknown element." };
      const layout = currentEntry(sessionState, elementId);
      const allowedOps = Array.isArray(element.allowedOps) ? element.allowedOps : [];
      const lockedOps = Array.isArray(element.lockedOps) ? element.lockedOps : [];
      return {
        ok: true,
        elementId,
        currentEntry: clone(layout),
        effectiveLayout: clone(layout),
        allowedOps: allowedOps.slice(),
        effectiveOps: allowedOps.filter((operation) => !lockedOps.includes(operation)),
      };
    },
    applyChange() {
      return { ok: false, blocked: true, code: "UI_PROTOCOL_REQUIRED", reason: "Visible changes require the host protocol." };
    },
  };

  const controller = createUiEditorPanelController({ runtime, registry, stepSize: 1 });
  const listedElements = editorCore.listElements();
  const initialElement = listedElements.find((element) => element.editable !== false && Array.isArray(element.allowedOps) && element.allowedOps.includes("textMove"))
    || listedElements.find((element) => element.editable !== false && Array.isArray(element.allowedOps) && element.allowedOps.length > 0);
  if (initialElement) controller.selectElement(initialElement.id);

  function snapshot() {
    const controllerState = controller.getState();
    const selectedElementId = controllerState.selectedElementId;
    const details = selectedElementId ? createEditorDetailsViewModel(editorCore, selectedElementId) : null;
    if (details) details.currentLayout = clone(currentEntry(sessionState, selectedElementId));
    const panel = createUiEditorPanelViewModel({ controllerState, lastResult });
    const m74Panel = {
      selection: panel.selection,
      layer: panel.layer,
      layers: panel.layers,
      modes: panel.modes,
      dpad: { up: panel.dpad.up, down: panel.dpad.down, left: panel.dpad.left, right: panel.dpad.right },
      stepSize: panel.stepSize,
      session: panel.session,
      status: panel.status,
      busy: panel.busy,
    };
    return clone({
      scopeId,
      tree: createEditorTreeViewModel(editorCore),
      details,
      panel: m74Panel,
    });
  }

  function applyControllerAction(action) {
    const state = action();
    if (state && state.lastResult) lastResult = state.lastResult;
    return snapshot();
  }

  return {
    snapshot,
    selectElement(elementId) {
      lastResult = null;
      return applyControllerAction(() => controller.selectElement(elementId));
    },
    setLayer(layer) {
      if (!Object.values(PANEL_LAYERS).includes(layer)) {
        lastResult = { ok: false, blocked: true, code: "OPERATION_NOT_ALLOWED", reason: "layer is not available." };
        return snapshot();
      }
      lastResult = null;
      return applyControllerAction(() => controller.setLayer(layer));
    },
    setMode(mode) {
      if (!Object.values(PANEL_MODES).includes(mode)) {
        lastResult = { ok: false, blocked: true, code: "OPERATION_NOT_ALLOWED", reason: "mode is not available." };
        return snapshot();
      }
      lastResult = null;
      return applyControllerAction(() => controller.setMode(mode));
    },
    setStepSize(stepSize) {
      if (!Number.isFinite(stepSize) || stepSize <= 0) {
        lastResult = { ok: false, blocked: true, code: "INVALID_STEP_SIZE", reason: "step size must be positive and finite." };
        return snapshot();
      }
      lastResult = null;
      controller.setStepSize(stepSize);
      return snapshot();
    },
    prepareDirection(direction) {
      const prepared = controller.prepareDirectionChange(direction);
      if (!prepared.ok) {
        lastResult = prepared;
        return prepared;
      }
      prepared.changeRequest.scope = scopeId;
      lastResult = { ok: true, code: "CHANGE_IN_PROGRESS", message: "Aenderung wird ausgefuehrt." };
      return clone(prepared);
    },
    acceptChangeResult(result) {
      lastResult = result && result.success === true
        ? { ok: true, code: "CHANGE_APPLIED", message: result.message }
        : {
            ok: false,
            blocked: true,
            code: result && result.errorCode ? result.errorCode : "TARGET_REJECTED_CHANGE",
            reason: result && result.message ? result.message : "Aenderung wurde abgewiesen.",
            rollbackComplete: !result || result.rollbackSucceeded !== false,
          };
      return snapshot();
    },
    destroy() { controller.destroy(); },
  };
}

module.exports = { createEditorUiSession };
