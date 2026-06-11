#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const PACKAGE_JSON_PATH = path.join(REPO_ROOT, "package.json");
const PACKAGE_NAME = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, "utf8")).name;
const HIDDEN_ELEMENTS_RUNTIME_EXPORT = `${PACKAGE_NAME}/runtime/hidden-elements`;

async function run() {
  const cjsRuntime = require(HIDDEN_ELEMENTS_RUNTIME_EXPORT);
  const esmRuntime = await import(HIDDEN_ELEMENTS_RUNTIME_EXPORT);

  assert.equal(typeof cjsRuntime.buildHiddenElementsViewModel, "function");
  assert.equal(typeof esmRuntime.buildHiddenElementsViewModel, "function");
  assert.equal(cjsRuntime.buildHiddenElementsViewModel({ elements: [{ elementId: "sample", visible: false }] }).hiddenCount, 1);
  assert.equal(esmRuntime.buildHiddenElementsButtonViewModel({ elements: [{ elementId: "sample", visible: false }] }).label, "Ausgeblendete: 1");

  console.log("TESTS OK: hidden-elements-runtime-package-export");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
