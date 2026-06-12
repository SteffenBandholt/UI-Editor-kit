#!/usr/bin/env node

const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { assertSurfaceRuntime } = require("./surface-runtime.test.cjs");

const REPO_ROOT = path.resolve(__dirname, "../..");
const SURFACE_RUNTIME_ESM_PATH = path.join(REPO_ROOT, "src/runtime/surface/index.mjs");

async function run() {
  const runtime = await import(pathToFileURL(SURFACE_RUNTIME_ESM_PATH).href);
  assertSurfaceRuntime(runtime);
  assertSurfaceRuntime(runtime.default);
  console.log("TESTS OK: surface-runtime-esm");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
