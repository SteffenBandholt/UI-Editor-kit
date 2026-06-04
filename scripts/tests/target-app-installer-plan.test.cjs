#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const MODULE_PATH = path.join(REPO_ROOT, "src/core/target-app-installer-plan.cjs");
const {
  getTargetAppInstallerRequiredInputs,
  getTargetAppInstallerInstallableFiles,
  createTargetAppInstallerPlan,
  validateTargetAppInstallerPlan,
} = require(MODULE_PATH);

const EXPECTED_INSTALLABLE_FILES = Object.freeze([
  "uiEditor/README.md",
  "uiEditor/uiEditorRegistry.js",
  "uiEditor/targetAppRegistry.js",
  "uiEditor/uiEditorLauncherButton.js",
  "uiEditor/uiEditorLauncherButton.css",
  "uiEditor/uiEditorRules.md",
  "uiEditor/tests/uiEditorRegistry.test.cjs",
  "docs/ui-editor/EDITOR_BAUPLAN.md",
  "docs/ui-editor/UI_ELEMENT_KATALOG.md",
  "docs/ui-editor/UI_BAU_UND_PRUEFREGELN.md",
  "docs/ui-editor/ZIEL_APP_ANBINDUNG.md",
  "docs/ui-editor/UI_EDITOR_VERTRAG.md",
  "docs/ui-editor/UI_PDF_ENTWURFSENTSCHEIDUNG.md",
  "codex/AGENTS_UI_EDITOR_BLOCK.md",
  "codex/CODEX_STARTREGEL_UI_PDF.md",
  "scripts/ui-editor-contract-check.cjs",
  "uiEditor/INSTALLATION_STATUS.md",
  "AGENTS.md",
]);

function createValidInputs(overrides) {
  return {
    targetAppPath: "/tmp/neutral-target-app",
    targetAppId: "neutral-target-app",
    targetAppName: "Neutral Target App",
    selectedMode: "prepare-registry-structure",
    ...(overrides || {}),
  };
}

function assertIncludesAll(actual, expected, label) {
  expected.forEach((entry) => {
    assert.equal(actual.includes(entry), true, `${label} enthaelt ${entry} nicht.`);
  });
}

function assertNoForbiddenFragments(text, label) {
  const forbiddenFragments = [
    ["B", "BM"].join(""),
    "node:fs",
    "writeFile",
    "readFile",
    "mkdir",
    "readdir",
    "querySelector",
    "createElement",
    "innerHTML",
    "document.",
    "window.",
    "navigator.",
    "location.",
    ["D", "OM"].join(""),
    ["HT", "ML"].join(""),
    ["Bro", "wser"].join(""),
  ];

  forbiddenFragments.forEach((fragment) => {
    assert.equal(text.includes(fragment), false, `${label} enthaelt verbotenen Fragmenttext: ${fragment}`);
  });
}

function run() {
  assert.equal(typeof getTargetAppInstallerRequiredInputs, "function");
  assert.equal(typeof getTargetAppInstallerInstallableFiles, "function");
  assert.equal(typeof createTargetAppInstallerPlan, "function");
  assert.equal(typeof validateTargetAppInstallerPlan, "function");

  const requiredInputs = getTargetAppInstallerRequiredInputs();
  assert.deepEqual(requiredInputs, ["targetAppPath", "targetAppId", "targetAppName", "selectedMode"]);
  requiredInputs.push("mutated");
  assert.deepEqual(getTargetAppInstallerRequiredInputs(), [
    "targetAppPath",
    "targetAppId",
    "targetAppName",
    "selectedMode",
  ]);

  const installableFiles = getTargetAppInstallerInstallableFiles();
  assertIncludesAll(installableFiles, EXPECTED_INSTALLABLE_FILES, "installableFiles");
  installableFiles.push("mutated");
  assert.equal(getTargetAppInstallerInstallableFiles().includes("mutated"), false);

  const validPlan = createTargetAppInstallerPlan(createValidInputs());
  assert.equal(validPlan.targetAppId, "neutral-target-app");
  assert.equal(validPlan.targetAppName, "Neutral Target App");
  assert.equal(validPlan.targetAppPath, "/tmp/neutral-target-app");
  assert.equal(validPlan.selectedMode, "prepare-registry-structure");

  assertIncludesAll(validPlan.installableFiles, EXPECTED_INSTALLABLE_FILES, "Plan-installableFiles");
  assertIncludesAll(
    validPlan.blockedActions,
    [
      "scan-ui",
      "auto-detect-elements",
      "auto-register-elements",
      "modify-target-ui",
      "write-domain-data",
      "execute-target-app-action",
    ],
    "blockedActions"
  );
  assertIncludesAll(
    validPlan.requiresConfirmation,
    [
      "target-app-selected",
      "install-path-confirmed",
      "no-auto-scan",
      "no-auto-register",
      "registry-structure-only",
    ],
    "requiresConfirmation"
  );

  assert.throws(
    () => createTargetAppInstallerPlan(createValidInputs({ selectedMode: "unknown-mode" })),
    (error) => {
      assert.equal(error.code, "invalid_target_app_installer_plan_inputs");
      assert.equal(error.errors.some((entry) => entry.code === "unsupported_selected_mode"), true);
      return true;
    }
  );

  const moduleSource = fs.readFileSync(MODULE_PATH, "utf8");
  assertNoForbiddenFragments(moduleSource, "target-app-installer-plan.cjs");

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ui-editor-installer-plan-"));
  const targetAppPath = path.join(tempRoot, "target-app");
  createTargetAppInstallerPlan(createValidInputs({ targetAppPath }));
  assert.equal(fs.existsSync(targetAppPath), false);
  fs.rmSync(tempRoot, { recursive: true, force: true });

  const validationResult = validateTargetAppInstallerPlan(validPlan);
  assert.equal(validationResult.ok, true);
  assert.deepEqual(validationResult.errors, []);

  const invalidPlan = { ...validPlan };
  delete invalidPlan.targetAppId;
  const invalidValidationResult = validateTargetAppInstallerPlan(invalidPlan);
  assert.equal(invalidValidationResult.ok, false);
  assert.equal(
    invalidValidationResult.errors.some(
      (error) => error.code === "missing_required_plan_field" && error.field === "targetAppId"
    ),
    true
  );

  console.log("TESTS OK: target-app-installer-plan");
}

run();
