#!/usr/bin/env node

const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { assertHiddenElementsRuntime } = require("./hidden-elements-runtime.test.cjs");

const REPO_ROOT = path.resolve(__dirname, "../..");
const HIDDEN_ELEMENTS_RUNTIME_ESM_PATH = path.join(REPO_ROOT, "src/runtime/hiddenElements/index.mjs");

async function run() {
  const runtime = await import(pathToFileURL(HIDDEN_ELEMENTS_RUNTIME_ESM_PATH).href);
  assertHiddenElementsRuntime(runtime);
  assertHiddenElementsRuntime(runtime.default);
  console.log("TESTS OK: hidden-elements-runtime-esm");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
