#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const DRAG_RUNTIME_DIR = path.join(REPO_ROOT, "src/runtime/drag");
const DRAG_RUNTIME_INDEX = path.join(DRAG_RUNTIME_DIR, "index.cjs");
const DRAG_RUNTIME_ESM_INDEX = path.join(DRAG_RUNTIME_DIR, "index.mjs");

const FORBIDDEN_FRAGMENTS = Object.freeze([
  ["b", "bm"].join(""),
  ["B", "BM"].join(""),
  ["rest", "arbeiten"].join(""),
  ["local", "Storage"].join(""),
  ["write", "File"].join(""),
  ["i", "pc"].join(""),
  ["d", "b"].join(""),
  "document",
  "window",
  "addEventListener",
  "PointerEvent",
  "MouseEvent",
  "createElement",
  "appendChild",
  "querySelector",
  "innerHTML",
  "outerHTML",
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
  assert.equal(fs.existsSync(DRAG_RUNTIME_DIR), true, "Drag-Runtime-Zielpfad fehlt.");
  assert.equal(fs.existsSync(DRAG_RUNTIME_INDEX), true, "Drag-Runtime-Index fehlt.");
  assert.equal(fs.existsSync(DRAG_RUNTIME_ESM_INDEX), true, "Drag-Runtime-ESM-Index fehlt.");

  listFiles(DRAG_RUNTIME_DIR).forEach((filePath) => {
    const relativePath = path.relative(REPO_ROOT, filePath);
    const content = fs.readFileSync(filePath, "utf8");
    assertNoForbiddenFragments(content, relativePath);
  });

  const esmIndexContent = fs.readFileSync(DRAG_RUNTIME_ESM_INDEX, "utf8");
  assert.equal(esmIndexContent.includes(".cjs"), false, "ESM-Index darf keine CommonJS-Datei importieren.");
  assert.equal(esmIndexContent.includes("require"), false, "ESM-Index darf kein require enthalten.");
  assert.equal(esmIndexContent.includes("createRequire"), false, "ESM-Index darf kein createRequire enthalten.");

  console.log("TESTS OK: drag-runtime-guardrail");
}

run();
