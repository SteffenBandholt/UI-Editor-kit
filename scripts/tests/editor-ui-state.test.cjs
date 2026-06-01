#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const MODULE_PATH = path.join(REPO_ROOT, "src/core/editor-ui-state.cjs");
const { createEditorUiState, EDITOR_UI_MODES } = require(MODULE_PATH);

function assertNoForbiddenFragments(text, label) {
  const forbiddenFragments = [
    "node:fs",
    "node:path",
    "writeFile",
    "readFile",
    "mkdir",
    "sqlite",
    "postgres",
    "mysql",
    "fetch(",
    "http",
    ["target", "-app"].join(""),
    "document.",
    "window.",
    "querySelector",
    "createElement",
    "innerHTML",
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
  assert.equal(typeof createEditorUiState, "function");
  assert.deepEqual(EDITOR_UI_MODES, ["tree", "details", "changeDraft"]);

  const uiState = createEditorUiState();
  assert.deepEqual(uiState.getState(), {
    selectedElementId: null,
    expandedElementIds: [],
    lastError: null,
    mode: "tree",
  });

  uiState.selectElement("workspace.area.main");
  assert.equal(uiState.getState().selectedElementId, "workspace.area.main");

  uiState.clearSelection();
  assert.equal(uiState.getState().selectedElementId, null);

  uiState.expandElement("workspace.area.main");
  assert.deepEqual(uiState.getState().expandedElementIds, ["workspace.area.main"]);
  uiState.expandElement("workspace.area.main");
  assert.deepEqual(uiState.getState().expandedElementIds, ["workspace.area.main"]);
  assert.equal(uiState.isExpanded("workspace.area.main"), true);
  assert.equal(uiState.isExpanded("workspace.unknown"), false);

  uiState.collapseElement("workspace.area.main");
  assert.deepEqual(uiState.getState().expandedElementIds, []);
  assert.equal(uiState.isExpanded("workspace.area.main"), false);

  uiState.setMode("tree");
  assert.equal(uiState.getState().mode, "tree");
  uiState.setMode("details");
  assert.equal(uiState.getState().mode, "details");
  uiState.setMode("changeDraft");
  assert.equal(uiState.getState().mode, "changeDraft");
  assert.throws(() => uiState.setMode("unknown"), /Unbekannter Editor-UI-Modus/);

  const errorInput = { code: "neutral_error", meta: { elementId: "workspace.area.main" } };
  uiState.setError(errorInput);
  errorInput.meta.elementId = "mutated";
  assert.deepEqual(uiState.getState().lastError, {
    code: "neutral_error",
    meta: { elementId: "workspace.area.main" },
  });

  uiState.clearError();
  assert.equal(uiState.getState().lastError, null);

  const mutableInitialValues = {
    selectedElementId: "workspace.initial",
    expandedElementIds: ["workspace.initial", "workspace.initial", 12],
    lastError: { code: "initial", nested: { value: 1 } },
    mode: "details",
  };
  const initializedState = createEditorUiState(mutableInitialValues);
  mutableInitialValues.expandedElementIds.push("workspace.mutated");
  mutableInitialValues.lastError.nested.value = 99;
  assert.deepEqual(initializedState.getState(), {
    selectedElementId: "workspace.initial",
    expandedElementIds: ["workspace.initial"],
    lastError: { code: "initial", nested: { value: 1 } },
    mode: "details",
  });

  const returnedState = initializedState.getState();
  returnedState.selectedElementId = "mutated";
  returnedState.expandedElementIds.push("mutated");
  returnedState.lastError.nested.value = 77;
  assert.deepEqual(initializedState.getState(), {
    selectedElementId: "workspace.initial",
    expandedElementIds: ["workspace.initial"],
    lastError: { code: "initial", nested: { value: 1 } },
    mode: "details",
  });

  assert.throws(() => createEditorUiState({ mode: "invalid" }), /Unbekannter Editor-UI-Modus/);
  assert.throws(() => createEditorUiState("invalid"), /Initialwerte/);
  assert.throws(() => uiState.expandElement(""), /Element-ID/);

  const moduleText = fs.readFileSync(MODULE_PATH, "utf8");
  assertNoForbiddenFragments(moduleText, "editor-ui-state");

  console.log("TESTS OK: editor-ui-state");
}

run();
