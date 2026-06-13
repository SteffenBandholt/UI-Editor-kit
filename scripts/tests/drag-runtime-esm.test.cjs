#!/usr/bin/env node

const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { assertDragRuntime } = require("./drag-runtime.test.cjs");

const REPO_ROOT = path.resolve(__dirname, "../..");
const DRAG_RUNTIME_ESM_PATH = path.join(REPO_ROOT, "src/runtime/drag/index.mjs");

async function run() {
  const runtime = await import(pathToFileURL(DRAG_RUNTIME_ESM_PATH).href);
  assertDragRuntime(runtime);
  assertDragRuntime(runtime.default);
  console.log("TESTS OK: drag-runtime-esm");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
