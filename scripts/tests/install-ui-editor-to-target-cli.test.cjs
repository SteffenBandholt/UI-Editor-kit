#!/usr/bin/env node

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const CLI_PATH = path.join(REPO_ROOT, "scripts/install-ui-editor-to-target.cjs");

const EXPECTED_INSTALLED_FILES = Object.freeze([
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
  "uiEditor/targetSelection.js",
  "uiEditor/tests/uiEditorInstallation.test.cjs",
  "uiEditor/tests/uiEditorRegistry.test.cjs",
  "uiEditor/uiEditorLauncherButton.css",
  "uiEditor/uiEditorLauncherButton.js",
  "uiEditor/uiEditorRegistry.js",
  "uiEditor/uiEditorRules.md",
]);

function createTempTargetApp(label) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), `ui-editor-cli-${label}-`));
  const targetAppPath = path.join(tempRoot, "target-app");
  fs.mkdirSync(targetAppPath, { recursive: true });

  return { tempRoot, targetAppPath };
}

function runCli(args) {
  return childProcess.spawnSync(process.execPath, [CLI_PATH].concat(args || []), {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
}

function runInstalledInstallationTest(targetAppPath) {
  return childProcess.spawnSync(process.execPath, ["uiEditor/tests/uiEditorInstallation.test.cjs"], {
    cwd: targetAppPath,
    encoding: "utf8",
  });
}

function listFiles(root) {
  const files = [];
  const pending = [root];

  while (pending.length > 0) {
    const current = pending.pop();
    fs.readdirSync(current, { withFileTypes: true }).forEach((entry) => {
      const absolutePath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        pending.push(absolutePath);
        return;
      }

      files.push(path.relative(root, absolutePath).split(path.sep).join("/"));
    });
  }

  return files.sort();
}

function assertOutputIncludes(output, text) {
  assert.equal(output.includes(text), true, `CLI-Ausgabe enthaelt nicht: ${text}`);
}

function assertExpectedFilesWritten(targetAppPath) {
  assert.deepEqual(listFiles(targetAppPath), EXPECTED_INSTALLED_FILES.slice().sort());
}

function assertSafetyOutput(output) {
  [
    "Ziel-UI gelesen: nein",
    "DOM gescannt: nein",
    "Elemente automatisch erkannt: nein",
    "Elemente automatisch registriert: nein",
    "Ziel-App-UI geaendert: nein",
    "Fachlogik geaendert: nein",
    "Fachdaten geaendert: nein",
  ].forEach((line) => {
    assertOutputIncludes(output, line);
  });
}

function assertNoForbiddenBrowserFragments() {
  const cliSource = fs.readFileSync(CLI_PATH, "utf8");
  [
    "querySelector",
    "document.",
    "window.",
    ["D", "OMParser"].join(""),
    "createElement",
    "innerHTML",
  ].forEach((fragment) => {
    assert.equal(cliSource.includes(fragment), false, `CLI-Code enthaelt verbotenes Browser-Fragment: ${fragment}`);
  });
}

function run() {
  const missingTargetResult = runCli([]);
  const missingTargetOutput = `${missingTargetResult.stdout}\n${missingTargetResult.stderr}`;
  assert.equal(missingTargetResult.status, 1);
  assertOutputIncludes(missingTargetOutput, "Nutzung:");
  assertOutputIncludes(missingTargetOutput, 'node scripts/install-ui-editor-to-target.cjs "<ziel-app-pfad>" [--overwrite]');

  const installTarget = createTempTargetApp("install");
  const installResult = runCli([installTarget.targetAppPath]);
  assert.equal(installResult.status, 0, installResult.stderr || installResult.stdout);
  assertOutputIncludes(installResult.stdout, "UI-Editor Ziel-App-Installation");
  assertOutputIncludes(installResult.stdout, `Ziel: ${path.resolve(installTarget.targetAppPath)}`);
  assertOutputIncludes(installResult.stdout, "Status: OK");
  assertOutputIncludes(installResult.stdout, "Installation erfolgreich.");
  assertOutputIncludes(installResult.stdout, "Geschriebene Dateien:");
  assertOutputIncludes(installResult.stdout, "uiEditor/tests/uiEditorInstallation.test.cjs");
  assertOutputIncludes(installResult.stdout, "Naechster Pruefbefehl:");
  assertOutputIncludes(
    installResult.stdout,
    `node "${path.join(path.resolve(installTarget.targetAppPath), "uiEditor", "tests", "uiEditorInstallation.test.cjs")}"`
  );
  assertSafetyOutput(installResult.stdout);
  assertExpectedFilesWritten(installTarget.targetAppPath);
  assert.equal(
    fs.existsSync(path.join(installTarget.targetAppPath, "uiEditor/tests/uiEditorInstallation.test.cjs")),
    true
  );

  const installedTestResult = runInstalledInstallationTest(installTarget.targetAppPath);
  assert.equal(installedTestResult.status, 0, installedTestResult.stderr || installedTestResult.stdout);
  assert.equal(installedTestResult.stdout.includes("TESTS OK: uiEditorInstallation"), true);

  const existingTargetResult = runCli([installTarget.targetAppPath]);
  assert.equal(existingTargetResult.status, 1);
  assertOutputIncludes(existingTargetResult.stdout, "Status: FEHLER");
  assertOutputIncludes(existingTargetResult.stdout, "target_file_already_exists");
  assertSafetyOutput(existingTargetResult.stdout);

  const overwriteTarget = createTempTargetApp("overwrite");
  const managedFilePath = path.join(overwriteTarget.targetAppPath, "uiEditor/README.md");
  fs.mkdirSync(path.dirname(managedFilePath), { recursive: true });
  fs.writeFileSync(managedFilePath, "existing", "utf8");

  const overwriteResult = runCli([overwriteTarget.targetAppPath, "--overwrite"]);
  assert.equal(overwriteResult.status, 0, overwriteResult.stderr || overwriteResult.stdout);
  assertOutputIncludes(overwriteResult.stdout, "Status: OK");
  assertExpectedFilesWritten(overwriteTarget.targetAppPath);
  assert.notEqual(fs.readFileSync(managedFilePath, "utf8"), "existing");

  const overwrittenInstalledTestResult = runInstalledInstallationTest(overwriteTarget.targetAppPath);
  assert.equal(
    overwrittenInstalledTestResult.status,
    0,
    overwrittenInstalledTestResult.stderr || overwrittenInstalledTestResult.stdout
  );

  assertNoForbiddenBrowserFragments();

  console.log("TESTS OK: install-ui-editor-to-target-cli");
}

run();
