"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const {
  aggregateUiComponentContracts,
  orderUiComponentSelectionTargetIds,
  validateUiComponentContracts,
  validateUiComponentReferenceBindings,
} = require("../../src/index.cjs");

const SUPPORTED = ["move", "resizeWidth", "resizeHeight", "textResize", "setVisibility"];

function element(id, parentId, overrides = {}) {
  return {
    id,
    name: id,
    type: parentId == null ? "root" : "label",
    role: parentId == null ? "system" : "content",
    parentId,
    order: parentId == null ? 0 : 10,
    visible: true,
    editable: parentId != null,
    allowedOps: parentId == null ? [] : ["move", "textResize", "setVisibility"],
    lockedOps: [],
    semanticKey: id,
    registrationStatus: parentId == null ? "editorContainer" : "editorEnabled",
    refKey: `${id}.ref`,
    stableIdSource: "declaration",
    baseline: {
      x: 0, y: 0, width: 100, height: 24, textOffsetX: 0, textOffsetY: 0,
      fontSize: 12, visible: true, spacing: {}, minWidth: 8, maxWidth: 400, minHeight: 8, maxHeight: 200,
    },
    selectionKind: parentId == null ? "layoutZone" : "label",
    selectionLevels: [parentId == null ? "layoutZone" : "label"],
    spacingTargets: [],
    operationEffects: parentId == null ? {} : { move: "elementOnly", textResize: "elementOnly", setVisibility: "elementOnly" },
    operationAffectedIds: {},
    geometry: { maximumStoredOffset: 2400 },
    ...overrides,
  };
}

function completeComponent() {
  return {
    componentId: "sample.summary",
    scopeId: "sample.root",
    requiredSlots: ["root", "title", "items"],
    slots: [
      { slotId: "root", required: true, referenceKind: "single", presence: "always", element: element("sample.root", null) },
      { slotId: "title", required: true, referenceKind: "single", presence: "always", requirements: { move: true, textResize: true }, element: element("sample.title", "sample.root") },
      { slotId: "items", required: true, referenceKind: "multi", presence: "whenVisibleInstances", requirements: { textResize: true }, element: element("sample.items", "sample.root") },
    ],
  };
}

function hasCode(result, code) {
  return result.errors.some((entry) => entry.code === code);
}

function binding(componentId, slotId, elementId, targetCount, mountedInstanceCount = targetCount) {
  return { componentId, slotId, elementId, targetCount, mountedInstanceCount, referenceResolved: targetCount > 0 };
}

const valid = completeComponent();
const aggregated = aggregateUiComponentContracts([valid]);
assert.equal(aggregated.elements.length, 3);
assert.equal(validateUiComponentContracts({ components: [valid], registryElements: aggregated.elements, supportedOperations: SUPPORTED }).ok, true);

const missingSlot = completeComponent();
missingSlot.slots = missingSlot.slots.filter((slot) => slot.slotId !== "title");
assert.equal(hasCode(validateUiComponentContracts({ components: [missingSlot], supportedOperations: SUPPORTED }), "component_required_slot_missing"), true);

const validBindings = [
  binding("sample.summary", "root", "sample.root", 1),
  binding("sample.summary", "title", "sample.title", 1),
  binding("sample.summary", "items", "sample.items", 2),
];
assert.equal(validateUiComponentReferenceBindings({ components: [valid], bindings: validBindings }).ok, true);
assert.equal(hasCode(validateUiComponentReferenceBindings({ components: [valid], bindings: validBindings.filter((entry) => entry.slotId !== "title") }), "component_slot_reference_missing"), true);
assert.equal(hasCode(validateUiComponentReferenceBindings({ components: [valid], bindings: validBindings.map((entry) => entry.slotId === "title" ? { ...entry, targetCount: 2 } : entry) }), "component_single_ref_duplicate"), true);

const noVisibleInstances = validBindings.map((entry) => entry.slotId === "items"
  ? { ...entry, targetCount: 0, mountedInstanceCount: 0, referenceResolved: false }
  : entry);
assert.equal(validateUiComponentReferenceBindings({ components: [valid], bindings: noVisibleInstances }).ok, true);

const missingParent = completeComponent();
missingParent.slots[1].element = element("sample.title", "sample.missing");
assert.equal(hasCode(validateUiComponentContracts({ components: [missingParent], supportedOperations: SUPPORTED }), "component_parent_missing"), true);

const unsupported = completeComponent();
unsupported.slots[1].element = element("sample.title", "sample.root", { allowedOps: ["move", "textResize", "unknownHostOperation"] });
assert.equal(hasCode(validateUiComponentContracts({ components: [unsupported], supportedOperations: SUPPORTED }), "component_capability_unsupported"), true);

const requiredTextResize = completeComponent();
requiredTextResize.slots[1].element = element("sample.title", "sample.root", { allowedOps: ["move", "setVisibility"] });
assert.equal(hasCode(validateUiComponentContracts({ components: [requiredTextResize], supportedOperations: SUPPORTED }), "component_required_text_resize_missing"), true);

const requiredMove = completeComponent();
requiredMove.slots[1].element = element("sample.title", "sample.root", { allowedOps: ["textResize", "setVisibility"] });
assert.equal(hasCode(validateUiComponentContracts({ components: [requiredMove], supportedOperations: SUPPORTED }), "component_required_move_missing"), true);

const unboundedGeometry = completeComponent();
unboundedGeometry.slots[1].element = element("sample.title", "sample.root", {
  allowedOps: ["move", "resizeWidth", "resizeHeight", "textResize"],
  baseline: { x: 0, y: 0, width: 100, height: 24, minWidth: null, maxHeight: null },
});
assert.equal(validateUiComponentContracts({ components: [unboundedGeometry], supportedOperations: SUPPORTED }).ok, true);

const oneSidedBounds = completeComponent();
oneSidedBounds.slots[1].element = element("sample.title", "sample.root", {
  allowedOps: ["move", "resizeWidth", "resizeHeight", "textResize"],
  baseline: { x: 0, y: 0, width: 100, height: 24, minX: -500, maxY: 800, minWidth: 0, maxHeight: 500 },
});
assert.equal(validateUiComponentContracts({ components: [oneSidedBounds], supportedOperations: SUPPORTED }).ok, true);

const reversedBounds = completeComponent();
reversedBounds.slots[1].element = element("sample.title", "sample.root", {
  allowedOps: ["move", "resizeWidth", "textResize"], baseline: { minWidth: 200, maxWidth: 100 },
});
assert.equal(hasCode(validateUiComponentContracts({ components: [reversedBounds], supportedOperations: SUPPORTED }), "component_geometry_bounds_invalid"), true);

const nonFiniteBound = completeComponent();
nonFiniteBound.slots[1].element = element("sample.title", "sample.root", {
  allowedOps: ["move", "textResize"], baseline: { minX: Number.NaN },
});
assert.equal(hasCode(validateUiComponentContracts({ components: [nonFiniteBound], supportedOperations: SUPPORTED }), "component_geometry_bound_invalid"), true);

assert.deepEqual(orderUiComponentSelectionTargetIds(aggregated.elements, ["sample.root", "sample.title"]), ["sample.title", "sample.root"]);

const selectable = completeComponent();
selectable.slots[1].requirements.directSelection = true;
const swallowedBindings = validBindings.map((entry) => entry.slotId === "title" ? { ...entry, selectionTargetIds: ["sample.root", "sample.title"] } : entry);
assert.equal(hasCode(validateUiComponentReferenceBindings({ components: [selectable], bindings: swallowedBindings }), "component_child_selection_swallowed"), true);

const domainId = completeComponent();
domainId.slots[1].element = element("sample.title", "sample.root", { stableIdSource: "domainValue" });
assert.equal(hasCode(validateUiComponentContracts({ components: [domainId], supportedOperations: SUPPORTED }), "component_unstable_element_id"), true);

const centralOnly = [...aggregated.elements, element("sample.centralOnly", "sample.root")];
assert.equal(hasCode(validateUiComponentContracts({ components: [valid], registryElements: centralOnly, supportedOperations: SUPPORTED }), "component_registry_target_outside_contract"), true);

const coreSource = fs.readFileSync(path.join(__dirname, "../../src/core/ui-component-contract.cjs"), "utf8");
assert.doesNotMatch(coreSource, /restarbeiten\.|protokoll\.|bbm\./i);
assert.doesNotMatch(coreSource, /querySelector|document\.|createElement|MutationObserver/);

console.log("M83.0 component contract tests passed");
