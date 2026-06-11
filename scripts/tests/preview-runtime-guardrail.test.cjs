#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const PREVIEW_RUNTIME_DIR = path.join(REPO_ROOT, "src/runtime/preview");
const PREVIEW_RUNTIME_INDEX = path.join(PREVIEW_RUNTIME_DIR, "index.cjs");

const FORBIDDEN_FRAGMENTS = Object.freeze([
  ["b", "bm"].join(""),
  ["B", "BM"].join(""),
  ["rest", "arbeiten"].join(""),
  ["Rest", "arbeiten"].join(""),
  ["Kurz", "text"].join(""),
  ["edit", "box"].join(""),
  ["filter", "bar"].join(""),
  ["local", "Storage"].join(""),
  ["write", "File"].join(""),
  ["i", "pc"].join(""),
  ["d", "b"].join(""),
  "sqlite",
  "postgres",
  "mysql",
  "indexedDB",
  "sessionStorage",
  "fetch(",
  "XMLHttpRequest",
  "WebSocket",
  "querySelector",
  "MutationObserver",
]);

const PLANNED_EXPORTS = Object.freeze([
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

function listFiles(directoryPath) {
  return fs.readdirSync(directoryPath, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      return listFiles(entryPath);
    }

    return [entryPath];
  });
}

function assertNoForbiddenFragments(text, label) {
  FORBIDDEN_FRAGMENTS.forEach((fragment) => {
    assert.equal(text.includes(fragment), false, `${label} enthaelt verbotenen Fragmenttext: ${fragment}`);
  });
}

function run() {
  assert.equal(fs.existsSync(PREVIEW_RUNTIME_DIR), true, "Preview-Runtime-Zielpfad fehlt.");
  assert.equal(fs.existsSync(PREVIEW_RUNTIME_INDEX), true, "Preview-Runtime-Index fehlt.");

  const previewRuntime = require(PREVIEW_RUNTIME_INDEX);
  PLANNED_EXPORTS.forEach((exportName) => {
    assert.equal(typeof previewRuntime[exportName], "function", `Preview-Runtime Export fehlt: ${exportName}`);
  });
  assert.equal(previewRuntime.UNKNOWN_PREVIEW_TARGET_APP_ID, "unknown-host");
  assert.equal(Object.prototype.hasOwnProperty.call(previewRuntime, "getPreviewRuntimeApiStatus"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(previewRuntime, "getPlannedPreviewRuntimeExports"), false);

  listFiles(PREVIEW_RUNTIME_DIR).forEach((filePath) => {
    const relativePath = path.relative(REPO_ROOT, filePath);
    const content = fs.readFileSync(filePath, "utf8");
    assertNoForbiddenFragments(content, relativePath);
  });

  console.log("TESTS OK: preview-runtime-guardrail");
}

run();
