#!/usr/bin/env node

const assert = require("node:assert/strict");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const PANEL_RUNTIME_PATH = path.join(REPO_ROOT, "src/runtime/panel/index.cjs");

function assertPanelRuntime(runtime) {
  assert.equal(typeof runtime.createDefaultPanelState, "function");
  assert.equal(typeof runtime.normalizePanelPosition, "function");
  assert.equal(typeof runtime.updatePanelPosition, "function");
  assert.equal(typeof runtime.setPanelOpen, "function");
  assert.equal(typeof runtime.buildPanelViewModel, "function");
  assert.equal(typeof runtime.normalizePanelDragInput, "function");
  assert.equal(typeof runtime.buildPanelDragResult, "function");
  assert.equal(typeof runtime.calculatePanelDragPosition, "function");
  assert.equal(runtime.PANEL_DRAG_COORDINATE_SYSTEM, "css-pixels");

  assert.deepEqual(runtime.createDefaultPanelState(), {
    isOpen: true,
    position: { left: null, top: 132, right: 24, bottom: null },
  });

  assert.deepEqual(runtime.normalizePanelPosition({ left: "12px", top: "-5", right: "x" }), {
    left: 12,
    top: 0,
    right: null,
    bottom: null,
  });

  const moved = runtime.updatePanelPosition({ isOpen: false }, { left: 32, top: 48 });
  assert.deepEqual(moved, {
    isOpen: false,
    position: { left: 32, top: 48, right: null, bottom: null },
  });

  assert.equal(runtime.setPanelOpen(moved, true).isOpen, true);
  assert.equal(runtime.setPanelOpen(moved, false).isOpen, false);

  const viewModel = runtime.buildPanelViewModel({
    state: runtime.setPanelOpen(moved, true),
    title: "Preview",
    element: {
      id: "sample.field",
      label: "Sample field",
      allowedOps: ["move", "resize", "hide"],
      lockedOps: ["show"],
    },
    previewTarget: { id: "sample.container", label: "Sample container" },
    pendingChangeSummary: { total: 2, operations: ["move", "width"] },
    statusText: "Aenderungen vorbereitet",
  });

  assert.equal(viewModel.isOpen, true);
  assert.equal(viewModel.title, "Preview");
  assert.equal(viewModel.targetId, "sample.field");
  assert.equal(viewModel.targetLabel, "Sample field");
  assert.equal(viewModel.previewTargetId, "sample.container");
  assert.equal(viewModel.previewTargetLabel, "Sample container");
  assert.deepEqual(viewModel.allowedOps, ["move", "resize", "hide"]);
  assert.deepEqual(viewModel.lockedOps, ["show"]);
  assert.deepEqual(viewModel.pendingChangeSummary, { total: 2, operations: ["move", "width"] });
  assert.equal(viewModel.canReset, true);
  assert.equal(viewModel.canDiscard, true);
  assert.equal(viewModel.statusText, "Aenderungen vorbereitet");
  assert.equal(viewModel.buttons.some((button) => button.id === "move-left" && button.isEnabled), true);
  assert.equal(viewModel.buttons.some((button) => button.id === "width-plus" && button.isEnabled), true);
  assert.equal(viewModel.buttons.some((button) => button.id === "show" && button.isEnabled), false);
  assert.equal(viewModel.buttons.some((button) => button.id === "reset" && button.isEnabled), true);
  assert.equal(viewModel.buttons.some((button) => button.id === "discard" && button.isEnabled), true);

  const baseDragInput = {
    panelId: "preview-panel",
    startBounds: {
      x: 100,
      y: 80,
      width: 320,
      height: 240,
    },
    delta: {
      x: 30,
      y: -20,
    },
    viewportBounds: {
      x: 0,
      y: 0,
      width: 1200,
      height: 800,
    },
    coordinateSystem: "css-pixels",
  };

  assert.deepEqual(runtime.normalizePanelDragInput(baseDragInput), {
    panelId: "preview-panel",
    startBounds: {
      x: 100,
      y: 80,
      width: 320,
      height: 240,
    },
    delta: {
      x: 30,
      y: -20,
    },
    viewportBounds: {
      x: 0,
      y: 0,
      width: 1200,
      height: 800,
    },
    coordinateSystem: "css-pixels",
    constraints: {
      minX: 0,
      minY: 0,
      maxX: 880,
      maxY: 560,
    },
  });

  assert.deepEqual(runtime.buildPanelDragResult(baseDragInput), {
    ok: true,
    errors: [],
    panelId: "preview-panel",
    bounds: {
      x: 130,
      y: 60,
      width: 320,
      height: 240,
    },
    changed: true,
    coordinateSystem: "css-pixels",
  });

  assert.deepEqual(runtime.calculatePanelDragPosition({
    ...baseDragInput,
    delta: { x: -40, y: 25 },
  }).bounds, {
    x: 60,
    y: 105,
    width: 320,
    height: 240,
  });

  assert.deepEqual(runtime.buildPanelDragResult({
    ...baseDragInput,
    startBounds: { x: 10, y: 12, width: 320, height: 240 },
    delta: { x: -50, y: -40 },
  }).bounds, {
    x: 0,
    y: 0,
    width: 320,
    height: 240,
  });

  assert.deepEqual(runtime.buildPanelDragResult({
    ...baseDragInput,
    startBounds: { x: 840, y: 540, width: 320, height: 240 },
    delta: { x: 100, y: 100 },
  }).bounds, {
    x: 880,
    y: 560,
    width: 320,
    height: 240,
  });

  assert.equal(runtime.buildPanelDragResult({
    ...baseDragInput,
    delta: { x: 0, y: 0 },
  }).changed, false);

  assert.equal(runtime.buildPanelDragResult({
    ...baseDragInput,
    startBounds: { x: 0, y: 0, width: -1, height: 10 },
  }).ok, false);

  assert.equal(runtime.buildPanelDragResult({
    ...baseDragInput,
    delta: { x: Number.NaN, y: 0 },
  }).ok, false);

  const unsupportedCoordinate = runtime.buildPanelDragResult({
    ...baseDragInput,
    coordinateSystem: "pdf-points",
  });
  assert.equal(unsupportedCoordinate.ok, false);
  assert.equal(unsupportedCoordinate.errors.some((error) => error.code === "UNSUPPORTED_PANEL_DRAG_COORDINATE_SYSTEM"), true);
}

function run() {
  assertPanelRuntime(require(PANEL_RUNTIME_PATH));
  console.log("TESTS OK: panel-runtime");
}

if (require.main === module) {
  run();
}

module.exports = { assertPanelRuntime };
