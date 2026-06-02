#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const { createTargetAppInstallerPlan } = require(path.join(REPO_ROOT, "src/core/target-app-installer-plan.cjs"));
const { executeTargetAppInstallerPlan } = require(path.join(REPO_ROOT, "src/core/target-app-installer-execution.cjs"));

const PUBLIC_ENTRY = "uiEditor/targetAppRegistry.js";
const REQUIRED_EXPORTS = Object.freeze([
  "getTargetAppRegistryContractInfo",
  "getTargetAppInfo",
  "getAvailableUiScopes",
  "getActiveUiScope",
  "getUiRegistry",
  "getOriginalValues",
  "getChangedValues",
  "saveChangedValues",
]);
const FORBIDDEN_FRAGMENTS = Object.freeze([
  ["B", "BM"].join(""),
  "bbm",
  "src/renderer",
  "protokoll",
  "restarbeit",
  "querySelector",
  "querySelectorAll",
  "MutationObserver",
  "detectElements",
  "autoRegister",
  "writeFile",
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "better-sqlite3",
  "ipcRenderer",
  "ipcMain",
  "editor-panel",
  "EditorPanel",
]);

function createConfirmedInputs(installerPlan) {
  return {
    installerPlan,
    confirmation: {
      installationConfirmed: true,
      targetAppSelected: true,
      installPathConfirmed: true,
      noAutoScan: true,
      noAutoRegister: true,
      registryStructureOnly: true,
    },
  };
}

function assertNoForbiddenFragments(content) {
  FORBIDDEN_FRAGMENTS.forEach((fragment) => {
    assert.equal(content.includes(fragment), false, `Vertragsdatei enthaelt verbotenen Fragmenttext: ${fragment}`);
  });
}

function run() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ui-editor-target-app-registry-contract-"));
  const targetAppPath = path.join(tempRoot, "target-app");
  const installerPlan = createTargetAppInstallerPlan({
    targetAppPath,
    targetAppId: "neutral-target-app",
    targetAppName: "Neutral Target App",
    selectedMode: "prepare-registry-structure",
  });

  assert.equal(installerPlan.installableFiles.includes(PUBLIC_ENTRY), true);

  const installResult = executeTargetAppInstallerPlan(createConfirmedInputs(installerPlan));
  assert.equal(installResult.ok, true);
  assert.equal(installResult.writtenFiles.includes(PUBLIC_ENTRY), true);

  const contractPath = path.join(targetAppPath, PUBLIC_ENTRY);
  const contractSource = fs.readFileSync(contractPath, "utf8");
  const contract = require(contractPath);

  REQUIRED_EXPORTS.forEach((exportName) => {
    assert.equal(typeof contract[exportName], "function", `Pflichtexport fehlt: ${exportName}`);
  });

  assert.deepEqual(contract.getTargetAppRegistryContractInfo(), {
    contractName: "ui-editor-target-app-registry",
    contractVersion: "1.0.0",
    publicEntry: PUBLIC_ENTRY,
  });
  assert.equal(typeof contract.getTargetAppRegistryContractInfo().contractVersion, "string");
  assert.deepEqual(contract.getTargetAppInfo(), {
    targetAppId: "target-app",
    targetAppName: "Target App",
  });
  assert.deepEqual(contract.getAvailableUiScopes(), []);
  assert.equal(contract.getActiveUiScope({ activeUiScope: "test.scope" }), "test.scope");
  assert.equal(contract.getActiveUiScope({}), null);
  assert.equal(contract.getActiveUiScope(), null);
  assert.deepEqual(contract.getUiRegistry("unknown.scope"), {
    ok: false,
    uiScope: "unknown.scope",
    elements: [],
    reason: "unknown-ui-scope",
  });
  assert.deepEqual(contract.getOriginalValues("unknown.scope"), {
    ok: true,
    uiScope: "unknown.scope",
    values: {},
  });
  assert.deepEqual(contract.getChangedValues("unknown.scope"), {
    ok: true,
    uiScope: "unknown.scope",
    values: {},
  });
  assert.deepEqual(contract.saveChangedValues("unknown.scope", { demo: "ignored" }), {
    ok: false,
    uiScope: "unknown.scope",
    saved: false,
    reason: "storage-not-configured",
  });

  assertNoForbiddenFragments(contractSource);
  assert.equal(contractSource.includes("uiEditor/uiEditorRegistry.js"), false);
  assert.equal(contractSource.includes("elements: []"), true);
  assert.equal(contractSource.includes("storage-not-configured"), true);

  console.log("TESTS OK: target-app-registry-contract");
}

run();
