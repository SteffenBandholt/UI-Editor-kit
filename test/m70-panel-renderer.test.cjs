"use strict";
const { assert, setup } = require("./m70-test-helpers.cjs");
const { createUiEditorPanelController, createUiEditorPanel } = require("../src/index.cjs");

function createDom() {
  let activeElement = null;
  class Element {
    constructor(tagName) {
      this.tagName = tagName;
      this.children = [];
      this.dataset = {};
      this.attrs = {};
      this.listeners = {};
      this.ownerDocument = documentAdapter;
      this.disabled = false;
      this.className = "";
      this.parentNode = null;
      this._textContent = "";
    }
    set textContent(value) { this._textContent = String(value); if (value === "") this.children = []; }
    get textContent() { return this._textContent; }
    appendChild(child) { this.children.push(child); child.parentNode = this; return child; }
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((child) => child !== this); }
    setAttribute(key, value) { this.attrs[key] = String(value); }
    getAttribute(key) { return this.attrs[key]; }
    addEventListener(key, listener) { (this.listeners[key] || (this.listeners[key] = [])).push(listener); }
    dispatchEvent(event) { (this.listeners[event.type] || []).forEach((listener) => listener(event)); }
    focus() { activeElement = this; }
    queryAll(predicate, output = []) { if (predicate(this)) output.push(this); this.children.forEach((child) => child.queryAll(predicate, output)); return output; }
  }
  const documentAdapter = { createElement: (tagName) => new Element(tagName), get activeElement() { return activeElement; } };
  return { document: documentAdapter, element: (tagName) => new Element(tagName), get activeElement() { return activeElement; } };
}

function buttonByFocusKey(root, key) {
  return root.queryAll((element) => element.dataset && element.dataset.focusKey === key)[0];
}

(async () => {
  const fake = createDom();
  const mount = fake.element("main");
  const { registry, runtime } = setup();
  const controller = createUiEditorPanelController({ runtime, registry });
  controller.selectElement("demo.card");
  const panel = createUiEditorPanel({ controller, mountTarget: mount, documentAdapter: fake.document });
  assert.equal(mount.children.length, 1);
  assert.equal(panel.root.className, "ui-editor-panel-root");
  const buttons = panel.root.queryAll((element) => element.tagName === "button");
  assert.equal(buttons.some((button) => button.textContent === "Verschieben"), true);
  assert.equal(buttons.some((button) => button.getAttribute("aria-label") === "Änderungen dieses Elements verwerfen"), true);

  const resetElementButton = buttonByFocusKey(panel.root, "action:resetElement");
  resetElementButton.focus();
  resetElementButton.dispatchEvent({ type: "click" });
  assert.equal(fake.activeElement.dataset.focusKey, "dialog:cancel");
  const dialog = panel.root.queryAll((element) => element.attrs.role === "dialog")[0];
  assert.ok(dialog);
  dialog.dispatchEvent({ type: "keydown", key: "Escape", preventDefault() {} });
  assert.equal(controller.getState().dialog.open, false);
  assert.equal(fake.activeElement.dataset.focusKey, "action:resetElement");

  buttonByFocusKey(panel.root, "action:resetElement").dispatchEvent({ type: "click" });
  assert.equal(fake.activeElement.dataset.focusKey, "dialog:cancel");
  buttonByFocusKey(panel.root, "dialog:cancel").dispatchEvent({ type: "click" });
  assert.equal(fake.activeElement.dataset.focusKey, "action:resetElement");

  buttonByFocusKey(panel.root, "action:resetLayout").dispatchEvent({ type: "click" });
  assert.equal(fake.activeElement.dataset.focusKey, "dialog:cancel");
  buttonByFocusKey(panel.root, "dialog:confirm").dispatchEvent({ type: "click" });
  await Promise.resolve();
  assert.equal(fake.activeElement.dataset.focusKey, "action:resetLayout");

  panel.destroy();
  assert.equal(mount.children.length, 0);
  console.log("m70 panel renderer ok");
})();
