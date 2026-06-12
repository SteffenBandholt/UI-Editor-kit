#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const PACKAGE_JSON_PATH = path.join(REPO_ROOT, "package.json");
const PACKAGE_NAME = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, "utf8")).name;
const SURFACE_RUNTIME_EXPORT = `${PACKAGE_NAME}/runtime/surface`;

async function run() {
  const cjsRuntime = require(SURFACE_RUNTIME_EXPORT);
  const esmRuntime = await import(SURFACE_RUNTIME_EXPORT);

  assert.equal(typeof cjsRuntime.normalizeSurfaceModel, "function");
  assert.equal(typeof esmRuntime.normalizeSurfaceModel, "function");
  assert.equal(cjsRuntime.normalizeSurfaceModel({
    surfaceId: "sample.surface",
    surfaceType: "ui-screen",
    elements: [],
  }).coordinateSystem, "css-pixels");
  assert.equal(esmRuntime.normalizeSurfaceModel({
    surfaceId: "sample.page",
    surfaceType: "pdf-page",
    elements: [],
  }).coordinateSystem, "pdf-points");

  console.log("TESTS OK: surface-runtime-package-export");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
