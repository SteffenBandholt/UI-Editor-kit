#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const MODULE_PATH = path.join(REPO_ROOT, "src/core/editor-ui-tree-view-model.cjs");
const { createEditorTreeViewModel } = require(MODULE_PATH);
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
    }),
    element({
      id: "workspace.group.alpha",
      name: "Alpha Group",
      type: "group",
      role: "structure",
      parentId: "workspace.area.main",
      order: 1,
      visible: true,
      editable: true,
      allowedOps: ["inspect", "rename"],
      lockedOps: [],
    }),
    element({
      id: "workspace.group.hidden",
      name: "Hidden Group",
      type: "group",
      role: "structure",
      parentId: "workspace.area.main",
      order: 2,
      visible: false,
      editable: true,
      allowedOps: ["inspect", "show"],
      lockedOps: [],
    }),
    element({
      id: "workspace.field.title",
      name: "Title Field",
      type: "field",
      role: "content",
      parentId: "workspace.group.alpha",
      order: 1,
      visible: true,
      editable: true,
      allowedOps: ["inspect", "rename"],
      lockedOps: ["resize"],
    }),
  ];
}

function createCore() {
  const registry = createUiElementRegistry();
  elements().forEach((entry) => registry.registerElement(entry));
  return createEditorCore(registry);
}

function findNode(viewModel, id) {
  return viewModel.nodes.find((node) => node.id === id);
}

function assertNoForbiddenFragments(text, label) {
  const forbiddenFragments = [
    ["Bro", "wser"].join(""),
    ["HT", "ML"].join(""),
    ["D", "OM"].join(""),
    ["Mini", "-Inspector"].join(""),
    ["Host", "-App-Demo"].join(""),
    ["Layout", "diagnose"].join(""),
    ["data", "-ui"].join(""),
    ["De", "mo"].join(""),
    ["B", "BM"].join(""),
    ["Proto", "koll"].join(""),
    ["Rest", "arbeiten"].join(""),
    ["T", "OP"].join(""),
    ["Bau", "vorhaben"].join(""),
  ];

  forbiddenFragments.forEach((fragment) => {
    assert.equal(text.includes(fragment), false, `${label} enthaelt verbotenen Fragmenttext: ${fragment}`);
  });
}

function run() {
  assert.equal(typeof createEditorTreeViewModel, "function");

  const core = createCore();
  const viewModel = createEditorTreeViewModel(core);

  assert.equal(viewModel.root.id, "workspace.root");
  assert.deepEqual(
    viewModel.root.children.map((node) => node.id),
    ["workspace.area.main"]
  );
  assert.deepEqual(
    viewModel.root.children[0].children.map((node) => node.id),
    ["workspace.group.alpha", "workspace.group.hidden"]
  );
  assert.deepEqual(viewModel.root.children[0].children[0].children.map((node) => node.id), ["workspace.field.title"]);

  assert.equal(findNode(viewModel, "workspace.root").depth, 0);
  assert.equal(findNode(viewModel, "workspace.area.main").depth, 1);
  assert.equal(findNode(viewModel, "workspace.group.alpha").depth, 2);
  assert.equal(findNode(viewModel, "workspace.field.title").depth, 3);

  assert.deepEqual(findNode(viewModel, "workspace.root").path, ["workspace.root"]);
  assert.deepEqual(findNode(viewModel, "workspace.field.title").path, [
    "workspace.root",
    "workspace.area.main",
    "workspace.group.alpha",
    "workspace.field.title",
  ]);

  const areaNode = findNode(viewModel, "workspace.area.main");
  assert.equal(areaNode.label, "Main Area");
  assert.equal(areaNode.type, "area");
  assert.equal(areaNode.role, "layout");
  assert.equal(areaNode.parentId, "workspace.root");
  assert.equal(areaNode.order, 1);
  assert.equal(areaNode.visible, true);
  assert.equal(areaNode.editable, true);

  assert.equal(findNode(viewModel, "workspace.group.hidden").visible, false);
  const withoutHidden = createEditorTreeViewModel(core, { includeHidden: false });
  assert.equal(findNode(withoutHidden, "workspace.group.hidden"), undefined);
  assert.notEqual(core.getElementDetails("workspace.group.hidden"), null);

  assert.deepEqual(areaNode.operationSummary, {
    allowedCount: 3,
    lockedCount: 1,
    availableCount: 3,
  });

  let operationExecuted = false;
  let canOperationChecked = false;
  const fakeCore = {
    getElementTree() {
      return {
        element: element(),
        children: [],
      };
    },
    getElementOperations() {
      return {
        allowedOps: ["inspect"],
        lockedOps: [],
        availableOps: ["inspect"],
      };
    },
    canElementPerformOperation() {
      canOperationChecked = true;
      return false;
    },
    executeOperation() {
      operationExecuted = true;
    },
  };
  const fakeViewModel = createEditorTreeViewModel(fakeCore);
  assert.equal(fakeViewModel.root.id, "workspace.root");
  assert.equal(operationExecuted, false);
  assert.equal(canOperationChecked, false);

  viewModel.root.label = "Mutated";
  viewModel.root.path.push("mutated");
  viewModel.root.children.length = 0;
  assert.equal(core.getElementDetails("workspace.root").name, "Workspace Root");
  assert.deepEqual(core.getElementTree().children.map((node) => node.element.id), ["workspace.area.main"]);

  assert.throws(() => createEditorTreeViewModel(), /getElementTree/);
  assert.throws(() => createEditorTreeViewModel({}), /getElementTree/);
  assert.throws(() => createEditorTreeViewModel({ getElementTree: () => ({ element: {}, children: null }) }), /Elementbaum/);

  const missingNameViewModel = createEditorTreeViewModel({
    getElementTree() {
      return {
        element: {
          id: "technical.root",
          type: "root",
          role: "layout",
          parentId: null,
          order: 0,
          visible: true,
          editable: false,
        },
        children: [],
      };
    },
  });
  assert.equal(missingNameViewModel.root.label, null);

  assertNoForbiddenFragments(fs.readFileSync(MODULE_PATH, "utf8"), "editor-ui-tree-view-model");

  console.log("TESTS OK: editor-ui-tree-view-model");
}

run();
