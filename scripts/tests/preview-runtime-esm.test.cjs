#!/usr/bin/env node

const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const REPO_ROOT = path.resolve(__dirname, "../..");
const PREVIEW_RUNTIME_ESM_PATH = path.join(REPO_ROOT, "src/runtime/preview/index.mjs");

const EXPECTED_FUNCTION_EXPORTS = Object.freeze([
  "getElementAllowedOps",
  "getElementLockedOps",
  "getChangeRequestOperation",
  "isPreviewOperationAllowed",
  "getNodeUiEditorId",
  "findAncestorUiEditorElementById",
  "normalizePreviewTargetMode",
  "getPreviewTargetMode",
  "resolvePreviewTargetElement",
  "getPreviewTargetElement",
  "getPreviewTargetElementId",
  "upsertPreviewChangeRequest",
  "removePendingChangeRequestsForTarget",
  "getPendingChangeRequestSummary",
]);

async function run() {
  const runtime = await import(pathToFileURL(PREVIEW_RUNTIME_ESM_PATH).href);

  EXPECTED_FUNCTION_EXPORTS.forEach((exportName) => {
    assert.equal(typeof runtime[exportName], "function", `missing ESM preview API export: ${exportName}`);
  });

  assert.equal(runtime.UNKNOWN_PREVIEW_TARGET_APP_ID, "unknown-host");
  assert.equal(runtime.UI_EDITOR_ID_ATTRIBUTE, "data-ui-editor-id");
  assert.equal(runtime.getChangeRequestOperation("resizeWidth"), "width");
  assert.equal(runtime.default.getChangeRequestOperation("resizeWidth"), "width");

  console.log("TESTS OK: preview-runtime-esm");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
