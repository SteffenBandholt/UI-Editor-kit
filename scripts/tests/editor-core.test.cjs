#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const CORE_PATH = path.join(REPO_ROOT, "src/core/editor-core.cjs");
const VALIDATOR_PATH = path.join(REPO_ROOT, "src/core/ui-element-validator.cjs");
const { createUiElementRegistry } = require(path.join(REPO_ROOT, "src/core/ui-element-registry.cjs"));

function validElements() {
  return [
    {
      id: "workspace.root",
      name: "Root",
      type: "root",
      role: "layout",
      parentId: null,
      order: 0,
      visible: true,
      editable: false,
      allowedOps: ["inspect"],
      lockedOps: [],
    },
    {
      id: "workspace.main.area",
      name: "Bereich",
      type: "area",
      role: "layout",
      parentId: "workspace.root",
      order: 1,
      visible: true,
      editable: true,
      allowedOps: ["inspect", "move"],
      lockedOps: [],
      layoutArea: "main",
    },
  ];
}

function treeElements() {
  return [
    {
      id: "workspace.root",
      name: "Root",
      type: "root",
      role: "layout",
      parentId: null,
      order: 0,
      visible: true,
      editable: false,
      allowedOps: ["inspect"],
      lockedOps: [],
    },
    {
      id: "workspace.main.area",
      name: "Bereich",
      type: "area",
      role: "layout",
      parentId: "workspace.root",
      order: 20,
      visible: true,
      editable: true,
      allowedOps: ["inspect"],
      lockedOps: [],
    },
    {
      id: "workspace.main.group.beta",
      name: "Gruppe Beta",
      type: "group",
      role: "layout",
      parentId: "workspace.main.area",
      order: 30,
      visible: true,
      editable: true,
      allowedOps: ["inspect"],
      lockedOps: [],
    },
    {
      id: "workspace.main.group.alpha",
      name: "Gruppe Alpha",
      type: "group",
      role: "layout",
      parentId: "workspace.main.area",
      order: 10,
      visible: true,
      editable: true,
      allowedOps: ["inspect"],
      lockedOps: [],
    },
    {
      id: "workspace.main.group.alpha.field.status",
      name: "Status",
      type: "field",
      role: "status",
      parentId: "workspace.main.group.alpha",
      order: 5,
      visible: true,
      editable: true,
      allowedOps: ["inspect"],
      lockedOps: [],
    },
    {
      id: "workspace.main.group.alpha.field.title",
      name: "Titel",
      type: "field",
      role: "content",
      parentId: "workspace.main.group.alpha",
      order: 2,
      visible: true,
      editable: true,
      allowedOps: ["inspect"],
      lockedOps: [],
    },
  ];
}

function loadCoreModule() {
  delete require.cache[CORE_PATH];
  return require(CORE_PATH);
}

function run() {
  const { createEditorCore } = loadCoreModule();

  assert.throws(
    () => createEditorCore(),
    (error) =>
      error instanceof Error &&
      error.message === "Ungueltige Registry fuer Editor-Core." &&
      error.validationResult &&
      error.validationResult.ok === false
  );

  assert.throws(
    () => createEditorCore({}),
    (error) =>
      error instanceof Error &&
      error.message === "Ungueltige Registry fuer Editor-Core." &&
      error.validationResult &&
      error.validationResult.errors[0].code === "invalid_registry_interface"
  );

  const registry = createUiElementRegistry();
  validElements().forEach((element) => registry.registerElement(element));

  const core = createEditorCore(registry);
  assert.equal(typeof core.hasElement, "function");
  assert.equal(typeof core.getElementDetails, "function");
  assert.equal(typeof core.listElements, "function");
  assert.equal(typeof core.getElementTree, "function");
  assert.equal(typeof core.getValidationResult, "function");
  assert.equal(typeof core.size, "function");
  assert.equal(typeof core.buildElementTree, "undefined");
  assert.equal(typeof core.getDerivedOperations, "undefined");
  assert.equal(typeof core.deriveOperations, "undefined");
  assert.equal(typeof core.createChangeRequest, "undefined");

  assert.equal(core.hasElement("workspace.main.area"), true);
  assert.equal(core.hasElement("workspace.unknown"), false);

  const knownElementDetails = core.getElementDetails("workspace.main.area");
  assert.deepEqual(knownElementDetails, {
    id: "workspace.main.area",
    name: "Bereich",
    type: "area",
    role: "layout",
    parentId: "workspace.root",
    order: 1,
    visible: true,
    editable: true,
    allowedOps: ["inspect", "move"],
    lockedOps: [],
    layoutArea: "main",
  });
  assert.equal(core.getElementDetails("workspace.unknown"), null);
  assert.equal(Object.prototype.hasOwnProperty.call(knownElementDetails, "layoutArea"), true);
  assert.equal(Object.prototype.hasOwnProperty.call(knownElementDetails, "columnRole"), false);

  const coreElements = core.listElements();
  assert.deepEqual(
    coreElements.map((element) => element.id),
    ["workspace.root", "workspace.main.area"]
  );
  assert.equal(core.size(), 2);

  const validationResult = core.getValidationResult();
  assert.deepEqual(validationResult, {
    ok: true,
    errors: [],
  });

  const treeRegistry = createUiElementRegistry();
  treeElements().forEach((element) => treeRegistry.registerElement(element));
  const treeCore = createEditorCore(treeRegistry);
  const elementTree = treeCore.getElementTree();

  assert.equal(elementTree.element.id, "workspace.root");
  assert.equal(elementTree.element.type, "root");
  assert.deepEqual(
    elementTree.children.map((childNode) => childNode.element.id),
    ["workspace.main.area"]
  );
  assert.deepEqual(
    elementTree.children[0].children.map((childNode) => childNode.element.id),
    ["workspace.main.group.alpha", "workspace.main.group.beta"]
  );
  assert.deepEqual(
    elementTree.children[0].children[0].children.map((childNode) => childNode.element.id),
    ["workspace.main.group.alpha.field.title", "workspace.main.group.alpha.field.status"]
  );

  const mutatedTree = treeCore.getElementTree();
  mutatedTree.element.name = "Mutated Root";
  mutatedTree.children[0].children.reverse();
  mutatedTree.children[0].children[0].element.name = "Mutated Child";
  mutatedTree.children[0].children[0].children.push({
    element: { id: "workspace.injected" },
    children: [],
  });

  const treeAfterMutation = treeCore.getElementTree();
  assert.equal(treeAfterMutation.element.name, "Root");
  assert.deepEqual(
    treeAfterMutation.children[0].children.map((childNode) => childNode.element.id),
    ["workspace.main.group.alpha", "workspace.main.group.beta"]
  );
  assert.deepEqual(
    treeAfterMutation.children[0].children[0].children.map((childNode) => childNode.element.id),
    ["workspace.main.group.alpha.field.title", "workspace.main.group.alpha.field.status"]
  );

  const registryCallLog = [];
  const stubRegistry = {
    listElements() {
      registryCallLog.push("listElements");
      return validElements();
    },
  };

  const stubCore = createEditorCore(stubRegistry);
  assert.deepEqual(registryCallLog, ["listElements"]);
  assert.equal(stubCore.size(), 2);

  const mutationRegistry = createUiElementRegistry();
  const sourceElements = validElements();
  sourceElements.forEach((element) => mutationRegistry.registerElement(element));
  const mutationCore = createEditorCore(mutationRegistry);

  const listedFromRegistry = mutationRegistry.listElements();
  listedFromRegistry[1].name = "Von Registry geaendert";
  listedFromRegistry[1].allowedOps.push("resize");

  const storedAfterRegistryMutation = mutationCore.listElements();
  assert.equal(storedAfterRegistryMutation[1].name, "Bereich");
  assert.deepEqual(storedAfterRegistryMutation[1].allowedOps, ["inspect", "move"]);

  const listedFromCore = mutationCore.listElements();
  listedFromCore[1].name = "Von Core geaendert";
  listedFromCore[1].allowedOps.push("pin");

  const listedFromCoreAgain = mutationCore.listElements();
  assert.equal(listedFromCoreAgain[1].name, "Bereich");
  assert.deepEqual(listedFromCoreAgain[1].allowedOps, ["inspect", "move"]);

  const returnedValidationResult = mutationCore.getValidationResult();
  returnedValidationResult.ok = false;
  returnedValidationResult.errors.push({ code: "mutated" });

  assert.deepEqual(mutationCore.getValidationResult(), {
    ok: true,
    errors: [],
  });

  const mutatedDetails = mutationCore.getElementDetails("workspace.main.area");
  mutatedDetails.name = "Per Details geaendert";
  mutatedDetails.allowedOps.push("pin");
  mutatedDetails.layoutArea = "changed";

  const detailsAfterMutation = mutationCore.getElementDetails("workspace.main.area");
  assert.equal(detailsAfterMutation.name, "Bereich");
  assert.deepEqual(detailsAfterMutation.allowedOps, ["inspect", "move"]);
  assert.equal(detailsAfterMutation.layoutArea, "main");
  assert.deepEqual(
    mutationCore.listElements().map((element) => element.id),
    ["workspace.root", "workspace.main.area"]
  );

  const invalidRegistry = createUiElementRegistry();
  invalidRegistry.registerElement({
    id: "workspace.invalid",
    name: "Invalid",
    type: "area",
    role: "layout",
    parentId: "workspace.root",
    order: 1,
    visible: true,
    editable: true,
    allowedOps: ["inspect"],
    lockedOps: [],
  });

  let invalidRegistryError = null;
  try {
    createEditorCore(invalidRegistry);
  } catch (error) {
    invalidRegistryError = error;
  }

  assert.ok(invalidRegistryError instanceof Error);
  assert.equal(invalidRegistryError.message, "Registry enthaelt ungueltige UI-Elemente.");
  assert.equal(invalidRegistryError.validationResult.ok, false);
  assert.ok(Array.isArray(invalidRegistryError.validationResult.errors));
  assert.ok(invalidRegistryError.validationResult.errors.length > 0);

  const invalidListRegistry = {
    listElements() {
      return "not-a-list";
    },
  };

  let invalidListError = null;
  try {
    createEditorCore(invalidListRegistry);
  } catch (error) {
    invalidListError = error;
  }

  assert.ok(invalidListError instanceof Error);
  assert.equal(invalidListError.message, "Registry enthaelt ungueltige UI-Elemente.");
  assert.equal(invalidListError.validationResult.ok, false);
  assert.equal(invalidListError.validationResult.errors[0].code, "invalid_element_list");

  const validatorModule = require(VALIDATOR_PATH);
  const originalValidateUiElementList = validatorModule.validateUiElementList;
  let validatorCallCount = 0;
  validatorModule.validateUiElementList = (elements) => {
    validatorCallCount += 1;
    return originalValidateUiElementList(elements);
  };

  try {
    const { createEditorCore: createEditorCoreWithSpy } = loadCoreModule();
    createEditorCoreWithSpy({
      listElements() {
        return validElements();
      },
    });
  } finally {
    validatorModule.validateUiElementList = originalValidateUiElementList;
    delete require.cache[CORE_PATH];
  }

  assert.equal(validatorCallCount, 1);

  const sourceText = fs.readFileSync(CORE_PATH, "utf8");
  const forbiddenMarkers = [
    "document",
    "window",
    "querySelector",
    "DOMParser",
    "Browser",
    "HTML",
    "data-ui",
    "Mini-Inspector",
    "mini-inspector",
    "demo/",
    "demo\\",
    "BBM",
    "Protokoll",
    "Restarbeiten",
    "TOP",
    "Bauvorhaben",
  ];

  forbiddenMarkers.forEach((marker) => {
    assert.equal(
      sourceText.includes(marker),
      false,
      `editor-core enthaelt verbotene Abhaengigkeitsspur: ${marker}`
    );
  });

  console.log("TESTS OK: editor-core");
}

run();
