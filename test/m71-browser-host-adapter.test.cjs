"use strict";

const { assert, el } = require("./m71-test-helpers.cjs");
const { createElementRefRegistry, createBrowserHostAdapter, createUiEditorRuntime } = require("../src/index.cjs");

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
assert.equal(target.style.transform, "var(--ui-editor-target-transform) translate(var(--ui-editor-x, 0px), var(--ui-editor-y, 0px))");
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

const rollbackRefs = createElementRefRegistry();
const rollbackTarget = el({ left: 0, top: 0, width: 120, height: 80 });
rollbackTarget.style.transform = "rotate(3deg)";
rollbackTarget.style.width = "240px";
rollbackTarget.style.height = "60px";
rollbackTarget.style.setProperty("--ui-editor-x", "99px");
rollbackTarget.hidden = true;
rollbackRefs.register("rollback", rollbackTarget);
const rollbackHost = createBrowserHostAdapter({ elementRefs: rollbackRefs });
rollbackHost.applyLayoutEntry("rollback", { elementId: "rollback", x: 10, width: 300, height: 90, visible: true });
const rollbackSnapshot = rollbackHost.captureElementLayoutState("rollback").value;
rollbackHost.clearElementLayout("rollback");
assert.equal(rollbackTarget.style.transform, "rotate(3deg)");
assert.equal(rollbackTarget.style.width, "240px");
assert.equal(rollbackTarget.hidden, true);
rollbackHost.restoreElementLayoutState("rollback", rollbackSnapshot);
assert.equal(rollbackTarget.style.getPropertyValue("--ui-editor-x"), "10px");
assert.equal(rollbackTarget.style.width, "300px");
assert.equal(rollbackTarget.style.height, "90px");
assert.equal(rollbackTarget.hidden, false);
rollbackHost.clearElementLayout("rollback");
assert.equal(rollbackTarget.style.transform, "rotate(3deg)");
assert.equal(rollbackTarget.style.width, "240px");
assert.equal(rollbackTarget.style.height, "60px");
assert.equal(rollbackTarget.hidden, true);
assert.equal(rollbackTarget.style.getPropertyValue("--ui-editor-x"), "99px");

const noOwnershipRefs = createElementRefRegistry();
const noOwnershipTarget = el();
noOwnershipTarget.style.transform = "scale(2)";
noOwnershipTarget.style.width = "111px";
noOwnershipRefs.register("plain", noOwnershipTarget);
const noOwnershipHost = createBrowserHostAdapter({ elementRefs: noOwnershipRefs });
const noOwnershipSnapshot = noOwnershipHost.captureElementLayoutState("plain").value;
noOwnershipTarget.style.transform = "scale(3)";
noOwnershipTarget.style.width = "222px";
noOwnershipHost.restoreElementLayoutState("plain", noOwnershipSnapshot);
noOwnershipHost.clearElementLayout("plain");
assert.equal(noOwnershipTarget.style.transform, "scale(2)");
assert.equal(noOwnershipTarget.style.width, "111px");

const computedRefs = createElementRefRegistry();
const computedTarget = el({ left: 0, top: 0, width: 120, height: 80 });
computedRefs.register("computed", computedTarget);
const computedHost = createBrowserHostAdapter({
  elementRefs: computedRefs,
  computedStyleReader(element) {
    return element === computedTarget ? { transform: "matrix(0.9998, 0.0175, -0.0175, 0.9998, 0, 0)", width: "120px", height: "80px" } : null;
  },
});
computedHost.applyLayoutEntry("computed", { elementId: "computed", x: 5, y: 0 });
assert.equal(computedTarget.style.transform, "var(--ui-editor-target-transform) translate(var(--ui-editor-x, 0px), var(--ui-editor-y, 0px))");
assert.equal(computedTarget.style.transform.includes("none translate"), false);
assert.equal(computedTarget.style.getPropertyValue("--ui-editor-target-transform"), "matrix(0.9998, 0.0175, -0.0175, 0.9998, 0, 0)");
computedHost.clearElementLayout("computed");
assert.equal(computedTarget.style.transform, "");
assert.equal(computedTarget.style.getPropertyValue("--ui-editor-target-transform"), "");

const emptyTransformRefs = createElementRefRegistry();
const emptyTransformTarget = el({ left: 0, top: 0, width: 120, height: 80 });
emptyTransformRefs.register("empty", emptyTransformTarget);
const emptyTransformHost = createBrowserHostAdapter({
  elementRefs: emptyTransformRefs,
  computedStyleReader() { return { transform: "none", width: "120px", height: "80px" }; },
});
emptyTransformHost.applyLayoutEntry("empty", { elementId: "empty", x: 5, y: 6 });
assert.equal(emptyTransformTarget.style.transform, "translate(var(--ui-editor-x, 0px), var(--ui-editor-y, 0px))");
assert.equal(emptyTransformTarget.style.transform.includes("none translate"), false);
assert.equal(emptyTransformTarget.style.getPropertyValue("--ui-editor-target-transform"), "");
emptyTransformHost.clearElementLayout("empty");
assert.equal(emptyTransformTarget.style.transform, "");

const inlineTransformRefs = createElementRefRegistry();
const inlineTransformTarget = el({ left: 0, top: 0, width: 120, height: 80 });
inlineTransformTarget.style.transform = "rotate(3deg)";
inlineTransformRefs.register("inline", inlineTransformTarget);
const inlineTransformHost = createBrowserHostAdapter({ elementRefs: inlineTransformRefs });
inlineTransformHost.applyLayoutEntry("inline", { elementId: "inline", x: 5, y: 6 });
assert.equal(inlineTransformTarget.style.getPropertyValue("--ui-editor-target-transform"), "rotate(3deg)");
assert.equal(inlineTransformTarget.style.transform, "var(--ui-editor-target-transform) translate(var(--ui-editor-x, 0px), var(--ui-editor-y, 0px))");
inlineTransformHost.clearElementLayout("inline");
assert.equal(inlineTransformTarget.style.transform, "rotate(3deg)");

const repeatedMoveRefs = createElementRefRegistry();
const repeatedMoveTarget = el({ left: 0, top: 0, width: 120, height: 80 });
repeatedMoveTarget.style.transform = "rotate(3deg)";
repeatedMoveRefs.register("repeat", repeatedMoveTarget);
const repeatedMoveHost = createBrowserHostAdapter({ elementRefs: repeatedMoveRefs });
repeatedMoveHost.applyLayoutEntry("repeat", { elementId: "repeat", x: 5, y: 6 });
repeatedMoveHost.applyLayoutEntry("repeat", { elementId: "repeat", x: 10, y: 12 });
assert.equal(repeatedMoveTarget.style.transform.match(/translate/g).length, 1);
assert.equal(repeatedMoveTarget.style.getPropertyValue("--ui-editor-target-transform"), "rotate(3deg)");

function createRuntimeStorage() {
  let entries = [];
  let staleDelete = false;
  return {
    available: true,
    persistent: true,
    setStaleDelete(value) { staleDelete = value; },
    readResult() { return { ok: true, entries: JSON.parse(JSON.stringify(entries)) }; },
    write(_context, nextEntries) { entries = JSON.parse(JSON.stringify(nextEntries || [])); return { ok: true }; },
    clear() { entries = []; return { ok: true }; },
    deleteEntry(_context, elementId) { if (!staleDelete) entries = entries.filter((entry) => entry.elementId !== elementId); staleDelete = false; return { ok: true }; },
  };
}
const runtimeRefs = createElementRefRegistry();
const runtimeTarget = el({ left: 0, top: 0, width: 120, height: 80 });
runtimeTarget.style.transform = "rotate(3deg)";
runtimeTarget.style.width = "240px";
runtimeTarget.style.height = "60px";
runtimeTarget.hidden = true;
runtimeRefs.register("runtime.card", runtimeTarget);
const runtimeHost = createBrowserHostAdapter({ elementRefs: runtimeRefs });
const runtimeStorage = createRuntimeStorage();
const runtimeRegistry = {
  getElementById(id) { return id === "runtime.card" ? { id, name: "Card", editable: true, allowedOps: ["move", "resize", "show", "hide"], lockedOps: [] } : null; },
  listElements() { return [this.getElementById("runtime.card")]; },
};
const runtime = createUiEditorRuntime({
  registry: runtimeRegistry,
  hostAdapter: runtimeHost,
  layoutStorage: runtimeStorage,
  targetContext: { targetAppId: "app", moduleId: "module", scopeId: "scope", layoutProfileId: "profile" },
});
assert.equal(runtime.beginSession().ok, true);
assert.equal(runtime.applyChange({ elementId: "runtime.card", operation: "move", payload: { x: 10 }, changeId: "c1", createdAt: "now", source: "test" }).ok, true);
assert.equal(runtime.saveLayout().ok, true);
runtimeStorage.setStaleDelete(true);
const failedReset = runtime.resetElementToDefaults("runtime.card");
assert.equal(failedReset.code, "STORAGE_VERIFY_FAILED");
assert.equal(failedReset.rollbackComplete, true);
assert.equal(runtimeTarget.style.getPropertyValue("--ui-editor-x"), "10px");
assert.equal(runtimeTarget.style.width, "240px");
assert.equal(runtimeTarget.hidden, true);
assert.equal(runtime.resetElementToDefaults("runtime.card").ok, true);
assert.equal(runtimeTarget.style.transform, "rotate(3deg)");
assert.equal(runtimeTarget.style.width, "240px");
assert.equal(runtimeTarget.style.height, "60px");
assert.equal(runtimeTarget.hidden, true);

console.log("m71 browser host adapter ok");
