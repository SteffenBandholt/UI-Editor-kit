#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const { createTargetAppInstallerPlan } = require(path.join(REPO_ROOT, "src/core/target-app-installer-plan.cjs"));
const {
  createTargetAppInstallerExecutionPreview,
  executeTargetAppInstallerPlan,
} = require(path.join(REPO_ROOT, "src/core/target-app-installer-execution.cjs"));

const EXPECTED_FILES = [
  "AGENTS.md",
  "codex/AGENTS_UI_EDITOR_BLOCK.md",
  "codex/CODEX_STARTREGEL_UI_PDF.md",
  "docs/ui-editor/EDITOR_BAUPLAN.md",
  "docs/ui-editor/UI_BAU_UND_PRUEFREGELN.md",
  "docs/ui-editor/UI_EDITOR_VERTRAG.md",
  "docs/ui-editor/UI_ELEMENT_KATALOG.md",
  "docs/ui-editor/UI_PDF_ENTWURFSENTSCHEIDUNG.md",
  "docs/ui-editor/ZIEL_APP_ANBINDUNG.md",
  "scripts/ui-editor-contract-check.cjs",
  "uiEditor/INSTALLATION_STATUS.md",
  "uiEditor/README.md",
  "uiEditor/targetAppRegistry.js",
  "uiEditor/tests/uiEditorInstallation.test.cjs",
  "uiEditor/tests/uiEditorRegistry.test.cjs",
  "uiEditor/uiEditorRegistry.js",
  "uiEditor/uiEditorRules.md",
].sort();

function listFiles(root) {
  const files = [];
  const pending = [root];
  while (pending.length) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(absolute);
      else files.push(path.relative(root, absolute).split(path.sep).join("/"));
    }
  }
  return files.sort();
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ui-editor-installer-execution-"));
const targetAppPath = path.join(tempRoot, "target-app");
fs.mkdirSync(targetAppPath, { recursive: true });

const plan = createTargetAppInstallerPlan({
  targetAppPath,
  targetAppId: "neutral-target-app",
  targetAppName: "Neutral Target App",
  selectedMode: "prepare-registry-structure",
});
const confirmation = {
  installationConfirmed: true,
  targetAppSelected: true,
  installPathConfirmed: true,
  noAutoScan: true,
  noAutoRegister: true,
  registryStructureOnly: true,
};

const preview = createTargetAppInstallerExecutionPreview({ installerPlan: plan, confirmation: {} });
assert.equal(preview.ok, true);
assert.deepEqual(preview.preview.filesToCreate.slice().sort(), EXPECTED_FILES);
assert.equal(preview.preview.willWriteFiles, false);
assert.deepEqual(listFiles(targetAppPath), []);

const result = executeTargetAppInstallerPlan({ installerPlan: plan, confirmation });
assert.equal(result.ok, true);
assert.deepEqual(listFiles(targetAppPath), EXPECTED_FILES);
assert.equal(result.report.safety.scansDom, false);
assert.equal(result.report.safety.autoRegistersElements, false);
assert.equal(result.report.installedUiEditorFiles.some((file) => /selection|contract\.js|launcher|\.css$/i.test(file)), false);

const installedTest = childProcess.spawnSync(process.execPath, ["uiEditor/tests/uiEditorInstallation.test.cjs"], {
  cwd: targetAppPath,
  encoding: "utf8",
});
assert.equal(installedTest.status, 0, installedTest.stderr || installedTest.stdout);

fs.rmSync(tempRoot, { recursive: true, force: true });
console.log("TESTS OK: target-app-installer-execution");
