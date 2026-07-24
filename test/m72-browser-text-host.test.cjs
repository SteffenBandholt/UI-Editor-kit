"use strict";
const { assert, el } = require("./m71-test-helpers.cjs");
const { createElementRefRegistry, createBrowserHostAdapter } = require("../src/index.cjs");

const refs = createElementRefRegistry();
const textRefs = createElementRefRegistry();
const input = el({ left: 0, top: 0, width: 280, height: 40 });
const text = el({ left: 12, top: 0, width: 240, height: 20 });
input.style.width = "280px";
input.style.height = "40px";
input.style.transform = "scale(1)";
text.style.fontSize = "16px";
text.style.textIndent = "3px";
text.style.paddingTop = "4px";
text.style.transform = "rotate(1deg)";
refs.register("customer.name", input);
textRefs.register("customer.name", text);

const definition = { elementId: "customer.name", operations: { move: true, resizeWidth: true, resizeHeight: true, textMove: true, textResize: true } };
const registry = { getElementById: (id) => id === definition.elementId ? definition : null };
const host = createBrowserHostAdapter({ elementRefs: refs, textRefs, registry, computedStyleReader: (element) => ({ fontSize: element.style.fontSize || "16px" }) });
const originalRect = input.getBoundingClientRect();
const originalOuter = { transform: input.style.transform, width: input.style.width, height: input.style.height };
const snapshot = host.captureElementLayoutState(definition.elementId).value;

assert.equal(host.applyLayoutEntry(definition.elementId, { elementId: definition.elementId, text: { offsetX: 12, offsetY: 2, fontSize: 20 } }).ok, true);
assert.equal(text.style.textIndent, "15px", "offsetX is relative to the original 3px indent");
assert.equal(text.style.paddingTop, "4px", "offsetY must not use paddingTop");
assert.equal(text.style.transform, "rotate(1deg) translateY(2px)");
assert.equal(text.style.fontSize, "20px");
assert.deepEqual(input.getBoundingClientRect(), originalRect, "text styles must not resize or move the outer element");
assert.deepEqual({ transform: input.style.transform, width: input.style.width, height: input.style.height }, originalOuter);
assert.deepEqual(host.getCurrentLayoutEntry(definition.elementId).value.text, { offsetX: 12, offsetY: 2, fontSize: 20 });

host.restoreElementLayoutState(definition.elementId, snapshot);
assert.equal(text.style.textIndent, "3px");
assert.equal(text.style.paddingTop, "4px");
assert.equal(text.style.fontSize, "16px");
assert.equal(text.style.transform, "rotate(1deg)");
console.log("m72 browser text host ok");
