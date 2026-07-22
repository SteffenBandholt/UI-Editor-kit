"use strict";
const assert = require("node:assert/strict");
const { createPanelPositionStore, createUiEditorPanel } = require("../src/index.cjs");

const data = new Map();
const storage = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
const store = createPanelPositionStore({ storage, targetAppId: "app-a" });
assert.equal(store.write({ x: 50, y: 60 }).ok, true);
assert.deepEqual(store.read().value, { x: 50, y: 60 });
data.set(store.key, JSON.stringify({ version: 1, position: { x: "bad", y: 2 } }));
assert.equal(store.read().code, "INVALID_PANEL_POSITION");

function fakeDom() {
  class E { constructor(tag) { this.tagName = tag; this.children = []; this.dataset = {}; this.attrs = {}; this.listeners = {}; this.style = {}; this.parentNode = null; } set textContent(v) { this._text = String(v); if (v === "") this.children = []; } get textContent() { return this._text; } appendChild(c) { this.children.push(c); c.parentNode = this; return c; } remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((c) => c !== this); } setAttribute(k,v) { this.attrs[k]=String(v); } addEventListener(k,f) { (this.listeners[k] ||= []).push(f); } dispatchEvent(e) { e.currentTarget = this; for (const f of this.listeners[e.type] || []) f(e); } focus() {} getBoundingClientRect() { return { width: 300, height: 400 }; } }
  let doc; doc = { createElement: (tag) => { const e = new E(tag); e.ownerDocument = doc; return e; } }; return { doc, E };
}
const { doc, E } = fakeDom(); const mount = new E("main"); mount.ownerDocument = doc;
const winListeners = {}; const win = { innerWidth: 800, innerHeight: 600, addEventListener: (k,f) => (winListeners[k] ||= []).push(f), removeEventListener() {} };
let selected = "customer.name"; let changes = 0;
const controller = { getState: () => ({ selectedElementId: selected, selectedElementName: "Kundenname", editable: true, availableModes: ["move"], availableTextModes: [], layer: "element", mode: "move", stepSize: 5, persistenceStatus: { available: false, persistent: false } }), subscribe: () => () => {}, setLayer() {}, setMode() {}, setStepSize() {}, activateCenter() {}, activateDirection() { changes += 1; }, save() {}, load() {}, discardAll() {}, requestResetElement() {}, requestResetLayout() {}, close() {} };
data.delete(store.key);
const panel = createUiEditorPanel({ controller, mountTarget: mount, documentAdapter: doc, windowAdapter: win, positionStore: store, defaultPosition: { x: 700, y: 500 } });
assert.deepEqual(panel.getPosition(), { x: 500, y: 200 }, "default position is clamped into the viewport");
const handle = panel.root.children[0];
handle.dispatchEvent({ type: "pointerdown", pointerId: 1, clientX: 10, clientY: 10, preventDefault() {}, stopPropagation() {} });
for (const fn of winListeners.pointermove) fn({ pointerId: 1, clientX: -1000, clientY: -1000, stopPropagation() {} });
for (const fn of winListeners.pointerup) fn({ pointerId: 1, stopPropagation() {} });
assert.deepEqual(panel.getPosition(), { x: 0, y: 0 });
assert.deepEqual(store.read().value, { x: 0, y: 0 });
assert.equal(selected, "customer.name"); assert.equal(changes, 0, "panel drag must not edit targets");
win.innerWidth = 240; win.innerHeight = 200; for (const fn of winListeners.resize) fn(); assert.deepEqual(panel.getPosition(), { x: 0, y: 0 });
panel.destroy();
console.log("m72 panel position ok");
