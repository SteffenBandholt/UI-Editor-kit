#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const PACKAGE_JSON_PATH = path.join(REPO_ROOT, "package.json");
const PACKAGE_NAME = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, "utf8")).name;
const DRAG_RUNTIME_EXPORT = `${PACKAGE_NAME}/runtime/drag`;

async function run() {
  const cjsRuntime = require(DRAG_RUNTIME_EXPORT);
  const esmRuntime = await import(DRAG_RUNTIME_EXPORT);

  assert.equal(typeof cjsRuntime.applyDragDelta, "function");
  assert.equal(typeof esmRuntime.applyDragDelta, "function");
  assert.deepEqual(cjsRuntime.applyDragDelta({
    x: 10,
    y: 20,
    width: 100,
    height: 30,
  }, {
    x: 15,
    y: -5,
  }), {
    x: 25,
    y: 15,
    width: 100,
    height: 30,
  });
  assert.equal(esmRuntime.isSupportedDragCoordinateSystem("pdf-points"), true);

  console.log("TESTS OK: drag-runtime-package-export");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
