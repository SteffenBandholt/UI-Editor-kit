#!/usr/bin/env node

const assert = require("node:assert/strict");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const SURFACE_RUNTIME_PATH = path.join(REPO_ROOT, "src/runtime/surface/index.cjs");

function assertSurfaceRuntime(runtime) {
  assert.equal(typeof runtime.normalizeSurfaceElement, "function");
  assert.equal(typeof runtime.normalizeSurfaceModel, "function");
  assert.equal(typeof runtime.validateSurfaceElement, "function");
  assert.equal(typeof runtime.validateSurfaceModel, "function");
  assert.equal(typeof runtime.isSupportedSurfaceType, "function");
  assert.deepEqual(runtime.SUPPORTED_SURFACE_TYPES, ["ui-screen", "panel", "pdf-page", "canvas", "plan"]);

  assert.equal(runtime.isSupportedSurfaceType("ui-screen"), true);
  assert.equal(runtime.isSupportedSurfaceType("unknown"), false);

  const uiScreenSurface = runtime.normalizeSurfaceModel({
    surfaceId: " protokoll.topsScreen ",
    surfaceType: "ui-screen",
    elements: [
      {
        elementId: " example.element ",
        label: " Beispiel ",
        visible: true,
        bounds: {
          x: 0,
          y: 1,
          width: 100,
          height: 30,
        },
        capabilities: {
          canHide: true,
          canMove: false,
        },
      },
    ],
  });

  assert.equal(uiScreenSurface.surfaceId, "protokoll.topsScreen");
  assert.equal(uiScreenSurface.coordinateSystem, "css-pixels");
  assert.deepEqual(uiScreenSurface.elements[0], {
    elementId: "example.element",
    label: "Beispiel",
    visible: true,
    bounds: {
      x: 0,
      y: 1,
      width: 100,
      height: 30,
    },
    capabilities: {
      canHide: true,
      canMove: false,
      canResize: false,
    },
  });
  assert.deepEqual(runtime.validateSurfaceModel(uiScreenSurface), { ok: true, errors: [] });

  const pageSurface = runtime.normalizeSurfaceModel({
    surfaceId: "pdf.plan.page.1",
    surfaceType: "pdf-page",
    pageNumber: 1,
    elements: [],
  });

  assert.equal(pageSurface.coordinateSystem, "pdf-points");
  assert.equal(pageSurface.pageNumber, 1);
  assert.deepEqual(pageSurface.elements, []);
  assert.deepEqual(runtime.validateSurfaceModel(pageSurface), { ok: true, errors: [] });

  assert.equal(runtime.validateSurfaceModel({
    surfaceId: "unknown.surface",
    surfaceType: "unknown",
    elements: [],
  }).ok, false);

  const invalidBoundsResult = runtime.validateSurfaceElement({
    elementId: "bad.bounds",
    bounds: {
      x: 0,
      y: 0,
      width: -1,
      height: 10,
    },
  });
  assert.equal(invalidBoundsResult.ok, false);
  assert.equal(invalidBoundsResult.errors.some((error) => error.code === "NEGATIVE_SURFACE_ELEMENT_BOUNDS_SIZE"), true);

  const invalidElementIdResult = runtime.validateSurfaceElement({
    elementId: 123,
  });
  assert.equal(invalidElementIdResult.ok, false);
  assert.equal(invalidElementIdResult.errors.some((error) => error.code === "INVALID_SURFACE_ELEMENT_ID"), true);

  assert.equal(runtime.validateSurfaceElement({
    elementId: "bad.capabilities",
    capabilities: {
      canHide: "yes",
    },
  }).ok, false);

  assert.equal(runtime.validateSurfaceModel({
    surfaceId: "empty.surface",
    surfaceType: "panel",
    elements: [],
  }).ok, true);
}

function run() {
  assertSurfaceRuntime(require(SURFACE_RUNTIME_PATH));
  console.log("TESTS OK: surface-runtime");
}

if (require.main === module) {
  run();
}

module.exports = { assertSurfaceRuntime };
