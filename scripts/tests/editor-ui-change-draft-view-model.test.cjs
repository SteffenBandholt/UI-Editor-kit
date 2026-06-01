#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const MODULE_PATH = path.join(REPO_ROOT, "src/core/editor-ui-change-draft-view-model.cjs");
const { createEditorChangeDraftViewModel } = require(MODULE_PATH);
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

function createCore() {
  const registry = createUiElementRegistry();
  [
    element(),
    element({
      id: "workspace.panel.main",
      name: "Main Panel",
      type: "area",
      role: "layout",
      parentId: "workspace.root",
      order: 1,
      visible: true,
      editable: true,
      allowedOps: ["inspect", "move", "resize"],
      lockedOps: ["hide"],
    }),
  ].forEach((entry) => registry.registerElement(entry));

  return createEditorCore(registry);
}

function changeRequest(overrides) {
  return {
    changeId: "change-001",
    elementId: "workspace.panel.main",
    operation: "resize",
    payload: {
      width: 320,
      nested: {
        unit: "px",
      },
    },
    createdAt: "2026-01-02T03:04:05.000Z",
    source: "editor-ui-test",
    ...overrides,
  };
}

function payloadFieldNames(viewModel) {
  return viewModel.payloadRows.map((row) => row.field).sort();
}

function assertRejectedWith(result, code) {
  assert.equal(result.ok, false);
  assert.equal(result.errors.some((error) => error.code === code), true, `Fehlercode fehlt: ${code}`);
}

function assertNoForbiddenFragments(text, label) {
  const forbiddenFragments = [
    "Browser",
    "browser",
    "HTML",
    "html",
    "DOM",
    "Mini-Inspector",
    "Host-App-" + "Demo",
    "Layout" + "diagnose",
    "data-" + "ui",
    "Demo",
    "B" + "BM",
    "Proto" + "koll",
    "Rest" + "arbeiten",
    "T" + "OP",
    "Bau" + "vorhaben",
  ];

  forbiddenFragments.forEach((fragment) => {
    assert.equal(text.includes(fragment), false, `${label} enthaelt verbotenen Text: ${fragment}`);
  });
}

function createSpyCore(options) {
  const calls = [];
  const elementDetails = element({
    id: "workspace.panel.main",
    name: "Main Panel",
    type: "area",
    role: "layout",
    parentId: "workspace.root",
    order: 1,
    visible: true,
    editable: true,
    allowedOps: ["inspect", "resize"],
    lockedOps: [],
  });

  return {
    calls,
    state: {
      touched: false,
    },
    hasElement(elementId) {
      calls.push(["hasElement", elementId]);
      return options && options.exists === false ? false : elementId === "workspace.panel.main";
    },
    canElementPerformOperation(elementId, operation) {
      calls.push(["canElementPerformOperation", elementId, operation]);
      return !(options && options.canPerform === false) && operation === "resize";
    },
    getElementDetails(elementId) {
      calls.push(["getElementDetails", elementId]);
      if (elementId !== "workspace.panel.main") {
        return null;
      }
      return {
        ...elementDetails,
        allowedOps: elementDetails.allowedOps.slice(),
        lockedOps: elementDetails.lockedOps.slice(),
      };
    },
    getElementOperations(elementId) {
      calls.push(["getElementOperations", elementId]);
      if (elementId !== "workspace.panel.main") {
        return null;
      }
      return {
        elementId,
        allowedOps: ["inspect", "resize", "hide"],
        lockedOps: ["hide"],
        availableOps: ["inspect", "resize"],
      };
    },
    executeChange() {
      this.state.touched = true;
      throw new Error("Darf nicht aufgerufen werden.");
    },
    contactAdapter() {
      this.state.touched = true;
      throw new Error("Darf nicht aufgerufen werden.");
    },
    saveLayoutState() {
      this.state.touched = true;
      throw new Error("Darf nicht aufgerufen werden.");
    },
  };
}

function run() {
  assert.equal(typeof createEditorChangeDraftViewModel, "function");
  assert.throws(() => createEditorChangeDraftViewModel(), /Editor-Core/);
  assert.throws(() => createEditorChangeDraftViewModel(null, changeRequest()), /Editor-Core/);
  assert.throws(() => createEditorChangeDraftViewModel({}, changeRequest()), /hasElement/);
  assert.throws(() => createEditorChangeDraftViewModel(createCore(), changeRequest(), "invalid"), /Optionen/);

  const core = createCore();
  const validRequest = changeRequest();
  const viewModel = createEditorChangeDraftViewModel(core, validRequest);
  assert.ok(viewModel);
  assert.equal(viewModel.validation.ok, true);
  assert.equal(viewModel.canSubmit, true);

  const unknownElement = createEditorChangeDraftViewModel(core, changeRequest({ elementId: "workspace.unknown" }));
  assertRejectedWith(unknownElement.validation, "unknown_element");
  assert.equal(unknownElement.canSubmit, false);
  assert.equal(unknownElement.elementSummary, null);
  assert.equal(unknownElement.operationSummary, null);

  const deniedOperation = createEditorChangeDraftViewModel(core, changeRequest({ operation: "rename" }));
  assertRejectedWith(deniedOperation.validation, "operation_not_allowed");
  assert.equal(deniedOperation.canSubmit, false);

  const lockedOperation = createEditorChangeDraftViewModel(core, changeRequest({ operation: "hide" }));
  assertRejectedWith(lockedOperation.validation, "operation_not_allowed");
  assert.equal(lockedOperation.operationSummary.isAllowed, false);
  assert.equal(lockedOperation.operationSummary.isLocked, true);
  assert.equal(lockedOperation.operationSummary.isAvailable, false);

  assert.equal(viewModel.changeId, validRequest.changeId);
  assert.equal(viewModel.elementId, validRequest.elementId);
  assert.equal(viewModel.operation, validRequest.operation);
  assert.equal(viewModel.source, validRequest.source);
  assert.equal(viewModel.createdAt, validRequest.createdAt);

  assert.deepEqual(payloadFieldNames(viewModel), ["nested", "width"]);
  assert.deepEqual(viewModel.payloadRows.find((row) => row.field === "nested").value, { unit: "px" });

  const requestWithForbiddenPayload = changeRequest({
    payload: {
      width: 320,
      recordId: "not-shown",
      nested: {
        database: "not-shown",
        unit: "px",
      },
    },
  });
  const forbiddenPayloadViewModel = createEditorChangeDraftViewModel(core, requestWithForbiddenPayload);
  assert.equal(payloadFieldNames(forbiddenPayloadViewModel).includes("recordId"), false);
  assert.deepEqual(forbiddenPayloadViewModel.payloadRows.find((row) => row.field === "nested").value, { unit: "px" });
  assertRejectedWith(forbiddenPayloadViewModel.validation, "forbidden_field");

  const elementDetails = core.getElementDetails("workspace.panel.main");
  assert.deepEqual(viewModel.elementSummary, {
    id: elementDetails.id,
    label: elementDetails.name,
    type: elementDetails.type,
    role: elementDetails.role,
    visible: elementDetails.visible,
    editable: elementDetails.editable,
  });

  const operationDetails = core.getElementOperations("workspace.panel.main");
  assert.equal(viewModel.operationSummary.operation, "resize");
  assert.equal(viewModel.operationSummary.isAllowed, true);
  assert.equal(viewModel.operationSummary.isLocked, false);
  assert.equal(viewModel.operationSummary.isAvailable, true);
  assert.deepEqual(viewModel.operationSummary.allowedOps, operationDetails.allowedOps);
  assert.deepEqual(viewModel.operationSummary.lockedOps, operationDetails.lockedOps);
  assert.deepEqual(viewModel.operationSummary.availableOps, operationDetails.availableOps);
  assert.notEqual(viewModel.operationSummary.allowedOps, operationDetails.allowedOps);

  assert.equal(Object.prototype.hasOwnProperty.call(viewModel.validation, "ok"), true);
  assert.equal(Object.prototype.hasOwnProperty.call(viewModel.validation, "errors"), true);
  assert.deepEqual(viewModel.validation.errors, []);
  assert.equal(Object.prototype.hasOwnProperty.call(viewModel, "rawChangeRequest"), false);

  const withRaw = createEditorChangeDraftViewModel(core, validRequest, { includeRawChangeRequest: true });
  assert.deepEqual(withRaw.rawChangeRequest, validRequest);
  assert.notEqual(withRaw.rawChangeRequest, validRequest);
  assert.notEqual(withRaw.rawChangeRequest.payload, validRequest.payload);

  const elementsBeforeMutation = core.listElements();
  viewModel.payloadRows[0].value = 999;
  viewModel.elementSummary.label = "Mutated";
  viewModel.operationSummary.allowedOps.push("mutated");
  viewModel.validation.errors.push({ code: "mutated" });
  assert.deepEqual(core.listElements(), elementsBeforeMutation);

  const originalRequest = changeRequest({ payload: { width: 111, nested: { unit: "px" } } });
  const originalSnapshot = JSON.stringify(originalRequest);
  const mutableViewModel = createEditorChangeDraftViewModel(core, originalRequest, { includeRawChangeRequest: true });
  mutableViewModel.rawChangeRequest.payload.width = 222;
  mutableViewModel.payloadRows.find((row) => row.field === "nested").value.unit = "rem";
  assert.equal(JSON.stringify(originalRequest), originalSnapshot);

  const spyCore = createSpyCore();
  const spyViewModel = createEditorChangeDraftViewModel(spyCore, changeRequest());
  assert.equal(spyViewModel.validation.ok, true);
  assert.equal(spyCore.state.touched, false);
  assert.deepEqual(
    spyCore.calls.map((call) => call[0]).filter((name) => ["executeChange", "contactAdapter", "saveLayoutState"].includes(name)),
    []
  );
  assert.equal(spyCore.calls.some((call) => call[0] === "hasElement"), true);
  assert.equal(spyCore.calls.some((call) => call[0] === "canElementPerformOperation"), true);
  assert.equal(spyCore.calls.some((call) => call[0] === "getElementDetails"), true);
  assert.equal(spyCore.calls.some((call) => call[0] === "getElementOperations"), true);

  const noOperationsViewModel = createEditorChangeDraftViewModel(
    {
      hasElement() {
        return true;
      },
      canElementPerformOperation() {
        return true;
      },
      getElementDetails(elementId) {
        return element({ id: elementId, name: "Plain Element", allowedOps: ["resize"], lockedOps: [] });
      },
    },
    changeRequest()
  );
  assert.equal(noOperationsViewModel.operationSummary, null);

  const moduleSource = fs.readFileSync(MODULE_PATH, "utf8");
  assertNoForbiddenFragments(moduleSource, "editor-ui-change-draft-view-model");
  ["fs", "child_process", "http", "https", "express", "react", "vue", "svelte", "document", "window"].forEach((fragment) => {
    assert.equal(moduleSource.includes(fragment), false, `Unzulaessige Abhaengigkeit: ${fragment}`);
  });
  assert.equal(moduleSource.includes("layout-state"), false);
  assert.equal(moduleSource.includes("test-host-adapter"), false);

  console.log("TESTS OK: editor-ui-change-draft-view-model");
}

run();
