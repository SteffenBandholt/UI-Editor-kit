"use strict";

const { BROWSER_ERROR_CODES, ok, blocked } = require("./browser-result.cjs");

function createUiEditorBrowserBridge(options) {
  const cfg = options || {};
  let destroyed = false;
  let suppressControllerSelectionEmission = false;
  let lastControllerSignature = null;
  const unsubs = [];

  function getSelection() {
    return cfg.selectionHost && typeof cfg.selectionHost.getSelection === "function"
      ? cfg.selectionHost.getSelection()
      : { selectedElementId: null };
  }

  function ref(elementId) {
    const result = cfg.elementRefs && typeof cfg.elementRefs.get === "function" ? cfg.elementRefs.get(elementId) : null;
    return result && result.ok !== false ? result.value : null;
  }

  function updateOverlay() {
    if (destroyed) return blocked(BROWSER_ERROR_CODES.BRIDGE_DESTROYED, "bridge destroyed");
    const selection = getSelection();
    if (selection.selectedElementId && cfg.overlayHost && typeof cfg.overlayHost.update === "function") {
      return cfg.overlayHost.update();
    }
    return ok();
  }

  function showSelection(elementId) {
    if (cfg.controller && typeof cfg.controller.selectElement === "function") cfg.controller.selectElement(elementId);
    if (cfg.overlayHost && typeof cfg.overlayHost.show === "function") cfg.overlayHost.show(elementId, ref(elementId));
  }

  function clearSelection() {
    if (cfg.controller && typeof cfg.controller.clearSelection === "function") cfg.controller.clearSelection();
    if (cfg.overlayHost && typeof cfg.overlayHost.hide === "function") cfg.overlayHost.hide();
  }

  function controllerSignature(state) {
    const result = state && state.lastResult;
    return JSON.stringify({
      selectedElementId: state && state.selectedElementId,
      busy: !!(state && state.busy),
      changedCount: state && state.runtimeStatus && state.runtimeStatus.changedCount,
      changedElementIds: state && state.runtimeStatus && state.runtimeStatus.changedElementIds,
      code: result && result.code,
      ok: result && result.ok,
      rollbackComplete: result && result.rollbackComplete,
      dialogOpen: state && state.dialog && state.dialog.open,
    });
  }

  if (cfg.selectionHost && typeof cfg.selectionHost.subscribe === "function") {
    unsubs.push(cfg.selectionHost.subscribe((selection) => {
      if (destroyed) return;
      suppressControllerSelectionEmission = true;
      if (selection.selectedElementId) showSelection(selection.selectedElementId);
      else clearSelection();
      suppressControllerSelectionEmission = false;
    }));
  }

  if (cfg.controller && typeof cfg.controller.subscribe === "function") {
    unsubs.push(cfg.controller.subscribe((state) => {
      if (destroyed) return;
      const signature = controllerSignature(state);
      if (signature === lastControllerSignature) return;
      lastControllerSignature = signature;
      if (suppressControllerSelectionEmission) return;
      if (!state || state.busy) return;
      if (!state.selectedElementId) return;
      updateOverlay();
    }));
  }

  return {
    updateOverlay,
    afterLayoutChange: updateOverlay,
    afterLoad: updateOverlay,
    afterReset: updateOverlay,
    afterDiscard: updateOverlay,
    afterReapply: updateOverlay,
    clearSelection() {
      if (destroyed) return blocked(BROWSER_ERROR_CODES.BRIDGE_DESTROYED, "bridge destroyed");
      if (cfg.selectionHost && typeof cfg.selectionHost.clear === "function") cfg.selectionHost.clear();
      return ok();
    },
    destroy() {
      destroyed = true;
      unsubs.splice(0).forEach((unsubscribe) => {
        try { unsubscribe(); } catch (_error) {}
      });
      if (cfg.overlayHost && typeof cfg.overlayHost.hide === "function") cfg.overlayHost.hide();
    },
  };
}

module.exports = { createUiEditorBrowserBridge };
