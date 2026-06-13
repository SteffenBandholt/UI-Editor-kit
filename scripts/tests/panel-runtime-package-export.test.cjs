#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const PACKAGE_JSON_PATH = path.join(REPO_ROOT, "package.json");
const PACKAGE_NAME = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, "utf8")).name;
const PANEL_RUNTIME_EXPORT = `${PACKAGE_NAME}/runtime/panel`;

async function run() {
  const cjsRuntime = require(PANEL_RUNTIME_EXPORT);
  const esmRuntime = await import(PANEL_RUNTIME_EXPORT);

  assert.equal(typeof cjsRuntime.createDefaultPanelState, "function");
  assert.equal(typeof esmRuntime.createDefaultPanelState, "function");
  assert.equal(typeof cjsRuntime.buildPanelDragResult, "function");
  assert.equal(typeof esmRuntime.buildPanelDragResult, "function");
  assert.equal(cjsRuntime.createDefaultPanelState().isOpen, true);
  assert.equal(esmRuntime.buildPanelViewModel({ targetId: "sample" }).targetId, "sample");
  assert.deepEqual(cjsRuntime.buildPanelDragResult({
    startBounds: { x: 1, y: 2, width: 10, height: 10 },
    delta: { x: 3, y: 4 },
    viewportBounds: { x: 0, y: 0, width: 100, height: 100 },
    coordinateSystem: "css-pixels",
  }).bounds, { x: 4, y: 6, width: 10, height: 10 });
  assert.equal(esmRuntime.buildPanelDragResult({
    startBounds: { x: 1, y: 2, width: 10, height: 10 },
    delta: { x: 0, y: 0 },
    viewportBounds: { x: 0, y: 0, width: 100, height: 100 },
    coordinateSystem: "css-pixels",
  }).changed, false);

  console.log("TESTS OK: panel-runtime-package-export");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
