"use strict";
const assert = require("node:assert/strict");
const { createUiEditorRuntime, createUiEditorPanelController, normalizeLayoutEntry } = require("../src/index.cjs");

const definition = {
  elementId: "customer.name", displayName: "Kundenname", scope: "form", editable: true,
  operations: { move: true, resizeWidth: true, resizeHeight: true, textMove: true, textResize: true, show: true, hide: true },
  limits: { minWidth: 120, maxWidth: 300, minHeight: 30, maxHeight: 80, minFontSize: 8, maxFontSize: 40, minTextOffsetX: -10, maxTextOffsetX: 20 },
};
const registry = { getElementById: (id) => id === definition.elementId ? definition : null, listElements: () => [definition] };
let visible = { elementId: definition.elementId, element: { x: 0, y: 0, width: 280, height: 40, visible: true }, text: { offsetX: 12, offsetY: 0, fontSize: 16 } };
let failNextApply = false;
const clone = (value) => JSON.parse(JSON.stringify(value));
const host = {
  validateElementRef: () => ({ ok: true }),
  captureElementLayoutState: () => ({ ok: true, value: clone(visible) }),
  getCurrentLayoutEntry: () => ({ ok: true, value: clone(visible) }),
  restoreElementLayoutState: (_id, snapshot) => { visible = clone(snapshot); return { ok: true }; },
  clearElementLayout: () => ({ ok: true }),
  applyLayoutEntry(_id, entry) {
    if (failNextApply) { failNextApply = false; visible.element.x = 999; return { ok: false, reason: "host rejected" }; }
    if (entry.element) visible.element = { ...visible.element, ...entry.element };
    if (entry.text) visible.text = { ...visible.text, ...entry.text };
    return { ok: true };
  },
};
let stored = [];
const storage = { available: true, persistent: true, readResult: () => ({ ok: true, value: { entries: clone(stored) } }), write: (_context, entries) => { stored = clone(entries); return { ok: true }; }, clear: () => { stored = []; return { ok: true }; }, deleteEntry: (_context, id) => { stored = stored.filter((entry) => entry.elementId !== id); return { ok: true }; } };
const runtime = createUiEditorRuntime({ registry, hostAdapter: host, layoutStorage: storage, targetContext: { targetAppId: "crm", moduleId: "customer", scopeId: "form", layoutProfileId: "default" } });
assert.equal(runtime.beginSession().ok, true);
const controller = createUiEditorPanelController({ runtime, registry, stepSize: 2 });
assert.equal(controller.selectElement(definition.elementId).selectedElementName, "Kundenname");
assert.equal(controller.setMode("width").mode, "width");

(async () => {
  await controller.activateDirection("right");
  assert.equal(visible.element.width, 282);
  const outerBeforeText = clone(visible.element);
  controller.setLayer("text");
  assert.equal(controller.getState().mode, "text-position");
  await controller.activateDirection("left");
  await controller.activateDirection("up");
  assert.deepEqual(visible.element, outerBeforeText, "text movement must not change the outer element");
  assert.deepEqual(visible.text, { offsetX: 10, offsetY: -2, fontSize: 16 });
  controller.setMode("text-size");
  await controller.activateDirection("right");
  assert.equal(visible.text.fontSize, 18);
  await controller.activateCenter();
  assert.deepEqual(visible, { elementId: definition.elementId, element: { x: 0, y: 0, width: 280, height: 40, visible: true }, text: { offsetX: 12, offsetY: 0, fontSize: 16 } });
  controller.setLayer("element"); controller.setMode("width"); await controller.activateDirection("right");
  controller.setLayer("text"); await controller.activateDirection("left"); await controller.activateDirection("up"); controller.setMode("text-size"); await controller.activateDirection("right");
  assert.equal(runtime.saveLayout().ok, true);
  assert.deepEqual(stored[0].element.width, 282);
  assert.deepEqual(stored[0].text, { offsetX: 10, offsetY: -2, fontSize: 18 });
  assert.equal(runtime.applyChange({ elementId: definition.elementId, operation: "textResize", payload: { text: { fontSize: 41 } } }).code, "VALUE_OUT_OF_RANGE");

  failNextApply = true;
  const beforeFailure = clone(visible);
  const failed = runtime.applyChange({ elementId: definition.elementId, operation: "textMove", payload: { text: { offsetX: 14 } } });
  assert.equal(failed.code, "HOST_APPLY_FAILED");
  assert.equal(failed.rollbackComplete, true);
  assert.deepEqual(visible, beforeFailure, "element and text must roll back atomically");
  assert.equal(normalizeLayoutEntry({ elementId: "x", text: { fontSize: 12 }, rogue: 1 }).rogue, undefined);
  console.log("m72 editor model/text ok");
})();
