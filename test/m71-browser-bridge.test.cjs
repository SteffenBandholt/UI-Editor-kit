"use strict";

const { assert, el, registry } = require("./m71-test-helpers.cjs");
const { createElementRefRegistry, createBrowserSelectionHost, createUiEditorBrowserBridge } = require("../src/index.cjs");

const refs = createElementRefRegistry();
const element = el();
refs.register("a", element);
const selectionHost = createBrowserSelectionHost({ registry: registry(), elementRefs: refs });
const calls = [];
const controllerListeners = new Set();
let state = { selectedElementId: null, busy: false, runtimeStatus: { changedCount: 0, changedElementIds: [] }, lastResult: null, dialog: { open: false } };
let runtimeOperations = 0;
const controller = {
  selectElement(id) { calls.push(["select", id]); state = { ...state, selectedElementId: id }; controllerListeners.forEach((listener) => listener(state)); },
  clearSelection() { calls.push(["clear"]); state = { ...state, selectedElementId: null }; controllerListeners.forEach((listener) => listener(state)); },
  subscribe(listener) { controllerListeners.add(listener); return () => controllerListeners.delete(listener); },
  simulateOperation(code) {
    runtimeOperations += 1;
    state = { ...state, busy: true, lastResult: null };
    controllerListeners.forEach((listener) => listener(state));
    state = { ...state, busy: false, runtimeStatus: { changedCount: state.runtimeStatus.changedCount + 1, changedElementIds: ["a"] }, lastResult: { ok: true, code } };
    controllerListeners.forEach((listener) => listener(state));
  },
};
const overlay = { show: (id, ref) => calls.push(["show", id, ref === element]), hide: () => calls.push(["hide"]), update: () => { calls.push(["update"]); return { ok: true }; } };
const bridge = createUiEditorBrowserBridge({ controller, elementRefs: refs, selectionHost, overlayHost: overlay });

selectionHost.select("a");
assert.deepEqual(calls.slice(0, 2), [["select", "a"], ["show", "a", true]]);
assert.equal(calls.filter((call) => call[0] === "update").length, 0);

controller.simulateOperation("CHANGE_APPLIED");
assert.equal(calls.filter((call) => call[0] === "update").length, 1);
controller.simulateOperation("LAYOUT_LOADED");
controller.simulateOperation("ELEMENT_RESET_TO_DEFAULTS");
controller.simulateOperation("LAYOUT_RESET_TO_DEFAULTS");
controller.simulateOperation("ALL_CHANGES_DISCARDED");
assert.equal(calls.filter((call) => call[0] === "update").length, 5);
assert.equal(runtimeOperations, 5);

state = { ...state, busy: true, lastResult: { ok: true, code: "CHANGE_APPLIED" } };
controllerListeners.forEach((listener) => listener(state));
assert.equal(calls.filter((call) => call[0] === "update").length, 5);
state = { ...state, busy: false, runtimeStatus: { changedCount: 99, changedElementIds: ["a"] }, lastResult: { ok: true, code: "CHANGE_APPLIED" } };
controllerListeners.forEach((listener) => listener(state));
assert.equal(calls.filter((call) => call[0] === "update").length, 6);

bridge.clearSelection();
assert.equal(calls.some((call) => call[0] === "clear"), true);
assert.equal(calls.some((call) => call[0] === "hide"), true);
bridge.destroy();
controller.simulateOperation("CHANGE_APPLIED");
selectionHost.select("a");
assert.equal(calls.filter((call) => call[0] === "select").length, 1);
assert.equal(calls.filter((call) => call[0] === "update").length, 6);
assert.equal(bridge.updateOverlay().code, "BRIDGE_DESTROYED");

console.log("m71 browser bridge ok");
