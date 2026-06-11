#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const PACKAGE_JSON_PATH = path.join(REPO_ROOT, "package.json");
const PACKAGE_NAME = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, "utf8")).name;
const PREVIEW_RUNTIME_EXPORT = `${PACKAGE_NAME}/runtime/preview`;

async function run() {
  const cjsRuntime = require(PREVIEW_RUNTIME_EXPORT);
  const esmRuntime = await import(PREVIEW_RUNTIME_EXPORT);

  assert.equal(typeof cjsRuntime.getChangeRequestOperation, "function");
  assert.equal(typeof esmRuntime.getChangeRequestOperation, "function");
  assert.equal(cjsRuntime.getChangeRequestOperation("resizeWidth"), "width");
  assert.equal(esmRuntime.getChangeRequestOperation("resizeWidth"), "width");
  assert.equal(cjsRuntime.UNKNOWN_PREVIEW_TARGET_APP_ID, "unknown-host");
  assert.equal(esmRuntime.UI_EDITOR_ID_ATTRIBUTE, "data-ui-editor-id");

  console.log("TESTS OK: preview-runtime-package-export");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
