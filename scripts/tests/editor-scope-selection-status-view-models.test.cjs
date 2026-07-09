#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { createEditorCore } = require("../../src/core/editor-core.cjs");
const { createEditorRuntimeStatusViewModel } = require("../../src/core/editor-runtime-status-view-model.cjs");
const { createEditorScopeViewModel, createEditorScopeChangeViewModel } = require("../../src/core/editor-scope-view-model.cjs");
const { createEditorSelectionViewModel, clearEditorSelectionForScopeChange } = require("../../src/core/editor-selection-view-model.cjs");
const { createEditorLayoutControlViewModel, createEditorLayoutControlResultViewModel } = require("../../src/core/editor-layout-control-view-model.cjs");
const { createUiElementRegistry } = require("../../src/core/ui-element-registry.cjs");

function createRegistry() {
  const registry = createUiElementRegistry();
  registry.registerElement({ id: "workspace.root", name: "Workspace Root", type: "root", role: "layout", parentId: null, order: 0, visible: true, editable: false, allowedOps: ["inspect"], lockedOps: ["move"] });
  registry.registerElement({ id: "workspace.panel", name: "Workspace Panel", type: "area", role: "layout", parentId: "workspace.root", order: 1, visible: true, editable: true, allowedOps: ["inspect", "move", "resize"], lockedOps: ["hide"] });
  return registry;
}

function createManifest(values) {
  return { targetAppId: "neutral-target", adapterName: "neutral-adapter", uiScope: "workspace", layoutScope: "workspace.layout", saveLayoutState: true, loadLayoutState: true, resetLayoutState: true, ...(values || {}) };
}

function run() {
  const editorCore = createEditorCore(createRegistry());
  const runtimeVm = createEditorRuntimeStatusViewModel({ ok: true, targetAppId: "neutral-target", adapterName: "neutral-adapter", uiScope: "workspace", layoutScope: "workspace.layout", registryElementCount: 2, selectedElementId: "workspace.panel", availableOperations: ["inspect"], lockedOperations: ["resize"], blocked: false, errors: [] }, { selectedElement: { id: "workspace.panel", name: "Workspace Panel" } });
  assert.equal(runtimeVm.ok, true);
  assert.equal(runtimeVm.selectedElementName, "Workspace Panel");
  assert.equal(runtimeVm.registryElementCount, 2);

  const missingScope = createEditorScopeViewModel({ manifest: createManifest(), uiScope: null, layoutScope: "workspace.layout" });
  assert.equal(missingScope.blockCode, "unknown_scope");

  const noSelection = createEditorSelectionViewModel(editorCore, null);
  assert.equal(noSelection.status, "no_selection");

  const unknownSelection = createEditorSelectionViewModel(editorCore, "workspace.missing");
  assert.equal(unknownSelection.status, "unknown_element");

  const changedScope = createEditorScopeChangeViewModel({ uiScope: "workspace", layoutScope: "workspace.layout" }, { uiScope: "workspace.next", layoutScope: "workspace.next.layout", knownScopes: [{ uiScope: "workspace.next", layoutScope: "workspace.next.layout" }] });
  assert.equal(changedScope.selectionCleared, true);
  assert.equal(changedScope.selectedElementId, null);
  assert.equal(clearEditorSelectionForScopeChange("workspace.panel", changedScope).selectedElementId, null);

  const selected = createEditorSelectionViewModel(editorCore, "workspace.panel", { operation: "inspect" });
  assert.deepEqual(selected.allowedOperations, ["inspect", "move", "resize"]);
  assert.deepEqual(selected.availableOperations, ["inspect", "move", "resize"]);
  assert.deepEqual(selected.lockedOperations, ["hide"]);

  const locked = createEditorSelectionViewModel(editorCore, "workspace.panel", { operation: "hide" });
  assert.equal(locked.ok, false);
  assert.equal(locked.status, "operation_locked");

  const notAllowed = createEditorSelectionViewModel(editorCore, "workspace.panel", { operation: "reset" });
  assert.equal(notAllowed.status, "operation_not_allowed");

  const unavailableControls = createEditorLayoutControlViewModel({ hostAdapter: { getCurrentLayoutState() { return {}; } }, manifest: createManifest({ saveLayoutState: false }) });
  assert.equal(unavailableControls.controls.save.status, "save_blocked");

  const hostAdapter = { getCurrentLayoutState() { return {}; }, saveLayoutState() {}, loadLayoutState() {}, resetLayoutState() {} };
  const controls = createEditorLayoutControlViewModel({ hostAdapter, manifest: createManifest() });
  assert.equal(controls.controls.save.status, "save_available");
  assert.equal(controls.controls.load.status, "load_available");
  assert.equal(controls.controls.reset.status, "reset_available");

  const noLayoutState = createEditorLayoutControlViewModel({ hostAdapter: {}, manifest: createManifest(), layoutStateAvailable: false });
  assert.equal(noLayoutState.status, "layout_state_unavailable");
  assert.equal(createEditorLayoutControlResultViewModel({ ok: false }).status, "target_rejected_change");

  const files = [
    "src/core/editor-runtime-status-view-model.cjs",
    "src/core/editor-selection-view-model.cjs",
    "src/core/editor-scope-view-model.cjs",
    "src/core/editor-layout-control-view-model.cjs",
    "src/core/editor-status-messages.cjs",
    "scripts/tests/editor-scope-selection-status-view-models.test.cjs",
  ];
  const forbidden = ["query" + "Selector", "doc" + "ument.", "win" + "dow.", "auto" + "Detect", "auto" + "Register", "data" + "base", "s" + "ql", "p" + "df", "m" + "ail", "au" + "dio", "pr" + "int"];
  files.forEach((file) => {
    const source = fs.readFileSync(path.join(__dirname, "../..", file), "utf8").toLowerCase();
    assert.equal(source.includes("b" + "bm"), false, `${file} must stay neutral.`);
    forbidden.forEach((term) => assert.equal(source.includes(term.toLowerCase()), false, `${file} must not contain ${term}.`));
  });

  console.log("TESTS OK: editor-scope-selection-status-view-models");
}

run();
