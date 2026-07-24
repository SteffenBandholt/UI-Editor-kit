"use strict";
const assert = require("node:assert/strict");
const {
  BROWSER_ERROR_CODES,
  RUNTIME_ERROR_CODES,
  createBrowserHostAdapter,
  createElementRefRegistry,
  createUiEditorPanelController,
  normalizeLayoutEntry,
  resolveOperationStep,
  validateChangeRequestStepAlignment,
  validateLayoutEntryForElement,
} = require("../src/index.cjs");
const { wrapRuntimeWithStepValidation } = require("../src/runtime/step-validating-ui-editor-runtime.cjs");
const { el } = require("./m71-test-helpers.cjs");

assert.deepEqual(
  normalizeLayoutEntry({ elementId: "nested", element: { x: 1 }, text: { offsetX: 2, offsetY: 3, fontSize: 14 }, textOffsetX: 99, textOffsetY: 99, fontSize: 99 }),
  { elementId: "nested", element: { x: 1 }, text: { offsetX: 2, offsetY: 3, fontSize: 14 } },
);

assert.equal(resolveOperationStep({ registryElement: { steps: { move: 5 } }, operation: "move", panelStepSize: 99 }), 5);
assert.equal(resolveOperationStep({ registryElement: { steps: { resize: 4, resizeWidth: 7 } }, operation: "resize", axis: "width", panelStepSize: 99 }), 7);
assert.equal(resolveOperationStep({ registryElement: { steps: { resize: 4 } }, operation: "resize", axis: "width", panelStepSize: 99 }), 4);
assert.equal(resolveOperationStep({ registryElement: { steps: { resize: 4, resizeHeight: 8 } }, operation: "resize", axis: "height", panelStepSize: 99 }), 8);
assert.equal(resolveOperationStep({ registryElement: { steps: { textMove: 2, textMoveX: 6 } }, operation: "textMove", axis: "x", panelStepSize: 99 }), 6);
assert.equal(resolveOperationStep({ registryElement: { steps: { textMove: 2, textMoveY: 9 } }, operation: "textMove", axis: "y", panelStepSize: 99 }), 9);
assert.equal(resolveOperationStep({ registryElement: { steps: { fontSize: 3 } }, operation: "fontSize", panelStepSize: 99 }), 3);
assert.equal(resolveOperationStep({ registryElement: { steps: { move: -1 } }, operation: "move", panelStepSize: 4 }), 4);
assert.equal(resolveOperationStep({ registryElement: { steps: { move: Infinity } }, operation: "move", panelStepSize: 0 }), 1);

const stepRegistryElement = {
  elementId: "runtime-target",
  operations: { move: true, resizeWidth: true, resizeHeight: true, textMove: true, textResize: true },
  steps: { move: 5, resizeWidth: 7, resizeHeight: 8, textMoveX: 6, textMoveY: 9, fontSize: 3 },
};
const currentRuntimeEntry = {
  elementId: "runtime-target",
  element: { x: 3, y: -2, width: 101, height: 39 },
  text: { offsetX: 1, offsetY: 2, fontSize: 10 },
};
[
  [{ element: { x: 8 } }, null],
  [{ element: { y: -7 } }, null],
  [{ element: { width: 108 } }, null],
  [{ element: { height: 47 } }, null],
  [{ text: { offsetX: 7 } }, null],
  [{ text: { offsetY: -7 } }, null],
  [{ text: { fontSize: 13 } }, null],
  [{ element: { x: -2 } }, null],
  [{ element: { x: 7 } }, RUNTIME_ERROR_CODES.VALUE_NOT_ALIGNED_TO_STEP],
  [{ element: { width: 105 } }, RUNTIME_ERROR_CODES.VALUE_NOT_ALIGNED_TO_STEP],
  [{ text: { offsetX: 4 } }, RUNTIME_ERROR_CODES.VALUE_NOT_ALIGNED_TO_STEP],
  [{ text: { fontSize: 12 } }, RUNTIME_ERROR_CODES.VALUE_NOT_ALIGNED_TO_STEP],
].forEach(([payload, expectedCode]) => {
  const result = validateChangeRequestStepAlignment({
    registryElement: stepRegistryElement,
    currentEntry: currentRuntimeEntry,
    changeRequest: { elementId: "runtime-target", payload },
  });
  assert.equal(result && result.code, expectedCode);
});
assert.equal(validateChangeRequestStepAlignment({
  registryElement: { ...stepRegistryElement, steps: {} },
  currentEntry: currentRuntimeEntry,
  changeRequest: { elementId: "runtime-target", payload: { element: { x: 7 } } },
}), null, "registry entries without explicit steps must not be blocked");

const directCalls = [];
const fakeRuntime = {
  inspectElement() { return { ok: true, effectiveLayout: JSON.parse(JSON.stringify(currentRuntimeEntry)) }; },
  applyChange(request) { directCalls.push(JSON.parse(JSON.stringify(request))); return { ok: true }; },
};
const wrappedRuntime = wrapRuntimeWithStepValidation(fakeRuntime, {
  getElementById(id) { return id === "runtime-target" ? stepRegistryElement : null; },
});
const blockedDirect = wrappedRuntime.applyChange({ elementId: "runtime-target", operation: "move", payload: { element: { x: 7 } } });
assert.equal(blockedDirect.code, RUNTIME_ERROR_CODES.VALUE_NOT_ALIGNED_TO_STEP);
assert.equal(directCalls.length, 0, "blocked direct runtime calls must not reach the host/session runtime");
assert.equal(wrappedRuntime.applyChange({ elementId: "runtime-target", operation: "move", payload: { element: { x: 8 } } }).ok, true);
assert.equal(directCalls.length, 1);

const refs = createElementRefRegistry();
const outer = el({ left: 7, top: 9, width: 100, height: 40 });
const text = el({ left: 7, top: 9, width: 100, height: 20 });
outer.style.width = "100px";
outer.style.height = "40px";
outer.style.transform = "scale(1)";
refs.register("computed-text", outer);
const host = createBrowserHostAdapter({
  elementRefs: refs,
  getTextRef: (id) => id === "computed-text" ? text : null,
  registry: { getElementById: () => ({ operations: { textMove: true, textResize: true } }) },
  computedStyleReader(element) {
    if (element === text) return { textIndent: "8px", paddingTop: "2px", fontSize: "12px", transform: "rotate(2deg)" };
    return { width: "100px", height: "40px", transform: "scale(1)" };
  },
});
const beforeOuter = { rect: outer.getBoundingClientRect(), width: outer.style.width, height: outer.style.height, transform: outer.style.transform };
assert.equal(host.applyLayoutEntry("computed-text", { elementId: "computed-text", text: { offsetX: 3 } }).ok, true);
assert.equal(text.style.textIndent, "11px");
assert.equal(host.applyLayoutEntry("computed-text", { elementId: "computed-text", text: { offsetY: 5 } }).ok, true);
assert.equal(text.style.transform, "rotate(2deg) translateY(5px)");
assert.equal(text.style.paddingTop || "", "");
assert.equal(host.applyLayoutEntry("computed-text", { elementId: "computed-text", text: { fontSize: 18 } }).ok, true);
assert.equal(text.style.fontSize, "18px");
assert.deepEqual({ rect: outer.getBoundingClientRect(), width: outer.style.width, height: outer.style.height, transform: outer.style.transform }, beforeOuter);
host.clearElementLayout("computed-text");
assert.equal(text.style.textIndent || "", "", "computed textIndent ownership must return to the stylesheet");
assert.equal(text.style.paddingTop || "", "");
assert.equal(text.style.fontSize || "", "");
assert.equal(text.style.transform || "", "", "computed transform ownership must return to the stylesheet");
assert.equal(outer.style.getPropertyValue("--ui-editor-text-offset-x"), "");
assert.equal(outer.style.getPropertyValue("--ui-editor-text-offset-y"), "");
assert.equal(outer.style.getPropertyValue("--ui-editor-text-font-size"), "");
assert.equal(outer.style.getPropertyValue("--ui-editor-text-transform"), "");

const noTextRefs = createElementRefRegistry();
const nativeInput = el({ left: 1, top: 2, width: 120, height: 30 });
nativeInput.value = "unchanged";
nativeInput.style.paddingTop = "6px";
noTextRefs.register("native", nativeInput);
const noTextHost = createBrowserHostAdapter({ elementRefs: noTextRefs });
const nativeBefore = { paddingTop: nativeInput.style.paddingTop, transform: nativeInput.style.transform || "", value: nativeInput.value };
const unsupported = noTextHost.applyLayoutEntry("native", { elementId: "native", text: { offsetY: 4 } });
assert.equal(unsupported.code, BROWSER_ERROR_CODES.TEXT_OFFSET_Y_UNSUPPORTED);
assert.deepEqual({ paddingTop: nativeInput.style.paddingTop, transform: nativeInput.style.transform || "", value: nativeInput.value }, nativeBefore);
assert.equal(nativeInput.style.getPropertyValue("--ui-editor-text-offset-y"), "", "unsupported changes must not be stored");

const registryElement = {
  elementId: "panel-target", displayName: "Panel target", editable: true,
  operations: { move: true, resizeWidth: true, resizeHeight: true, textMove: true, textResize: true },
  limits: { minWidth: 10, maxWidth: 40, minHeight: 10, maxHeight: 50, minTextOffsetX: -5, maxTextOffsetX: 10, minTextOffsetY: -10, maxTextOffsetY: 12, minFontSize: 8, maxFontSize: 20 },
  steps: { move: 5, resizeWidth: 7, resizeHeight: 8, textMoveX: 6, textMoveY: 9, fontSize: 3 },
};
[
  [{ element: { width: 9 } }, "width"], [{ element: { width: 41 } }, "width"],
  [{ element: { height: 9 } }, "height"], [{ element: { height: 51 } }, "height"],
  [{ text: { offsetX: -6 } }, "offsetX"], [{ text: { offsetX: 11 } }, "offsetX"],
  [{ text: { offsetY: -11 } }, "offsetY"], [{ text: { offsetY: 13 } }, "offsetY"],
  [{ text: { fontSize: 7 } }, "fontSize"], [{ text: { fontSize: 21 } }, "fontSize"],
].forEach(([values, field]) => {
  const result = validateLayoutEntryForElement({ elementId: registryElement.elementId, ...values }, registryElement);
  assert.equal(result.code, "VALUE_OUT_OF_RANGE", `${field} limit must be enforced`);
});
const memory = { elementId: registryElement.elementId, element: { x: 0, y: 0, width: 20, height: 20 }, text: { offsetX: 1, offsetY: 2, fontSize: 10 } };
const calls = [];
const clone = (value) => JSON.parse(JSON.stringify(value));
const runtime = {
  inspectElement() { return { ok: true, allowedOps: Object.keys(registryElement.operations), effectiveOps: Object.keys(registryElement.operations), currentEntry: clone(memory) }; },
  applyChange(request) { calls.push(clone(request)); Object.assign(memory.element, request.payload.element || {}); Object.assign(memory.text, request.payload.text || {}); return { ok: true }; },
  getSessionStatus() { return { ok: true, active: true, changedCount: 0, changedElementIds: [] }; },
  getPersistenceStatus() { return { available: true, persistent: true }; },
  discardElementChanges() { return { ok: true }; },
};
const registry = { getElementById: (id) => id === registryElement.elementId ? registryElement : null };
const controller = createUiEditorPanelController({ runtime, registry, stepSize: 99 });

(async () => {
  controller.selectElement(registryElement.elementId);
  await controller.activateDirection("right");
  assert.equal(memory.element.x, 5);
  controller.setMode("width"); await controller.activateDirection("right"); assert.equal(memory.element.width, 27);
  controller.setMode("height"); await controller.activateDirection("down"); assert.equal(memory.element.height, 28);
  controller.setLayer("text"); controller.setMode("text-position");
  await controller.activateDirection("right"); assert.deepEqual(calls.at(-1).payload, { text: { offsetX: 7 } });
  await controller.activateDirection("up"); assert.deepEqual(calls.at(-1).payload, { text: { offsetY: -7 } });
  controller.setMode("text-size"); await controller.activateDirection("right"); assert.deepEqual(calls.at(-1).payload, { text: { fontSize: 13 } });

  controller.setMode("text-position");
  memory.text.offsetX = 10;
  const callCount = calls.length;
  await controller.activateDirection("right");
  assert.equal(calls.length, callCount, "limit failures must not apply partial changes");
  assert.equal(controller.getState().lastResult.code, "MAX_TEXT_OFFSET_REACHED");
  assert.deepEqual(memory.element, { x: 5, y: 0, width: 27, height: 28 }, "panel text operations must not affect outer geometry");
  console.log("m72 corrections ok");
})().catch((error) => { console.error(error); process.exitCode = 1; });