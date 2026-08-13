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

function tableEditorModel(registry, sessionState, selectedElement) {
  if (!selectedElement) return null;
  const tableId = selectedElement.tableLayout?.tableId || selectedElement.tableBinding?.tableId ||
    (selectedElement.type === "tableColumn" ? selectedElement.parentId : null);
  const table = tableId ? registry.getElementById(tableId) : null;
  if (!table?.tableLayout) return null;
  const columns = table.tableLayout.columns.map((column) => {
    const entry = currentEntry(sessionState, column.columnId);
    const logicalWidth = Number(entry?.element?.width ?? column.currentWidth);
    const effectiveWidth = Number(entry?.table?.effectiveWidth ?? logicalWidth);
    return {
      columnId: column.columnId,
      displayName: column.displayName,
      currentWidth: Number.isFinite(effectiveWidth) ? effectiveWidth : column.currentWidth,
      logicalWidth: Number.isFinite(logicalWidth) ? logicalWidth : column.currentWidth,
      widthMode: entry?.table?.widthMode || column.widthMode,
      headerWidth: Number(entry?.table?.headerWidth ?? effectiveWidth),
      headerContentWidth: Number(entry?.table?.headerContentWidth ?? effectiveWidth),
      dataCellWidths: Array.isArray(entry?.table?.dataCellWidths) ? entry.table.dataCellWidths.map(Number) : [],
      dataContentWidths: Array.isArray(entry?.table?.dataContentWidths) ? entry.table.dataContentWidths.map(Number) : [],
      runtimeWidthValid: entry?.table?.runtimeWidthValid !== false,
      minimumWidth: column.minimumWidth,
      maximumWidth: column.maximumWidth,
      order: column.order,
      resizable: column.resizable !== false,
    };
  });
  let position = 0;
  const boundaries = columns.slice(0, -1).map((left, index) => {
    const right = columns[index + 1];
    position += left.currentWidth;
    const minimumDelta = Math.max(left.minimumWidth - left.currentWidth, right.currentWidth - right.maximumWidth);
    const maximumDelta = Math.min(left.maximumWidth - left.currentWidth, right.currentWidth - right.minimumWidth);
    return {
      leftColumnId: left.columnId,
      leftDisplayName: left.displayName,
      rightColumnId: right.columnId,
      rightDisplayName: right.displayName,
      currentPosition: position,
      minimumDelta,
      maximumDelta,
      enabled: table.tableLayout.boundaryResizePolicy === "adjacentPreserveTotal" && left.resizable && right.resizable,
    };
  });
  return {
    tableId,
    displayName: table.tableLayout.displayName || table.name,
    boundaryResizePolicy: table.tableLayout.boundaryResizePolicy || "independent",
    unit: "DIP",
    totalWidth: columns.reduce((sum, column) => sum + column.currentWidth, 0),
    columns,
    boundaries,
  };
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
    if (details) {
      details.currentLayout = clone(currentEntry(sessionState, selectedElementId));
      details.tableEditor = clone(tableEditorModel(registry, sessionState, registry.getElementById(selectedElementId)));
      const currentVisible = details.currentLayout?.element?.visible;
      if (typeof currentVisible === "boolean") details.visible = currentVisible;
    }
    const panel = createUiEditorPanelViewModel({ controllerState, lastResult });
    const m74Panel = {
      selection: panel.selection,
      layer: panel.layer,
      layers: panel.layers,
      modes: panel.modes,
      dpad: { up: panel.dpad.up, down: panel.dpad.down, left: panel.dpad.left, right: panel.dpad.right },
      stepSize: panel.stepSize,
      simple: panel.simple,
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
    prepareVisibility(visible) {
      const state = controller.getState();
      if (!state.selectedElementId || !state.effectiveOps.includes("setVisibility") || typeof visible !== "boolean") {
        lastResult = { ok: false, blocked: true, code: "OPERATION_NOT_ALLOWED", reason: "visibility is not available." };
        return clone(lastResult);
      }
      const changeRequest = {
        elementId: state.selectedElementId,
        operation: "setVisibility",
        payload: { visible },
        source: "ui-editor-panel",
        changeId: `ui-editor-panel:${Date.now()}`,
        createdAt: new Date().toISOString(),
        scope: scopeId,
      };
      lastResult = { ok: true, code: "CHANGE_IN_PROGRESS", message: "Sichtbarkeit wird geaendert." };
      return { ok: true, changeRequest };
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
