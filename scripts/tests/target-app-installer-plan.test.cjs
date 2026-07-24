#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const {
  getTargetAppInstallerRequiredInputs,
  getTargetAppInstallerInstallableFiles,
  createTargetAppInstallerPlan,
  validateTargetAppInstallerPlan,
} = require(path.join(REPO_ROOT, "src/core/target-app-installer-plan.cjs"));

const EXPECTED_FILES = [
  "uiEditor/README.md",
  "uiEditor/uiEditorRegistry.js",
  "uiEditor/targetAppRegistry.js",
  "uiEditor/uiEditorRules.md",
  "uiEditor/tests/uiEditorRegistry.test.cjs",
  "uiEditor/tests/uiEditorInstallation.test.cjs",
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
];

assert.deepEqual(getTargetAppInstallerRequiredInputs(), [
  "targetAppPath",
  "targetAppId",
  "targetAppName",
  "selectedMode",
]);
assert.deepEqual(getTargetAppInstallerInstallableFiles(), EXPECTED_FILES);

const plan = createTargetAppInstallerPlan({
  targetAppPath: "/tmp/neutral-target-app",
  targetAppId: "neutral-target-app",
  targetAppName: "Neutral Target App",
  selectedMode: "prepare-registry-structure",
});
assert.deepEqual(plan.installableFiles, EXPECTED_FILES);
assert.equal(plan.blockedActions.includes("scan-ui"), true);
assert.equal(plan.blockedActions.includes("auto-register-elements"), true);
assert.equal(plan.requiresConfirmation.includes("registry-structure-only"), true);
assert.equal(validateTargetAppInstallerPlan(plan).ok, true);
assert.equal(EXPECTED_FILES.some((file) => /selection|contract\.js|launcher|\.css$/i.test(file)), false);

console.log("TESTS OK: target-app-installer-plan");
