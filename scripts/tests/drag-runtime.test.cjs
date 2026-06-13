#!/usr/bin/env node

const assert = require("node:assert/strict");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const DRAG_RUNTIME_PATH = path.join(REPO_ROOT, "src/runtime/drag/index.cjs");

function assertDragRuntime(runtime) {
  assert.equal(typeof runtime.normalizeDragBounds, "function");
  assert.equal(typeof runtime.validateDragBounds, "function");
  assert.equal(typeof runtime.normalizeDragDelta, "function");
  assert.equal(typeof runtime.validateDragDelta, "function");
  assert.equal(typeof runtime.applyDragDelta, "function");
  assert.equal(typeof runtime.clampBoundsToConstraints, "function");
  assert.equal(typeof runtime.buildDragResult, "function");
  assert.equal(typeof runtime.isSupportedDragCoordinateSystem, "function");
  assert.deepEqual(runtime.SUPPORTED_DRAG_COORDINATE_SYSTEMS, ["css-pixels", "pdf-points", "canvas-pixels"]);

  assert.equal(runtime.isSupportedDragCoordinateSystem("css-pixels"), true);
  assert.equal(runtime.isSupportedDragCoordinateSystem("pdf-points"), true);
  assert.equal(runtime.isSupportedDragCoordinateSystem("canvas-pixels"), true);
  assert.equal(runtime.isSupportedDragCoordinateSystem("unknown"), false);

  const bounds = runtime.normalizeDragBounds({
    x: 10,
    y: 20,
    width: 100,
    height: 30,
    custom: "kept",
  });
  assert.deepEqual(bounds, {
    x: 10,
    y: 20,
    width: 100,
    height: 30,
    custom: "kept",
  });
  assert.deepEqual(runtime.validateDragBounds(bounds), { ok: true, errors: [] });

  const delta = runtime.normalizeDragDelta({
    x: 15,
    y: -5,
  });
  assert.deepEqual(delta, {
    x: 15,
    y: -5,
  });
  assert.deepEqual(runtime.validateDragDelta(delta), { ok: true, errors: [] });

  assert.deepEqual(runtime.applyDragDelta(bounds, delta), {
    x: 25,
    y: 15,
    width: 100,
    height: 30,
    custom: "kept",
  });

  assert.deepEqual(runtime.clampBoundsToConstraints({
    x: -10,
    y: 900,
    width: 100,
    height: 30,
  }, {
    minX: 0,
    minY: 0,
    maxX: 1000,
    maxY: 800,
  }), {
    x: 0,
    y: 800,
    width: 100,
    height: 30,
  });

  const result = runtime.buildDragResult({
    elementId: " example.element ",
    startBounds: bounds,
    delta,
    constraints: {
      minX: 0,
      minY: 0,
      maxX: 1000,
      maxY: 800,
    },
    coordinateSystem: "css-pixels",
  });
  assert.deepEqual(result, {
    ok: true,
    errors: [],
    elementId: "example.element",
    coordinateSystem: "css-pixels",
    bounds: {
      x: 25,
      y: 15,
      width: 100,
      height: 30,
      custom: "kept",
    },
    changed: true,
  });

  const negativeSizeResult = runtime.validateDragBounds({
    x: 0,
    y: 0,
    width: -1,
    height: 10,
  });
  assert.equal(negativeSizeResult.ok, false);
  assert.equal(negativeSizeResult.errors.some((error) => error.code === "NEGATIVE_DRAG_BOUNDS_SIZE"), true);

  const unknownCoordinateResult = runtime.buildDragResult({
    elementId: "bad.coordinate",
    startBounds: bounds,
    delta,
    coordinateSystem: "unknown",
  });
  assert.equal(unknownCoordinateResult.ok, false);
  assert.equal(unknownCoordinateResult.errors.some((error) => error.code === "UNSUPPORTED_DRAG_COORDINATE_SYSTEM"), true);
}

function run() {
  assertDragRuntime(require(DRAG_RUNTIME_PATH));
  console.log("TESTS OK: drag-runtime");
}

if (require.main === module) {
  run();
}

module.exports = { assertDragRuntime };
