"use strict";

const { validateSelectionHost, createSelectionStateSnapshot } = require("../contracts/selectionControllerContract.js");
const { resolveSelectionTarget, isElementLike } = require("./targetResolver.js");
const { createHoverOverlay } = require("./hoverOverlay.js");
const { createSelectedOverlay } = require("./selectedOverlay.js");

const SelectionRuntimeErrorCodes = Object.freeze({ INVALID_HOST: "invalid_host", LISTENER_SOURCE_MISSING: "listener_source_missing", RESOLVER_FAILED: "resolver_failed", SELECTION_FAILED: "selection_failed", SYNC_FAILED: "sync_failed", OVERLAY_FAILED: "overlay_failed", DESTROYED: "destroyed" });

function safeCall(callback, payload) {
  if (typeof callback !== "function") return;
  try {
    callback(payload);
  } catch (_error) {
    // Externe Beobachter duerfen die Runtime nicht abbrechen und werden nicht erneut gemeldet.
  }
}

function report(options, host, error) {
  safeCall(options && options.onError, error);
  safeCall(host && host.onError, error);
  safeCall(host && host.onStateChange, { error });
}
function makeError(code, message, cause) { const error = new Error(message); error.code = code; if (cause) error.cause = cause; return error; }
function normalizeId(value) { return typeof value === "string" && value.trim() !== "" ? value.trim() : null; }

function createSelectionController(options = {}) {
  const host = options.host;
  const validation = validateSelectionHost(host);
  if (!validation.ok) throw makeError(SelectionRuntimeErrorCodes.INVALID_HOST, `Ungueltiger SelectionHost: ${validation.errors.map((e) => e.message).join(" ")}`);

  const hoverOverlay = options.hoverOverlay || createHoverOverlay(options.overlayOptions && options.overlayOptions.hover);
  const selectedOverlay = options.selectedOverlay || createSelectedOverlay(options.overlayOptions && options.overlayOptions.selected);
  let active = false, destroyed = false, hoveredElementId = null, lastEventTarget = null, selectedElementId = null;
  let boundTargetCount = 0, unavailableElementIds = [];
  const listeners = [];

  function emitState(extra) { safeCall(host.onStateChange, Object.assign({}, getState(), extra || {})); }
  function getTargets() {
    const raw = typeof host.listSelectableTargets === "function" ? host.listSelectableTargets() : host.listSelectableElementIds().map((elementId) => ({ elementId }));
    return Array.isArray(raw) ? raw.map((target) => typeof target === "string" ? { elementId: target } : target).filter(Boolean) : [];
  }
  function getRef(id) { return host.getElementRef(id); }
  function scanBindings(targets) {
    boundTargetCount = 0; unavailableElementIds = [];
    targets.forEach((target) => { const id = target && target.elementId; if (!id) return; let ref; try { ref = getRef(id); } catch (_e) { ref = null; } if (isElementLike(ref)) boundTargetCount += 1; else unavailableElementIds.push(id); });
  }
  function readSelected() { try { return normalizeId(host.getSelectedElementId()); } catch (cause) { const e = makeError(SelectionRuntimeErrorCodes.SYNC_FAILED, "getSelectedElementId() ist fehlgeschlagen.", cause); report(options, host, e); return null; } }
  function findTarget(id, targets) { return targets.find((target) => target.elementId === id) || (id ? { elementId: id } : null); }
  function clearHover() { hoveredElementId = null; try { hoverOverlay.clear(); } catch (cause) { report(options, host, makeError(SelectionRuntimeErrorCodes.OVERLAY_FAILED, "HoverOverlay konnte nicht bereinigt werden.", cause)); } }
  function resolve(eventTarget) {
    const targets = getTargets(); scanBindings(targets);
    return resolveSelectionTarget({ eventTarget, targets, getElementRef: getRef, isExcludedTarget: host.isExcludedTarget });
  }
  function refreshHover() {
    if (!active || !lastEventTarget) { clearHover(); return getState(); }
    try {
      if (typeof host.isExcludedTarget === "function" && host.isExcludedTarget(lastEventTarget)) { clearHover(); return getState(); }
      const match = resolve(lastEventTarget);
      selectedElementId = readSelected();
      if (!match || match.elementId === selectedElementId) { clearHover(); return getState(); }
      hoveredElementId = match.elementId;
      hoverOverlay.show({ ref: match.ref, target: match.target, document: options.document, window: options.window });
      emitState();
    } catch (cause) { clearHover(); report(options, host, makeError(SelectionRuntimeErrorCodes.RESOLVER_FAILED, "Hover-Ziel konnte nicht aufgeloest werden.", cause)); }
    return getState();
  }
  function syncWithSelection() {
    try {
      const targets = getTargets(); scanBindings(targets); selectedElementId = readSelected();
      const target = findTarget(selectedElementId, targets); const ref = selectedElementId ? getRef(selectedElementId) : null;
      if (selectedElementId && isElementLike(ref)) selectedOverlay.show({ ref, target, document: options.document, window: options.window }); else selectedOverlay.clear();
      if (hoveredElementId && hoveredElementId === selectedElementId) clearHover(); else if (lastEventTarget && active) refreshHover();
      emitState();
    } catch (cause) { selectedElementId = null; try { selectedOverlay.clear(); } catch (_e) {} report(options, host, makeError(SelectionRuntimeErrorCodes.SYNC_FAILED, "Selection-Synchronisation ist fehlgeschlagen.", cause)); }
    return getState();
  }
  function onPointerMove(event) { lastEventTarget = event && event.target; refreshHover(); }
  function onPointerLeave() { lastEventTarget = null; clearHover(); emitState(); }
  function onClick(event) {
    if (!active) return;
    lastEventTarget = event && event.target;
    let match; try { match = resolve(lastEventTarget); } catch (cause) { report(options, host, makeError(SelectionRuntimeErrorCodes.RESOLVER_FAILED, "Klick-Ziel konnte nicht aufgeloest werden.", cause)); return; }
    if (!match) return;
    event.preventDefault && event.preventDefault(); event.stopPropagation && event.stopPropagation(); event.stopImmediatePropagation && event.stopImmediatePropagation();
    Promise.resolve().then(() => host.selectElement(match.elementId)).then(() => { syncWithSelection(); if (match.elementId === readSelected()) clearHover(); if (typeof host.onSelection === "function") host.onSelection({ elementId: match.elementId, target: match.target }); }).catch((cause) => { clearHover(); report(options, host, makeError(SelectionRuntimeErrorCodes.SELECTION_FAILED, "selectElement() ist fehlgeschlagen.", cause)); });
  }
  function onKeyDown(event) { if (event && event.key === "Escape") { stop(); clearHover(); } }
  function source() { return typeof host.getInteractionRoot === "function" ? host.getInteractionRoot() : options.document; }
  function add(target, type, fn, opts) { target.addEventListener(type, fn, opts); listeners.push([target, type, fn, opts]); }
  function start() {
    if (destroyed) { report(options, host, makeError(SelectionRuntimeErrorCodes.DESTROYED, "SelectionController wurde zerstoert.")); return getState(); }
    if (active) return getState();
    const root = source(); if (!root || typeof root.addEventListener !== "function") { const e = makeError(SelectionRuntimeErrorCodes.LISTENER_SOURCE_MISSING, "Keine explizite InteractionRoot- oder Document-Eventquelle vorhanden."); report(options, host, e); return getState(); }
    active = true; add(root, "pointermove", onPointerMove); add(root, "pointerleave", onPointerLeave); add(root, "click", onClick, true); add(root, "keydown", onKeyDown);
    syncWithSelection(); emitState(); return getState();
  }
  function stop() { if (!active) return getState(); active = false; while (listeners.length) { const [t, ty, fn, o] = listeners.pop(); t.removeEventListener && t.removeEventListener(ty, fn, o); } clearHover(); emitState(); return getState(); }
  function destroy() { if (destroyed) return getState(); stop(); destroyed = true; hoverOverlay.destroy(); selectedOverlay.destroy(); return getState(); }
  function isActive() { return active; }
  function getState() { return createSelectionStateSnapshot(host, { active, hoveredElementId, boundTargetCount, unavailableElementIds }); }
  syncWithSelection();
  return { start, stop, destroy, isActive, getState, refreshHover, syncWithSelection };
}

module.exports = { createSelectionController, SelectionRuntimeErrorCodes };
