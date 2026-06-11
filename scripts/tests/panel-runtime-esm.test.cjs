#!/usr/bin/env node

const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { assertPanelRuntime } = require("./panel-runtime.test.cjs");

const REPO_ROOT = path.resolve(__dirname, "../..");
const PANEL_RUNTIME_ESM_PATH = path.join(REPO_ROOT, "src/runtime/panel/index.mjs");

async function run() {
  const runtime = await import(pathToFileURL(PANEL_RUNTIME_ESM_PATH).href);
  assertPanelRuntime(runtime);
  assertPanelRuntime(runtime.default);
  console.log("TESTS OK: panel-runtime-esm");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
