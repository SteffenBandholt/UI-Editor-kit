"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const REPO_ROOT = path.resolve(__dirname, "../..");
const ARTIFACT = path.join(REPO_ROOT, "dist/selection-runtime.browser.mjs");
const PACKAGE_JSON = path.join(REPO_ROOT, "package.json");

function read(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

function makeElement(rect) {
  const element = {
    nodeType: 1,
    contains: (target) => target === element,
    getBoundingClientRect: () => rect || { left: 0, top: 0, width: 10, height: 10 },
  };
  return element;
}

function createListenerRoot() {
  const listeners = [];
  return {
    listeners,
    addEventListener(type, fn, options) { listeners.push({ type, fn, options }); },
    removeEventListener(type, fn, options) {
      const index = listeners.findIndex((entry) => entry.type === type && entry.fn === fn && entry.options === options);
      if (index !== -1) listeners.splice(index, 1);
    },
  };
}

(async () => {
  assert.equal(fs.existsSync(ARTIFACT), true, "Browser-ESM-Artefakt fehlt.");

  const runtime = await import(pathToFileURL(ARTIFACT).href);
  [
    "createSelectionController",
    "createHoverOverlay",
    "createSelectedOverlay",
    "resolveSelectionTarget",
    "SelectionRuntimeErrorCodes",
    "SELECTION_CONTRACT_VERSION",
  ].forEach((name) => assert.equal(Object.prototype.hasOwnProperty.call(runtime, name), true, `Export fehlt: ${name}`));
  assert.equal(runtime.SELECTION_CONTRACT_VERSION, "selection-target-contract-v1.0");

  const root = createListenerRoot();
  const targetElement = makeElement();
  let selectedElementId = null;
  const overlayCalls = [];
  const overlay = () => ({
    show: (payload) => overlayCalls.push(payload),
    clear: () => overlayCalls.push("clear"),
    destroy: () => overlayCalls.push("destroy"),
  });
  const controller = runtime.createSelectionController({
    host: {
      listSelectableTargets: () => [{ elementId: "target.one", label: "Target One" }],
      getElementRef: (elementId) => (elementId === "target.one" ? targetElement : null),
      getSelectedElementId: () => selectedElementId,
      selectElement: (elementId) => { selectedElementId = elementId; },
      getInteractionRoot: () => root,
    },
    hoverOverlay: overlay(),
    selectedOverlay: overlay(),
  });

  assert.equal(typeof controller.start, "function");
  assert.equal(controller.isActive(), false);
  controller.start();
  assert.equal(controller.isActive(), true);
  assert.equal(root.listeners.length, 4);
  controller.stop();
  assert.equal(controller.isActive(), false);
  assert.equal(root.listeners.length, 0);
  controller.destroy();
  assert.equal(controller.getState().active, false);
  assert.equal(overlayCalls.includes("destroy"), true);

  const source = fs.readFileSync(ARTIFACT, "utf8");
  assert.equal(source.includes("require("), false, "Browser-ESM darf kein require() enthalten.");
  assert.equal(source.includes("module.exports"), false, "Browser-ESM darf kein module.exports enthalten.");
  assert.equal(/from\s+["']node:/u.test(source), false, "Browser-ESM darf keine Node-Core-Imports enthalten.");
  assert.equal(/^\s*import\s/mu.test(source), false, "Browser-ESM darf keine statischen Paketimporte enthalten.");
  assert.equal(/[Bb][Bb][Mm]/u.test(source), false, "Browser-ESM darf keine BBM-Namen enthalten.");
  [/querySelector/u, /getElementById/u, /getElementsBy/u, /closest/u, /matches/u, /elementFromPoint/u, /elementsFromPoint/u].forEach((pattern) => {
    assert.equal(pattern.test(source), false, `Browser-ESM enthaelt verbotene DOM-Suchmethode: ${pattern}`);
  });

  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON, "utf8"));
  assert.equal(packageJson.version, "0.2.0");
  assert.equal(packageJson.exports["."].require, "./src/index.cjs");
  assert.equal(packageJson.exports["./selection-runtime.browser.mjs"].import, "./dist/selection-runtime.browser.mjs");

  const commonJsApi = require(path.join(REPO_ROOT, "src/index.cjs"));
  assert.equal(commonJsApi.createSelectionController, require(path.join(REPO_ROOT, "src/selection/selectionController.js")).createSelectionController);
  assert.equal(commonJsApi.createHoverOverlay, require(path.join(REPO_ROOT, "src/selection/hoverOverlay.js")).createHoverOverlay);
  assert.equal(commonJsApi.createSelectedOverlay, require(path.join(REPO_ROOT, "src/selection/selectedOverlay.js")).createSelectedOverlay);
  assert.equal(commonJsApi.resolveSelectionTarget, require(path.join(REPO_ROOT, "src/selection/targetResolver.js")).resolveSelectionTarget);
  assert.equal(commonJsApi.SELECTION_CONTRACT_VERSION, "selection-target-contract-v1.0");

  const pack = childProcess.spawnSync("npm", ["pack", "--dry-run"], { cwd: REPO_ROOT, encoding: "utf8" });
  assert.equal(pack.status, 0, pack.stderr || pack.stdout);
  assert.equal((pack.stdout + pack.stderr).includes("dist/selection-runtime.browser.mjs"), true, "npm pack enthaelt Browserartefakt nicht.");

  console.log("m581 browser esm runtime tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
