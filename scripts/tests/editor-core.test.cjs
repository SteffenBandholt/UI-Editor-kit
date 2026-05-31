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
  assert.equal(typeof core.listElements, "function");
  assert.equal(typeof core.getValidationResult, "function");
  assert.equal(typeof core.size, "function");
  assert.equal(typeof core.getElementTree, "undefined");
  assert.equal(typeof core.buildElementTree, "undefined");
  assert.equal(typeof core.getElementDetails, "undefined");
  assert.equal(typeof core.getDerivedOperations, "undefined");
  assert.equal(typeof core.deriveOperations, "undefined");
  assert.equal(typeof core.createChangeRequest, "undefined");

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
