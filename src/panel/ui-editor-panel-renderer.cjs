"use strict";
const { createUiEditorPanelViewModel } = require("./ui-editor-panel-view-model.cjs");

function createUiEditorPanel(options) {
  const cfg = options || {};
  if (!cfg.controller) throw new Error("controller is required");
  if (!cfg.mountTarget) throw new Error("mountTarget is required");

  const doc = cfg.documentAdapter || cfg.mountTarget.ownerDocument || document;
  const root = doc.createElement("section");
  root.className = "ui-editor-panel-root";
  root.setAttribute("aria-label", "UI-Editor Bedienpanel");
  cfg.mountTarget.appendChild(root);

  let dialogReturnFocusKey = null;
  let focusAfterRenderKey = null;
  let dialogWasOpen = false;

  function findByFocusKey(focusKey) {
    const stack = [root];
    while (stack.length > 0) {
      const node = stack.shift();
      if (node && node.dataset && node.dataset.focusKey === focusKey) return node;
      if (node && node.children) Array.prototype.forEach.call(node.children, (child) => stack.push(child));
    }
    return null;
  }

  function scheduleFocus(focusKey) {
    focusAfterRenderKey = focusKey;
  }

  function applyScheduledFocus() {
    if (!focusAfterRenderKey) return;
    const target = findByFocusKey(focusAfterRenderKey);
    focusAfterRenderKey = null;
    if (target && typeof target.focus === "function") target.focus();
  }

  function button(model, onClick, focusKey) {
    const element = doc.createElement("button");
    element.type = "button";
    element.textContent = model.label;
    element.disabled = !model.enabled;
    element.dataset.intent = model.intent;
    if (focusKey) element.dataset.focusKey = focusKey;
    if (model.ariaLabel) element.setAttribute("aria-label", model.ariaLabel);
    element.addEventListener("click", onClick);
    return element;
  }

  function closeDialog(controllerAction) {
    scheduleFocus(dialogReturnFocusKey);
    return controllerAction();
  }

  function render() {
    const vm = createUiEditorPanelViewModel({ controllerState: cfg.controller.getState() });
    root.textContent = "";

    const name = doc.createElement("div");
    name.className = "ui-editor-panel-selection";
    name.textContent = vm.selection.selected ? vm.selection.name : "Kein Element ausgewählt";
    root.appendChild(name);

    const modes = doc.createElement("div");
    modes.className = "ui-editor-panel-modes";
    vm.modes.forEach((mode) => {
      const modeButton = button({ label: mode.label, intent: "set-mode", enabled: mode.enabled }, () => cfg.controller.setMode(mode.id), `mode:${mode.id}`);
      if (mode.active) modeButton.setAttribute("aria-pressed", "true");
      modes.appendChild(modeButton);
    });
    root.appendChild(modes);

    const dpad = doc.createElement("div");
    dpad.className = "ui-editor-panel-dpad";
    dpad.tabIndex = 0;
    dpad.setAttribute("role", "group");
    dpad.setAttribute("aria-label", "D-Pad");
    const dpadButtons = { up: vm.dpad.up, left: vm.dpad.left, center: vm.dpad.center, right: vm.dpad.right, down: vm.dpad.down };
    Object.keys(dpadButtons).forEach((direction) => {
      dpad.appendChild(button(dpadButtons[direction], () => direction === "center" ? cfg.controller.activateCenter() : cfg.controller.activateDirection(direction), `dpad:${direction}`));
    });
    dpad.addEventListener("keydown", (event) => {
      const map = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
      if (map[event.key]) {
        event.preventDefault();
        cfg.controller.activateDirection(map[event.key]);
      }
    });
    root.appendChild(dpad);

    const actions = doc.createElement("div");
    actions.className = "ui-editor-panel-actions";
    actions.appendChild(button(vm.actions.save, () => cfg.controller.save(), "action:save"));
    actions.appendChild(button(vm.actions.load, () => cfg.controller.load(), "action:load"));
    actions.appendChild(button(vm.actions.discardAll, () => cfg.controller.discardAll(), "action:discardAll"));
    actions.appendChild(button(vm.actions.resetElement, () => { dialogReturnFocusKey = "action:resetElement"; scheduleFocus("dialog:cancel"); cfg.controller.requestResetElement(); }, "action:resetElement"));
    actions.appendChild(button(vm.actions.resetLayout, () => { dialogReturnFocusKey = "action:resetLayout"; scheduleFocus("dialog:cancel"); cfg.controller.requestResetLayout(); }, "action:resetLayout"));
    root.appendChild(actions);

    const status = doc.createElement("div");
    status.className = `ui-editor-panel-status ui-editor-panel-status-${vm.status.kind}`;
    status.setAttribute("role", "status");
    status.textContent = vm.status.message;
    root.appendChild(status);

    if (vm.dialog && vm.dialog.open) {
      dialogWasOpen = true;
      const dialog = doc.createElement("div");
      dialog.className = "ui-editor-panel-dialog";
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-modal", "true");
      dialog.setAttribute("aria-label", vm.dialog.title);
      const title = doc.createElement("strong");
      title.textContent = vm.dialog.title;
      const message = doc.createElement("p");
      message.textContent = vm.dialog.message;
      dialog.appendChild(title);
      dialog.appendChild(message);
      const confirm = button({ label: vm.dialog.confirmLabel, intent: "confirm", enabled: true }, () => closeDialog(() => vm.dialog.type === "reset-element" ? cfg.controller.confirmResetElement() : cfg.controller.confirmResetLayout()), "dialog:confirm");
      const cancel = button({ label: vm.dialog.cancelLabel, intent: "cancel", enabled: true }, () => closeDialog(() => vm.dialog.type === "reset-element" ? cfg.controller.cancelResetElement() : cfg.controller.cancelResetLayout()), "dialog:cancel");
      dialog.appendChild(confirm);
      dialog.appendChild(cancel);
      dialog.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          closeDialog(() => vm.dialog.type === "reset-element" ? cfg.controller.cancelResetElement() : cfg.controller.cancelResetLayout());
        }
      });
      root.appendChild(dialog);
    } else if (dialogWasOpen) {
      dialogWasOpen = false;
      if (!focusAfterRenderKey && dialogReturnFocusKey) scheduleFocus(dialogReturnFocusKey);
    }

    applyScheduledFocus();
  }

  const unsubscribe = cfg.controller.subscribe(render);
  render();
  return { root, update: render, destroy() { unsubscribe(); root.remove(); } };
}

module.exports = { createUiEditorPanel };
