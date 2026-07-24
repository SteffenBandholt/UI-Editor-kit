"use strict";
const { createUiEditorPanelViewModel } = require("./ui-editor-panel-view-model.cjs");

function createUiEditorPanel(options) {
  const cfg = options || {};
  if (!cfg.controller) throw new Error("controller is required");
  if (!cfg.mountTarget) throw new Error("mountTarget is required");
  const doc = cfg.documentAdapter || cfg.mountTarget.ownerDocument || document;
  const win = cfg.windowAdapter || (typeof window !== "undefined" ? window : null);
  const root = doc.createElement("section");
  root.className = "ui-editor-panel-root";
  root.setAttribute("aria-label", "UI-Editor Bedienpanel");
  if (root.style) { root.style.position = "fixed"; root.style.zIndex = "2147483647"; }
  cfg.mountTarget.appendChild(root);
  let dialogReturnFocusKey = null, focusAfterRenderKey = null, destroyed = false;
  let position = { x: 16, y: 16 }, drag = null;

  function viewport() { return { width: Number(win && win.innerWidth) || 1280, height: Number(win && win.innerHeight) || 720 }; }
  function panelSize() { const rect = typeof root.getBoundingClientRect === "function" ? root.getBoundingClientRect() : null; return { width: Number(rect && rect.width) || 320, height: Number(rect && rect.height) || 420 }; }
  function clamp(candidate) { const view = viewport(), size = panelSize(); return { x: Math.max(0, Math.min(Number(candidate.x) || 0, Math.max(0, view.width - size.width))), y: Math.max(0, Math.min(Number(candidate.y) || 0, Math.max(0, view.height - size.height))) }; }
  function applyPosition(candidate, persist) {
    position = clamp(candidate);
    if (root.style) { root.style.left = `${position.x}px`; root.style.top = `${position.y}px`; }
    if (persist && cfg.positionStore && typeof cfg.positionStore.write === "function") cfg.positionStore.write(position);
    return { ...position };
  }
  const stored = cfg.positionStore && typeof cfg.positionStore.read === "function" ? cfg.positionStore.read() : null;
  applyPosition(stored && stored.ok && stored.value ? stored.value : (cfg.defaultPosition || position), false);

  function findByFocusKey(key) { const stack = [root]; while (stack.length) { const node = stack.shift(); if (node && node.dataset && node.dataset.focusKey === key) return node; if (node && node.children) Array.prototype.forEach.call(node.children, (child) => stack.push(child)); } return null; }
  function scheduleFocus(key) { focusAfterRenderKey = key; }
  function applyScheduledFocus() { if (!focusAfterRenderKey) return; const target = findByFocusKey(focusAfterRenderKey); focusAfterRenderKey = null; if (target && typeof target.focus === "function") target.focus(); }
  function button(model, onClick, focusKey) { const element = doc.createElement("button"); element.type = "button"; element.textContent = model.label; element.disabled = !model.enabled; element.dataset.intent = model.intent; if (focusKey) element.dataset.focusKey = focusKey; if (model.ariaLabel) element.setAttribute("aria-label", model.ariaLabel); element.addEventListener("click", onClick); return element; }
  function closeDialog(action) { scheduleFocus(dialogReturnFocusKey); return action(); }
  function stop(event) { if (event && typeof event.stopPropagation === "function") event.stopPropagation(); }
  root.addEventListener("click", stop);
  root.addEventListener("pointerdown", stop);

  function startDrag(event) {
    stop(event); if (event && typeof event.preventDefault === "function") event.preventDefault();
    drag = { pointerId: event.pointerId, startX: Number(event.clientX) || 0, startY: Number(event.clientY) || 0, origin: { ...position } };
    if (event.currentTarget && typeof event.currentTarget.setPointerCapture === "function" && event.pointerId != null) event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveDrag(event) { if (!drag || (drag.pointerId != null && event.pointerId != null && drag.pointerId !== event.pointerId)) return; stop(event); applyPosition({ x: drag.origin.x + (Number(event.clientX) || 0) - drag.startX, y: drag.origin.y + (Number(event.clientY) || 0) - drag.startY }, false); }
  function endDrag(event) { if (!drag) return; stop(event); drag = null; applyPosition(position, true); }
  function handleResize() { applyPosition(position, true); }
  if (win && typeof win.addEventListener === "function") { win.addEventListener("pointermove", moveDrag); win.addEventListener("pointerup", endDrag); win.addEventListener("resize", handleResize); }

  function render() {
    if (destroyed) return;
    const vm = createUiEditorPanelViewModel({ controllerState: cfg.controller.getState() });
    root.textContent = "";
    const header = doc.createElement("header"); header.className = "ui-editor-panel-handle"; header.textContent = "UI-Editor"; header.setAttribute("aria-label", "Bedienpanel verschieben"); header.addEventListener("pointerdown", startDrag); root.appendChild(header);
    const name = doc.createElement("div"); name.className = "ui-editor-panel-selection"; name.textContent = vm.selection.selected ? vm.selection.name : "Kein Element ausgewählt"; root.appendChild(name);
    const layers = doc.createElement("div"); layers.className = "ui-editor-panel-layers"; vm.layers.forEach((layer) => { const node = button({ label: layer.label, intent: "set-layer", enabled: layer.enabled }, () => cfg.controller.setLayer(layer.id), `layer:${layer.id}`); if (layer.active) node.setAttribute("aria-pressed", "true"); layers.appendChild(node); }); root.appendChild(layers);
    const modes = doc.createElement("div"); modes.className = "ui-editor-panel-modes"; vm.modes.forEach((mode) => { const node = button({ label: mode.label, intent: "set-mode", enabled: mode.enabled }, () => cfg.controller.setMode(mode.id), `mode:${mode.id}`); if (mode.active) node.setAttribute("aria-pressed", "true"); modes.appendChild(node); }); root.appendChild(modes);
    const dpad = doc.createElement("div"); dpad.className = "ui-editor-panel-dpad"; dpad.tabIndex = 0; dpad.setAttribute("role", "group"); dpad.setAttribute("aria-label", "Steuerkreuz");
    for (const direction of ["up", "left", "center", "right", "down"]) dpad.appendChild(button(vm.dpad[direction], () => direction === "center" ? cfg.controller.activateCenter() : cfg.controller.activateDirection(direction), `dpad:${direction}`));
    dpad.addEventListener("keydown", (event) => { const map = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" }; if (map[event.key]) { event.preventDefault(); cfg.controller.activateDirection(map[event.key]); } }); root.appendChild(dpad);
    const step = doc.createElement("label"); step.className = "ui-editor-panel-step"; step.textContent = "Schritt "; const input = doc.createElement("input"); input.type = "number"; input.min = "1"; input.value = String(vm.stepSize); input.setAttribute("aria-label", "Änderungsschritt"); input.addEventListener("change", () => cfg.controller.setStepSize(input.value)); step.appendChild(input); root.appendChild(step);
    const actions = doc.createElement("div"); actions.className = "ui-editor-panel-actions";
    actions.appendChild(button(vm.actions.save, () => cfg.controller.save(), "action:save")); actions.appendChild(button(vm.actions.load, () => cfg.controller.load(), "action:load")); actions.appendChild(button(vm.actions.discardAll, () => cfg.controller.discardAll(), "action:discardAll"));
    actions.appendChild(button(vm.actions.resetElement, () => { dialogReturnFocusKey = "action:resetElement"; scheduleFocus("dialog:cancel"); cfg.controller.requestResetElement(); }, "action:resetElement"));
    actions.appendChild(button(vm.actions.resetLayout, () => { dialogReturnFocusKey = "action:resetLayout"; scheduleFocus("dialog:cancel"); cfg.controller.requestResetLayout(); }, "action:resetLayout")); actions.appendChild(button(vm.actions.close, () => cfg.controller.close(), "action:close")); root.appendChild(actions);
    const status = doc.createElement("div"); status.className = `ui-editor-panel-status ui-editor-panel-status-${vm.status.kind}`; status.setAttribute("role", "status"); status.textContent = vm.status.message; root.appendChild(status);
    if (vm.dialog && vm.dialog.open) {
      const dialog = doc.createElement("div"); dialog.className = "ui-editor-panel-dialog"; dialog.setAttribute("role", "dialog"); dialog.setAttribute("aria-modal", "true");
      const title = doc.createElement("h2"); title.textContent = vm.dialog.title; dialog.appendChild(title); const message = doc.createElement("p"); message.textContent = vm.dialog.message; dialog.appendChild(message);
      const confirm = button({ label: vm.dialog.confirmLabel, enabled: true, intent: `confirm-${vm.dialog.type}` }, () => closeDialog(vm.dialog.type === "reset-element" ? cfg.controller.confirmResetElement : cfg.controller.confirmResetLayout), "dialog:confirm");
      const cancel = button({ label: vm.dialog.cancelLabel, enabled: true, intent: `cancel-${vm.dialog.type}` }, () => closeDialog(vm.dialog.type === "reset-element" ? cfg.controller.cancelResetElement : cfg.controller.cancelResetLayout), "dialog:cancel"); dialog.appendChild(confirm); dialog.appendChild(cancel);
      dialog.addEventListener("keydown", (event) => { if (event.key === "Escape") { event.preventDefault(); closeDialog(vm.dialog.type === "reset-element" ? cfg.controller.cancelResetElement : cfg.controller.cancelResetLayout); } }); root.appendChild(dialog);
    }
    applyPosition(position, false); applyScheduledFocus();
  }
  const unsubscribe = cfg.controller.subscribe(render); render();
  return { root, render, getPosition: () => ({ ...position }), setPosition: (value) => applyPosition(value, true), destroy() { destroyed = true; unsubscribe(); if (win && typeof win.removeEventListener === "function") { win.removeEventListener("pointermove", moveDrag); win.removeEventListener("pointerup", endDrag); win.removeEventListener("resize", handleResize); } root.remove(); } };
}

module.exports = { createUiEditorPanel };
