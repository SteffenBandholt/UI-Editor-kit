"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const REPO_ROOT = path.resolve(__dirname, "../..");
const ARTIFACT = path.join(REPO_ROOT, "dist/selection-runtime.browser.mjs");
const PACKAGE_JSON = path.join(REPO_ROOT, "package.json");
const BUILD_SCRIPT = path.join(REPO_ROOT, "scripts/build/build-selection-runtime-browser-esm.cjs");

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


function runNode(args, options) {
  return childProcess.spawnSync(process.execPath, args, { cwd: REPO_ROOT, encoding: "utf8", ...(options || {}) });
}

function assertSuccessful(result, label) {
  assert.equal(result.status, 0, `${label} failed:\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
}

function assertArtifactFreshnessAndDeterminism() {
  const original = fs.readFileSync(ARTIFACT, "utf8");

  const checkBeforeBuild = runNode([BUILD_SCRIPT, "--check"]);
  assertSuccessful(checkBeforeBuild, "Browser-ESM freshness check");
  assert.equal(fs.readFileSync(ARTIFACT, "utf8"), original, "--check darf das Repositoryartefakt nicht veraendern.");

  const firstBuild = runNode([BUILD_SCRIPT]);
  assertSuccessful(firstBuild, "Browser-ESM first build");
  const firstGenerated = fs.readFileSync(ARTIFACT, "utf8");
  assert.equal(firstGenerated, original, "Eingechecktes Browser-ESM-Artefakt ist nicht frisch.");

  const secondBuild = runNode([BUILD_SCRIPT]);
  assertSuccessful(secondBuild, "Browser-ESM second build");
  const secondGenerated = fs.readFileSync(ARTIFACT, "utf8");
  assert.equal(secondGenerated, firstGenerated, "Zwei Builds muessen byteidentisch sein.");

  assert.equal(/\r/u.test(secondGenerated), false, "Browser-ESM-Artefakt muss reproduzierbare LF-Zeilenenden verwenden.");
  assert.equal(/\r\n/u.test(secondGenerated), false, "Browser-ESM-Artefakt darf keine CRLF-Zeilenenden enthalten.");
  assert.equal(/\b20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/u.test(secondGenerated), false, "Browser-ESM-Artefakt darf keine Zeitstempel enthalten.");
  assert.equal(secondGenerated.includes(REPO_ROOT), false, "Browser-ESM-Artefakt darf keinen Rechner-/Workspace-Pfad enthalten.");
  assert.equal(/\/workspace\//u.test(secondGenerated), false, "Browser-ESM-Artefakt darf keinen Workspace-Pfad enthalten.");

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ui-editor-kit-m581-"));
  const tempArtifact = path.join(tempDir, "selection-runtime.browser.mjs");
  fs.writeFileSync(tempArtifact, `${secondGenerated}\n// stale temporary mutation\n`, "utf8");
  const staleBefore = fs.readFileSync(tempArtifact, "utf8");
  const staleCheck = runNode([BUILD_SCRIPT, "--check", "--artifact", tempArtifact]);
  assert.notEqual(staleCheck.status, 0, "--check muss bei absichtlich veraendertem temporaerem Artefakt fehlschlagen.");
  assert.equal(fs.readFileSync(tempArtifact, "utf8"), staleBefore, "--check darf ein abweichendes Artefakt nicht ueberschreiben.");
  assert.equal(fs.readFileSync(ARTIFACT, "utf8"), secondGenerated, "Temporaerer Negativtest darf das echte Repositoryartefakt nicht dauerhaft veraendern.");
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
  assertArtifactFreshnessAndDeterminism();

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

  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const pack = childProcess.spawnSync(npmCommand, ["pack", "--dry-run"], { cwd: REPO_ROOT, encoding: "utf8", shell: process.platform === "win32" });
  assert.equal(pack.status, 0, pack.stderr || pack.stdout);
  assert.equal((pack.stdout + pack.stderr).includes("dist/selection-runtime.browser.mjs"), true, "npm pack enthaelt Browserartefakt nicht.");

  console.log("m581 browser esm runtime tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
