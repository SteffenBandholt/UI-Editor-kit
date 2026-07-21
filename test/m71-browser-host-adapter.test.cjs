"use strict";

const { assert, el } = require("./m71-test-helpers.cjs");
const { createElementRefRegistry, createBrowserHostAdapter } = require("../src/index.cjs");

const refs = createElementRefRegistry();
const target = el({ left: 1, top: 2, width: 120, height: 80 });
target.style.transform = "rotate(3deg)";
target.style.width = "240px";
target.style.height = "60px";
target.style.color = "red";
target.style.setProperty("--ui-editor-x", "99px");
target.hidden = true;
refs.register("a", target);
const host = createBrowserHostAdapter({ elementRefs: refs });

assert.equal(host.validateElementRef("a").ok, true);
assert.equal(host.validateElementRef("x").code, "ELEMENT_REF_MISSING");
assert.equal(host.getCurrentLayoutEntry("a").value.width, 240);

host.applyLayoutEntry("a", { elementId: "a", x: 5, y: 6, width: 300, height: 90, visible: true });
let current = host.getCurrentLayoutEntry("a").value;
assert.deepEqual({ x: current.x, y: current.y, width: current.width, height: current.height, visible: current.visible }, { x: 5, y: 6, width: 300, height: 90, visible: true });
assert.equal(target.style.transform, "var(--ui-editor-target-transform, none) translate(var(--ui-editor-x, 0px), var(--ui-editor-y, 0px))");
assert.equal(target.style.getPropertyValue("--ui-editor-target-transform"), "rotate(3deg)");
assert.equal(target.style.transform.includes("translate"), true);
assert.equal(target.style.transform.includes("rotate(3deg) rotate"), false);

host.applyLayoutEntry("a", { elementId: "a", x: 9, y: 10 });
assert.equal(target.style.transform.match(/translate/g).length, 1);
assert.equal(target.style.getPropertyValue("--ui-editor-target-transform"), "rotate(3deg)");

const snapshot = host.captureElementLayoutState("a").value;
host.applyLayoutEntry("a", { elementId: "a", x: 20, width: 310, visible: false });
host.restoreElementLayoutState("a", snapshot);
assert.equal(target.style.getPropertyValue("--ui-editor-x"), "9px");
assert.equal(target.style.width, "300px");
assert.equal(target.hidden, false);

host.clearElementLayout("a");
assert.equal(target.style.transform, "rotate(3deg)");
assert.equal(target.style.width, "240px");
assert.equal(target.style.height, "60px");
assert.equal(target.hidden, true);
assert.equal(target.style.getPropertyValue("--ui-editor-x"), "99px");
assert.equal(target.style.color, "red");

target.throwRect = true;
assert.equal(host.getCurrentLayoutEntry("a").code, "HOST_READ_FAILED");
target.throwRect = false;
const badComputed = createBrowserHostAdapter({ elementRefs: refs, computedStyleReader() { throw new Error("computed boom"); } });
assert.equal(badComputed.getCurrentLayoutEntry("a").code, "HOST_READ_FAILED");
const badRect = createBrowserHostAdapter({ elementRefs: refs, rectReader() { return { left: 0, top: 0, width: -1, height: 10 }; } });
assert.equal(badRect.getCurrentLayoutEntry("a").code, "CURRENT_VALUE_UNAVAILABLE");

console.log("m71 browser host adapter ok");
