#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const MODULE_PATH = path.join(REPO_ROOT, "src/core/editor-ui-details-view-model.cjs");
const { createEditorDetailsViewModel } = require(MODULE_PATH);
const { createUiElementRegistry } = require(path.join(REPO_ROOT, "src/core/ui-element-registry.cjs"));
const { createEditorCore } = require(path.join(REPO_ROOT, "src/core/editor-core.cjs"));

function element(overrides) {
  return {
    id: "workspace.root",
    name: "Workspace Root",
    type: "root",
    role: "layout",
    parentId: null,
    order: 0,
    visible: true,
    editable: false,
    allowedOps: ["inspect"],
    lockedOps: [],
    ...overrides,
  };
}

function elements() {
  return [
    element(),
    element({
      id: "workspace.area.main",
      name: "Main Area",
      type: "area",
      role: "layout",
      parentId: "workspace.root",
      order: 1,
      visible: true,
      editable: true,
      allowedOps: ["inspect", "move", "resize"],
      lockedOps: ["rename"],
      layoutArea: "main",
    }),
    element({
      id: "workspace.group.alpha",
      name: "Alpha Group",
      type: "group",
      role: "structure",
      parentId: "workspace.area.main",
      order: 2,
      visible: false,
      editable: true,
      allowedOps: ["inspect", "show"],
      lockedOps: ["hide"],
      width: 320,
    }),
  ];
}

function createCore() {
  const registry = createUiElementRegistry();
  elements().forEach((entry) => registry.registerElement(entry));
  return createEditorCore(registry);
}

function getFieldNames(viewModel) {
  return viewModel.detailFields.map((fieldRow) => fieldRow.field);
}

function assertNoForbiddenFragments(text, label) {
  const forbiddenFragments = [
    "Browser",
    "browser",
    "HTML",
    "html",
    "DOM",
    "Mini-Inspector",
    "Host-App-Demo",
    "Layoutdiagnose",
    "data-ui",
    "Demo",
    "BBM",
    "Protokoll",
    "Restarbeiten",
    "TOP",
    "Bauvorhaben",
  ];

  forbiddenFragments.forEach((fragment) => {
    assert.equal(text.includes(fragment), false, `${label} enthaelt verbotenen Text: ${fragment}`);
  });
}

function run() {
  assert.equal(typeof createEditorDetailsViewModel, "function");
  assert.throws(() => createEditorDetailsViewModel(), /getElementDetails/);
  assert.throws(() => createEditorDetailsViewModel(null, "workspace.root"), /getElementDetails/);
  assert.throws(() => createEditorDetailsViewModel({}, "workspace.root"), /getElementDetails/);
  assert.throws(
    () => createEditorDetailsViewModel({ getElementDetails: () => ({ id: "x" }) }, "x", "invalid"),
    /Optionen/
  );

  const core = createCore();
  const viewModel = createEditorDetailsViewModel(core, "workspace.area.main");
  assert.ok(viewModel);
  assert.equal(viewModel.elementId, "workspace.area.main");
  assert.equal(viewModel.label, "Main Area");
  assert.equal(viewModel.type, "area");
  assert.equal(viewModel.role, "layout");
  assert.equal(viewModel.parentId, "workspace.root");
  assert.equal(viewModel.order, 1);
  assert.equal(viewModel.visible, true);
  assert.equal(viewModel.editable, true);

  assert.equal(createEditorDetailsViewModel(core, "workspace.unknown"), null);

  const elementDetails = core.getElementDetails("workspace.area.main");
  assert.deepEqual(viewModel.element, elementDetails);
  assert.notEqual(viewModel.element, elementDetails);
  assert.notEqual(viewModel.element.allowedOps, elementDetails.allowedOps);
  assert.notEqual(viewModel.element.lockedOps, elementDetails.lockedOps);

  const withoutRawElement = createEditorDetailsViewModel(core, "workspace.area.main", { includeElementRaw: false });
  assert.equal(Object.prototype.hasOwnProperty.call(withoutRawElement, "element"), false);
  assert.ok(Array.isArray(withoutRawElement.detailFields));
  assert.ok(withoutRawElement.detailFields.length > 0);

  const detailFieldNames = getFieldNames(viewModel).sort();
  const coreFieldNames = Object.keys(elementDetails).sort();
  assert.deepEqual(detailFieldNames, coreFieldNames);
  ["customer", "project", "amount", "statusText", "businessData"].forEach((fieldName) => {
    assert.equal(detailFieldNames.includes(fieldName), false);
  });
  viewModel.detailFields.forEach((fieldRow) => {
    assert.equal(Object.prototype.hasOwnProperty.call(elementDetails, fieldRow.field), true);
    assert.equal(Object.keys(fieldRow).includes("classification"), false);
  });

  const coreOperations = core.getElementOperations("workspace.area.main");
  assert.deepEqual(viewModel.operations.elementId, coreOperations.elementId);
  assert.deepEqual(viewModel.operations.allowedOps, coreOperations.allowedOps);
  assert.deepEqual(viewModel.operations.lockedOps, coreOperations.lockedOps);
  assert.deepEqual(viewModel.operations.availableOps, coreOperations.availableOps);
  assert.notEqual(viewModel.operations.allowedOps, coreOperations.allowedOps);
  assert.deepEqual(viewModel.operations.allowedOps, ["inspect", "move", "resize"]);
  assert.deepEqual(viewModel.operations.lockedOps, ["rename"]);
  assert.deepEqual(viewModel.operations.availableOps, ["inspect", "move", "resize"]);
  assert.deepEqual(viewModel.operations.operationRows, [
    { operation: "inspect", state: "available" },
    { operation: "move", state: "available" },
    { operation: "resize", state: "available" },
    { operation: "rename", state: "locked" },
  ]);

  const noOperationsViewModel = createEditorDetailsViewModel(
    {
      getElementDetails(elementId) {
        assert.equal(elementId, "plain.element");
        return element({ id: "plain.element", name: "Plain Element" });
      },
    },
    "plain.element"
  );
  assert.equal(noOperationsViewModel.operations, null);

  let operationReadElementId = null;
  let operationExecuted = false;
  let changeCreated = false;
  const readOnlyCore = {
    getElementDetails(elementId) {
      return element({ id: elementId, name: "Read Only Element" });
    },
    getElementOperations(elementId) {
      operationReadElementId = elementId;
      return {
        elementId,
        allowedOps: ["inspect"],
        lockedOps: ["hide"],
        availableOps: ["inspect"],
      };
    },
    executeOperation() {
      operationExecuted = true;
    },
    createChangeRequest() {
      changeCreated = true;
    },
  };
  const readOnlyViewModel = createEditorDetailsViewModel(readOnlyCore, "read.only");
  assert.equal(operationReadElementId, "read.only");
  assert.equal(readOnlyViewModel.operations.operationRows.length, 2);
  assert.equal(operationExecuted, false);
  assert.equal(changeCreated, false);

  viewModel.element.name = "Mutated";
  viewModel.element.allowedOps.push("pin");
  viewModel.detailFields.find((fieldRow) => fieldRow.field === "name").value = "Mutated Detail";
  viewModel.operations.allowedOps.push("unpin");
  viewModel.operations.operationRows[0].state = "locked";
  assert.equal(core.getElementDetails("workspace.area.main").name, "Main Area");
  assert.deepEqual(core.getElementOperations("workspace.area.main").allowedOps, ["inspect", "move", "resize"]);

  assert.equal(core.listElements().length, 3);
  assert.equal(core.getElementTree().element.id, "workspace.root");
  assert.equal(core.getElementDetails("workspace.group.alpha").name, "Alpha Group");
  assert.deepEqual(core.getElementOperations("workspace.group.alpha"), {
    elementId: "workspace.group.alpha",
    allowedOps: ["inspect", "show"],
    lockedOps: ["hide"],
    availableOps: ["inspect", "show"],
  });

  assertNoForbiddenFragments(fs.readFileSync(MODULE_PATH, "utf8"), "editor-ui-details-view-model");

  console.log("TESTS OK: editor-ui-details-view-model");
}

run();
