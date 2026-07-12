#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const {
  SELECTION_CONTRACT_VERSION,
  SelectionContractErrorCodes,
  validateSelectionTargetContract,
  validateElementRefResolver,
  validateSelectionHost,
  validateSelectionControllerContract,
  createSelectionStateSnapshot,
} = require(path.join(REPO_ROOT, "src/index.cjs"));

function createElement(name, area = 100) {
  return {
    nodeType: 1,
    nodeName: name.toUpperCase(),
    contains(other) {
      return other === this;
    },
    getBoundingClientRect() {
      return { width: area, height: 1, top: 0, left: 0, right: area, bottom: 1 };
    },
  };
}

assert.equal(SELECTION_CONTRACT_VERSION, "selection-target-contract-v1.0");
assert.equal(typeof SelectionContractErrorCodes.INVALID_ELEMENT_ID, "string");

const buttonRef = createElement("button");
let result = validateSelectionTargetContract({
  targets: [{ elementId: "app.button", label: "Button", selectable: true }],
  getElementRef: (elementId) => (elementId === "app.button" ? buttonRef : null),
});
assert.equal(result.ok, true);
assert.equal(result.boundTargetCount, 1);
assert.deepEqual(result.unavailableElementIds, []);

result = validateSelectionTargetContract({ targets: [{ elementId: "" }] });
assert.equal(result.ok, false);
assert.equal(result.errors[0].code, SelectionContractErrorCodes.INVALID_ELEMENT_ID);

result = validateSelectionTargetContract({ targets: [{ elementId: "x" }, { elementId: "x" }] });
assert.equal(result.ok, false);
assert.equal(result.errors.some((error) => error.code === SelectionContractErrorCodes.DUPLICATE_ELEMENT_ID), true);

result = validateSelectionTargetContract({ targets: [{ elementId: "missing" }] });
assert.equal(result.ok, true);
assert.deepEqual(result.unavailableElementIds, ["missing"]);

assert.equal(validateElementRefResolver(() => buttonRef, ["app.button"]).ok, true);
assert.equal(validateElementRefResolver(() => ({ tagName: "BUTTON" }), ["app.button"]).ok, false);

result = validateSelectionTargetContract({ targets: [{ elementId: "bad", elementRef: { tagName: "DIV" } }] });
assert.equal(result.ok, false);
assert.equal(result.errors.some((error) => error.code === SelectionContractErrorCodes.INLINE_ELEMENT_REF_NOT_ALLOWED), true);
assert.equal(result.normalizedTargets[0].elementRef, undefined);

result = validateSelectionTargetContract({
  targets: [{ elementId: "meta.only", metadata: { role: "demo" } }],
  getElementRef: () => null,
});
assert.equal(result.ok, true);
assert.equal(result.normalizedTargets[0].metadata.role, "demo");
assert.deepEqual(result.unavailableElementIds, ["meta.only"]);

const validHost = {
  listSelectableElementIds: () => ["app.button"],
  getElementRef: () => buttonRef,
  getSelectedElementId: () => "app.button",
  selectElement: () => undefined,
  isExcludedTarget: () => false,
};
assert.equal(validateSelectionHost(validHost).ok, true);
assert.equal(validateSelectionHost({ getSelectedElementId() {}, selectElement() {} }).ok, false);
assert.equal(validateSelectionHost({ listSelectableElementIds() {}, getElementRef() {}, selectElement() {} }).ok, false);
assert.equal(validateSelectionHost({ listSelectableElementIds() {}, getElementRef() {}, getSelectedElementId() {} }).ok, false);
assert.equal(validateSelectionHost({ ...validHost, isExcludedTarget: true }).ok, false);

const controller = {
  start() {},
  stop() {},
  destroy() {},
  isActive() { return false; },
  getState() { return {}; },
  refreshHover() {},
  syncWithSelection() {},
};
assert.equal(validateSelectionControllerContract(controller).ok, true);
assert.equal(validateSelectionControllerContract({ start() {}, stop() {} }).ok, false);

let selected = "host.truth";
const snapshot = createSelectionStateSnapshot({ getSelectedElementId: () => selected }, { active: true, selectedElementId: "ignored", hoveredElementId: "hover" });
assert.equal(snapshot.selectedElementId, "host.truth");
assert.equal(snapshot.hoveredElementId, "hover");
selected = "";
assert.equal(createSelectionStateSnapshot({ getSelectedElementId: () => selected }, { selectedElementId: "ignored" }).selectedElementId, null);
selected = null;
assert.equal(createSelectionStateSnapshot({ getSelectedElementId: () => selected }, {}).selectedElementId, null);
selected = 123;
assert.equal(createSelectionStateSnapshot({ getSelectedElementId: () => selected }, {}).selectedElementId, null);
selected = { elementId: "object.invalid" };
assert.equal(createSelectionStateSnapshot({ getSelectedElementId: () => selected }, {}).selectedElementId, null);
selected = Promise.resolve("async.invalid");
assert.equal(createSelectionStateSnapshot({ getSelectedElementId: () => selected }, {}).selectedElementId, null);
assert.equal(createSelectionStateSnapshot({ getSelectedElementId: () => { throw new Error("selection failed"); } }, {}).selectedElementId, null);

const sourceFiles = [
  "src/contracts/selectionTargetContract.js",
  "src/contracts/selectionControllerContract.js",
].map((file) => fs.readFileSync(path.join(REPO_ROOT, file), "utf8"));
const forbiddenPatterns = [
  /querySelector/,
  /querySelectorAll/,
  /getElementById/,
  /getElementsBy/,
  /closest/,
  /matches/,
  /MutationObserver/,
  /elementFromPoint/,
  /elementsFromPoint/,
  /bbm\.main\./i,
  /Bbm/,
  /CoreShell/,
  /UI-Editor Status/,
  /ipc/i,
  /LayoutStore/,
  /data-.*registry/i,
];
sourceFiles.forEach((source) => {
  forbiddenPatterns.forEach((pattern) => assert.equal(pattern.test(source), false, `forbidden pattern ${pattern}`));
});

console.log("m57 selection contract tests passed");
