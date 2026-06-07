#!/usr/bin/env node

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const PLAN_MODULE_PATH = path.join(REPO_ROOT, "src/core/target-app-installer-plan.cjs");
const EXECUTION_MODULE_PATH = path.join(REPO_ROOT, "src/core/target-app-installer-execution.cjs");
const ARTIFACTS_MODULE_PATH = path.join(REPO_ROOT, "src/core/target-app-installer-artifacts.cjs");
const UI_ELEMENT_MODEL_MODULE_PATH = path.join(REPO_ROOT, "src/core/ui-element-model.cjs");
const UI_ELEMENT_VALIDATOR_MODULE_PATH = path.join(REPO_ROOT, "src/core/ui-element-validator.cjs");

const { createTargetAppInstallerPlan } = require(PLAN_MODULE_PATH);
const {
  getTargetAppInstallerExecutionRequiredInputs,
  createTargetAppInstallerExecutionPreview,
  executeTargetAppInstallerPlan,
} = require(EXECUTION_MODULE_PATH);
const { UI_ELEMENT_OPERATIONS } = require(UI_ELEMENT_MODEL_MODULE_PATH);
const { validateUiElementList } = require(UI_ELEMENT_VALIDATOR_MODULE_PATH);

const MANAGED_FILES = Object.freeze([
  "uiEditor/README.md",
  "uiEditor/uiEditorRegistry.js",
  "uiEditor/targetAppRegistry.js",
  "uiEditor/targetSelection.js",
  "uiEditor/targetContract.js",
  "uiEditor/uiEditorLauncherButton.js",
  "uiEditor/uiEditorLauncherButton.css",
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
]);

const ALLOWED_FILES = Object.freeze(MANAGED_FILES.concat(["AGENTS.md"]));

const SOURCE_MIRRORED_FILES = Object.freeze([
  ["docs/ui-editor/EDITOR_BAUPLAN.md", "docs/EDITOR_BAUPLAN.md"],
  ["docs/ui-editor/UI_ELEMENT_KATALOG.md", "docs/UI_ELEMENT_KATALOG.md"],
  ["docs/ui-editor/UI_BAU_UND_PRUEFREGELN.md", "docs/UI_BAU_UND_PRUEFREGELN.md"],
  ["docs/ui-editor/ZIEL_APP_ANBINDUNG.md", "docs/ZIEL_APP_ANBINDUNG.md"],
  ["docs/ui-editor/UI_EDITOR_VERTRAG.md", "docs/UI_EDITOR_VERTRAG.md"],
  ["docs/ui-editor/UI_PDF_ENTWURFSENTSCHEIDUNG.md", "docs/UI_PDF_ENTWURFSENTSCHEIDUNG.md"],
  ["codex/AGENTS_UI_EDITOR_BLOCK.md", "codex/AGENTS_UI_EDITOR_BLOCK.md"],
  ["codex/CODEX_STARTREGEL_UI_PDF.md", "codex/CODEX_STARTREGEL_UI_PDF.md"],
  ["scripts/ui-editor-contract-check.cjs", "scripts/ui-editor-contract-check.cjs"],
]);

function createTempTargetApp() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ui-editor-installer-execution-"));
  return {
    tempRoot,
    targetAppPath: path.join(tempRoot, "target-app"),
  };
}

function createValidPlan(overrides) {
  const { targetAppPath } = createTempTargetApp();
  const planInputs = {
    targetAppPath,
    targetAppId: "neutral-target-app",
    targetAppName: "Neutral Target App",
    selectedMode: "prepare-registry-structure",
    ...(overrides || {}),
  };
  const plan = createTargetAppInstallerPlan(planInputs);

  fs.mkdirSync(plan.targetAppPath, { recursive: true });

  return plan;
}

function createConfirmedInputs(installerPlan, confirmationOverrides) {
  return {
    installerPlan,
    confirmation: {
      installationConfirmed: true,
      targetAppSelected: true,
      installPathConfirmed: true,
      noAutoScan: true,
      noAutoRegister: true,
      registryStructureOnly: true,
      ...(confirmationOverrides || {}),
    },
  };
}

function listFiles(root) {
  if (!fs.existsSync(root)) {
    return [];
  }

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

function readInstalled(targetAppPath, relativePath) {
  return fs.readFileSync(path.join(targetAppPath, relativePath), "utf8");
}

function readRepo(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

function assertNoFiles(root, message) {
  assert.deepEqual(listFiles(root), [], message);
}

function assertNoForbiddenFragments(text, label) {
  const forbiddenFragments = [
    ["B", "BM"].join(""),
    "querySelector",
    "createElement",
    "innerHTML",
    ["D", "OMParser"].join(""),
    "document.",
    "window.",
    "navigator.",
    "location.",
    ["D", "OM"].join(""),
    ["HT", "ML"].join(""),
    ["Bro", "wser"].join(""),
    "detectElements",
    "autoRegister",
    "scan-ui",
    "modify-target-ui",
    "write-domain-data",
    "execute-target-app-action",
  ];

  forbiddenFragments.forEach((fragment) => {
    assert.equal(text.includes(fragment), false, `${label} enthaelt verbotenen Fragmenttext: ${fragment}`);
  });
}

function getCssNumber(cssSource, propertyName) {
  const match = cssSource.match(new RegExp(`${propertyName}:\\s*(-?\\d+)`, "u"));
  return match ? Number(match[1]) : NaN;
}

function assertWrittenFilesAreAllowed(targetAppPath) {
  assert.deepEqual(listFiles(targetAppPath), ALLOWED_FILES.slice().sort());
}

function assertMirroredSourceFiles(targetAppPath) {
  SOURCE_MIRRORED_FILES.forEach(([installedPath, sourcePath]) => {
    assert.equal(
      readInstalled(targetAppPath, installedPath),
      readRepo(sourcePath),
      `${installedPath} muss inhaltlich aus ${sourcePath} stammen.`
    );
  });
}

function runInstalledInstallationTest(targetAppPath) {
  return childProcess.spawnSync(process.execPath, ["uiEditor/tests/uiEditorInstallation.test.cjs"], {
    cwd: targetAppPath,
    encoding: "utf8",
  });
}

function assertLauncherButtonIsEsmImportSafe(launcherButtonSource) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ui-editor-launcher-esm-"));
  fs.writeFileSync(path.join(tempRoot, "package.json"), "{\"type\":\"module\"}\n", "utf8");
  fs.writeFileSync(path.join(tempRoot, "uiEditorLauncherButton.js"), launcherButtonSource, "utf8");

  const importResult = childProcess.spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      [
        "import './uiEditorLauncherButton.js';",
        "const artifact = globalThis.uiEditorLauncherButtonArtifact;",
        "if (!artifact) throw new Error('global artifact missing');",
        "if (!artifact.uiEditorLauncherButton) throw new Error('launcher artifact object missing');",
        "if (artifact.createUiEditorLauncherButton().role !== 'editor-launcher') throw new Error('launcher role mismatch');",
        "if (artifact.uiEditorLauncherButton.role !== 'editor-launcher') throw new Error('static launcher role mismatch');",
        "if (artifact.uiEditorLauncherButton.area !== 'overlay') throw new Error('static launcher area mismatch');",
      ].join("\n"),
    ],
    {
      cwd: tempRoot,
      encoding: "utf8",
    }
  );

  assert.equal(importResult.status, 0, importResult.stderr || importResult.stdout);
}

function assertTargetSelectionIsEsmImportSafe(targetSelectionSource) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ui-editor-target-selection-esm-"));
  fs.writeFileSync(path.join(tempRoot, "package.json"), "{\"type\":\"module\"}\n", "utf8");
  fs.writeFileSync(path.join(tempRoot, "targetSelection.js"), targetSelectionSource, "utf8");

  const importResult = childProcess.spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      [
        "import './targetSelection.js';",
        "const artifact = globalThis.uiEditorTargetSelectionArtifact;",
        "if (!artifact) throw new Error('global artifact missing');",
        "if (typeof artifact.createTargetSelectionController !== 'function') throw new Error('controller missing');",
        "if (typeof artifact.createTargetSelectionPanelController !== 'function') throw new Error('panel controller missing');",
        "if (artifact.DEFAULT_TARGET_ATTRIBUTE_NAME !== 'data-ui-editor-id') throw new Error('default attribute mismatch');",
        "if (artifact.HOVERED_TARGET_ATTRIBUTE_NAME !== 'data-ui-editor-hovered') throw new Error('hover attribute mismatch');",
        "if (artifact.SELECTED_TARGET_ATTRIBUTE_NAME !== 'data-ui-editor-selected') throw new Error('selected attribute mismatch');",
      ].join("\n"),
    ],
    {
      cwd: tempRoot,
      encoding: "utf8",
    }
  );

  assert.equal(importResult.status, 0, importResult.stderr || importResult.stdout);
}

function assertTargetContractIsEsmImportSafe(targetContractSource) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ui-editor-target-contract-esm-"));
  fs.writeFileSync(path.join(tempRoot, "package.json"), "{\"type\":\"module\"}\n", "utf8");
  fs.writeFileSync(path.join(tempRoot, "targetContract.js"), targetContractSource, "utf8");

  const importResult = childProcess.spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      [
        "import './targetContract.js';",
        "const artifact = globalThis.uiEditorTargetContractArtifact;",
        "if (!artifact) throw new Error('global artifact missing');",
        "if (typeof artifact.validateTargetContract !== 'function') throw new Error('validator missing');",
        "if (typeof artifact.validateTargetSurfaceContracts !== 'function') throw new Error('surface validator missing');",
        "if (!artifact.ERROR_CODES.DOM_TARGET_MISSING) throw new Error('error codes missing');",
        "if (!artifact.ERROR_CODES.SURFACE_CONTRACT_FAILED) throw new Error('surface error code missing');",
        "if (artifact.DEFAULT_TARGET_ATTRIBUTE_NAME !== 'data-ui-editor-id') throw new Error('default attribute mismatch');",
      ].join("\n"),
    ],
    {
      cwd: tempRoot,
      encoding: "utf8",
    }
  );

  assert.equal(importResult.status, 0, importResult.stderr || importResult.stdout);
}

function assertInstallerReport(report, plan, phase) {
  assert.equal(report.reportVersion, "1.0.0");
  assert.equal(report.phase, phase);
  assert.equal(report.mode, "prepare-registry-structure");
  assert.equal(report.targetAppId, plan.targetAppId);
  assert.equal(report.targetAppName, plan.targetAppName);
  assert.equal(report.targetAppPath, plan.targetAppPath);
  assert.equal(report.installedRuleFiles.includes("docs/ui-editor/EDITOR_BAUPLAN.md"), true);
  assert.equal(report.installedRuleFiles.includes("docs/ui-editor/UI_EDITOR_VERTRAG.md"), true);
  assert.equal(report.installedCodexFiles.includes("codex/AGENTS_UI_EDITOR_BLOCK.md"), true);
  assert.equal(report.installedCodexFiles.includes("codex/CODEX_STARTREGEL_UI_PDF.md"), true);
  assert.deepEqual(report.installedCheckFiles, ["scripts/ui-editor-contract-check.cjs"]);
  assert.equal(report.installedUiEditorFiles.includes("uiEditor/README.md"), true);
  assert.equal(report.installedUiEditorFiles.includes("uiEditor/INSTALLATION_STATUS.md"), true);
  assert.equal(report.installedUiEditorFiles.includes("uiEditor/targetSelection.js"), true);
  assert.equal(report.installedUiEditorFiles.includes("uiEditor/targetContract.js"), true);
  assert.equal(report.installedTestFiles.includes("uiEditor/tests/uiEditorRegistry.test.cjs"), true);
  assert.equal(report.installedTestFiles.includes("uiEditor/tests/uiEditorInstallation.test.cjs"), true);
  assert.equal(report.agentsHandling.path, "AGENTS.md");
  assert.equal(report.agentsHandling.usesMarkers, true);
  assert.equal(report.agentsHandling.startMarker, "<!-- UI-EDITOR-KIT:START -->");
  assert.equal(report.agentsHandling.endMarker, "<!-- UI-EDITOR-KIT:END -->");
  assert.equal(report.safety.readsTargetUi, false);
  assert.equal(report.safety.scansDom, false);
  assert.equal(report.safety.autoDetectsElements, false);
  assert.equal(report.safety.autoRegistersElements, false);
  assert.equal(report.safety.modifiesTargetUi, false);
  assert.equal(report.safety.modifiesDomainLogic, false);
  assert.equal(report.safety.modifiesDomainData, false);
  assert.equal(report.safety.writesOutsideTargetAppPath, false);
  assert.equal(report.nextManualCheck, "node uiEditor/tests/uiEditorInstallation.test.cjs");
  assert.equal(report.preflight.targetAppPath, plan.targetAppPath);
  assert.equal(report.preflight.checks.targetPathExists, true);
  assert.equal(report.preflight.checks.targetPathIsDirectory, true);
  assert.equal(report.preflight.checks.targetPathReadable, true);
  assert.equal(report.preflight.checks.targetPathWritable, true);
  assert.equal(report.preflight.checks.targetPathInsideEditorRepo, false);
  assert.equal(report.preflight.checks.targetPathLooksUnsafe, false);
  assert.equal(report.preflight.safety.readsTargetUi, false);
  assert.equal(report.preflight.safety.scansDom, false);
  assert.equal(report.preflight.safety.autoDetectsElements, false);
  assert.equal(report.preflight.safety.autoRegistersElements, false);
  assert.equal(report.preflight.safety.modifiesTargetUi, false);
  assert.equal(report.preflight.safety.modifiesDomainLogic, false);
  assert.equal(report.preflight.safety.modifiesDomainData, false);
}

function run() {
  assert.equal(typeof getTargetAppInstallerExecutionRequiredInputs, "function");
  assert.equal(typeof createTargetAppInstallerExecutionPreview, "function");
  assert.equal(typeof executeTargetAppInstallerPlan, "function");
  assert.deepEqual(getTargetAppInstallerExecutionRequiredInputs(), ["installerPlan", "confirmation"]);

  const previewPlan = createValidPlan();
  const previewResult = createTargetAppInstallerExecutionPreview({ installerPlan: previewPlan, confirmation: {} });
  assert.equal(previewResult.ok, true);
  assert.equal(previewResult.preview.targetAppPath, previewPlan.targetAppPath);
  assert.equal(previewResult.preview.targetAppId, previewPlan.targetAppId);
  assert.equal(previewResult.preview.selectedMode, previewPlan.selectedMode);
  assert.deepEqual(previewResult.preview.filesToCreate, ALLOWED_FILES);
  assert.equal(previewResult.preview.agentsFile, "AGENTS.md");
  assert.equal(previewResult.preview.requiresConfirmation.includes("registry-structure-only"), true);
  assert.equal(previewResult.preview.willWriteFiles, false);
  assert.equal(previewResult.preview.willScanUi, false);
  assert.equal(previewResult.preview.willModifyTargetUi, false);
  assert.equal(previewResult.preview.willRegisterElements, false);
  assertInstallerReport(previewResult.preview.report, previewPlan, "preview");
  assert.equal(previewResult.preview.preflight.agentsStatus, "missing-will-create");
  assert.deepEqual(previewResult.preview.report.writtenFiles, []);
  assert.equal(previewResult.preview.report.affectedFiles.includes("uiEditor/tests/uiEditorInstallation.test.cjs"), true);
  assertNoFiles(previewPlan.targetAppPath, "Preview darf keine Dateien schreiben.");

  const unconfirmedPlan = createValidPlan();
  const unconfirmedResult = executeTargetAppInstallerPlan({
    installerPlan: unconfirmedPlan,
    confirmation: { installationConfirmed: true },
  });
  assert.equal(unconfirmedResult.ok, false);
  assert.equal(unconfirmedResult.errors.some((error) => error.code === "missing_execution_confirmation_flag"), true);
  assertNoFiles(unconfirmedPlan.targetAppPath, "Ohne vollstaendige Bestaetigung darf nichts geschrieben werden.");

  const missingTargetRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ui-editor-installer-missing-target-"));
  const missingTargetPath = path.join(missingTargetRoot, "target-app");
  const missingTargetPlan = createTargetAppInstallerPlan({
    targetAppPath: missingTargetPath,
    targetAppId: "missing-target-app",
    targetAppName: "Missing Target App",
    selectedMode: "prepare-registry-structure",
  });
  const missingTargetResult = executeTargetAppInstallerPlan(createConfirmedInputs(missingTargetPlan));
  assert.equal(missingTargetResult.ok, false);
  assert.equal(missingTargetResult.errors.some((error) => error.code === "target_path_missing"), true);
  assert.equal(missingTargetResult.report.preflight.checks.targetPathExists, false);

  const fileTargetRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ui-editor-installer-file-target-"));
  const fileTargetPath = path.join(fileTargetRoot, "target-app.txt");
  fs.writeFileSync(fileTargetPath, "not a directory", "utf8");
  const fileTargetPlan = createTargetAppInstallerPlan({
    targetAppPath: fileTargetPath,
    targetAppId: "file-target-app",
    targetAppName: "File Target App",
    selectedMode: "prepare-registry-structure",
  });
  const fileTargetResult = executeTargetAppInstallerPlan(createConfirmedInputs(fileTargetPlan));
  assert.equal(fileTargetResult.ok, false);
  assert.equal(fileTargetResult.errors.some((error) => error.code === "target_path_not_directory"), true);
  assert.equal(fileTargetResult.report.preflight.checks.targetPathIsDirectory, false);

  const repoInsideTargetPath = path.join(REPO_ROOT, "tmp-preflight-target");
  fs.mkdirSync(repoInsideTargetPath, { recursive: true });
  const repoInsidePlan = createTargetAppInstallerPlan({
    targetAppPath: repoInsideTargetPath,
    targetAppId: "repo-inside-target-app",
    targetAppName: "Repo Inside Target App",
    selectedMode: "prepare-registry-structure",
  });
  const repoInsideResult = executeTargetAppInstallerPlan(createConfirmedInputs(repoInsidePlan));
  assert.equal(repoInsideResult.ok, false);
  assert.equal(repoInsideResult.errors.some((error) => error.code === "target_path_inside_editor_repo"), true);
  assert.equal(repoInsideResult.report.preflight.checks.targetPathInsideEditorRepo, true);
  fs.rmSync(repoInsideTargetPath, { recursive: true, force: true });

  const confirmedPlan = createValidPlan();
  const confirmedResult = executeTargetAppInstallerPlan(createConfirmedInputs(confirmedPlan));
  assert.equal(confirmedResult.ok, true);
  assert.deepEqual(confirmedResult.writtenFiles.slice().sort(), ALLOWED_FILES.slice().sort());
  assertInstallerReport(confirmedResult.report, confirmedPlan, "install");
  assert.deepEqual(confirmedResult.report.writtenFiles.slice().sort(), ALLOWED_FILES.slice().sort());
  assert.equal(confirmedResult.report.affectedFiles.includes("uiEditor/tests/uiEditorInstallation.test.cjs"), true);
  assert.equal(confirmedResult.report.preflight.agentsStatus, "missing-will-create");
  assertWrittenFilesAreAllowed(confirmedPlan.targetAppPath);
  assertMirroredSourceFiles(confirmedPlan.targetAppPath);

  const installedRegistryModule = require(path.join(confirmedPlan.targetAppPath, "uiEditor/uiEditorRegistry.js"));
  const installedElements = installedRegistryModule.uiEditorRegistry.uiScopes[0].elements;
  const installedRootElement = installedElements[0];
  const installedLauncherElement = installedElements[1];
  assert.equal(installedRootElement.id, "uiEditor.root");
  assert.equal(installedRootElement.name, "UI-Editor Root");
  assert.equal(installedRootElement.type, "root");
  assert.equal(installedRootElement.role, "system");
  assert.equal(installedRootElement.parentId, null);
  assert.equal(installedRootElement.order, 0);
  assert.equal(installedRootElement.visible, true);
  assert.equal(installedRootElement.editable, false);
  assert.deepEqual(installedRootElement.allowedOps, ["inspect"]);
  assert.deepEqual(installedRootElement.lockedOps, []);
  assert.equal(installedLauncherElement.id, "uiEditor.launcherButton");
  assert.equal(installedLauncherElement.name, "UI-Editor Launcher");
  assert.equal(installedLauncherElement.type, "button");
  assert.equal(installedLauncherElement.role, "editor-launcher");
  assert.equal(installedLauncherElement.parentId, "uiEditor.root");
  assert.equal(installedLauncherElement.order, 10);
  assert.equal(installedLauncherElement.visible, true);
  assert.equal(installedLauncherElement.editable, true);
  assert.equal(installedLauncherElement.area, "overlay");
  assert.deepEqual(installedLauncherElement.position, { x: 24, y: 24 });
  assert.deepEqual(installedLauncherElement.allowedOps, ["inspect", "move", "hide", "show"]);
  assert.deepEqual(installedLauncherElement.lockedOps, ["rename", "delete", "executeTargetAction", "modifyDomainData"]);
  assert.equal(validateUiElementList(installedElements).ok, true);
  installedElements.forEach((element) => {
    element.allowedOps.concat(element.lockedOps).forEach((operation) => {
      assert.equal(UI_ELEMENT_OPERATIONS.includes(operation), true, `Ungueltige Operation installiert: ${operation}`);
    });
  });

  const readme = readInstalled(confirmedPlan.targetAppPath, "uiEditor/README.md");
  const registry = readInstalled(confirmedPlan.targetAppPath, "uiEditor/uiEditorRegistry.js");
  const targetAppRegistry = readInstalled(confirmedPlan.targetAppPath, "uiEditor/targetAppRegistry.js");
  const targetSelection = readInstalled(confirmedPlan.targetAppPath, "uiEditor/targetSelection.js");
  const targetContract = readInstalled(confirmedPlan.targetAppPath, "uiEditor/targetContract.js");
  const launcherButton = readInstalled(confirmedPlan.targetAppPath, "uiEditor/uiEditorLauncherButton.js");
  const launcherButtonCss = readInstalled(confirmedPlan.targetAppPath, "uiEditor/uiEditorLauncherButton.css");
  const rules = readInstalled(confirmedPlan.targetAppPath, "uiEditor/uiEditorRules.md");
  const contractTest = readInstalled(confirmedPlan.targetAppPath, "uiEditor/tests/uiEditorRegistry.test.cjs");
  const installationTest = readInstalled(confirmedPlan.targetAppPath, "uiEditor/tests/uiEditorInstallation.test.cjs");
  const installationStatus = readInstalled(confirmedPlan.targetAppPath, "uiEditor/INSTALLATION_STATUS.md");
  const agentsFile = readInstalled(confirmedPlan.targetAppPath, "AGENTS.md");

  assert.equal(readme.includes("Registry-Struktur"), true);
  assert.equal(readme.includes("keine fachlichen Aktionen"), true);
  assert.equal(registry.includes("uiEditor.global"), true);
  assert.equal(registry.includes("uiEditor.root"), true);
  assert.equal(registry.includes('name: "UI-Editor Root"'), true);
  assert.equal(registry.includes('type: "root"'), true);
  assert.equal(registry.includes('role: "system"'), true);
  assert.equal(registry.includes("parentId: null"), true);
  assert.equal(registry.includes("order: 0"), true);
  assert.equal(registry.includes("visible: true"), true);
  assert.equal(registry.includes("lockedOps: Object.freeze([])"), true);
  assert.equal(registry.includes("uiEditor.launcherButton"), true);
  assert.equal(registry.includes('name: "UI-Editor Launcher"'), true);
  assert.equal(registry.includes('type: "button"'), true);
  assert.equal(registry.includes('role: "editor-launcher"'), true);
  assert.equal(registry.includes('parentId: "uiEditor.root"'), true);
  assert.equal(registry.includes("order: 10"), true);
  assert.equal(registry.includes("visible: true"), true);
  assert.equal(registry.includes("editable: true"), true);
  assert.equal(registry.includes('area: "overlay"'), true);
  assert.equal(registry.includes("position: Object.freeze({ x: 24, y: 24 })"), true);
  assert.equal(registry.includes('allowedOps: Object.freeze(["inspect", "move", "hide", "show"])'), true);
  assert.equal(
    registry.includes('lockedOps: Object.freeze(["rename", "delete", "executeTargetAction", "modifyDomainData"])'),
    true
  );
  assert.equal(targetAppRegistry.includes("getTargetAppRegistryContractInfo"), true);
  assert.equal(targetAppRegistry.includes('publicEntry: "uiEditor/targetAppRegistry.js"'), true);
  assert.equal(targetAppRegistry.includes('reason: "storage-not-configured"'), true);
  assert.equal(targetSelection.includes("createTargetSelectionController"), true);
  assert.equal(targetSelection.includes("createTargetSelectionPanelController"), true);
  assert.equal(targetSelection.includes("DEFAULT_TARGET_ATTRIBUTE_NAME"), true);
  assert.equal(targetSelection.includes("HOVERED_TARGET_ATTRIBUTE_NAME"), true);
  assert.equal(targetSelection.includes("SELECTED_TARGET_ATTRIBUTE_NAME"), true);
  assert.equal(targetSelection.includes("data-ui-editor-id"), true);
  assert.equal(targetSelection.includes("data-ui-editor-hovered"), true);
  assert.equal(targetSelection.includes("data-ui-editor-panel-collapsed"), true);
  assert.equal(targetSelection.includes("data-ui-editor-panel-hidden"), true);
  assert.equal(targetSelection.includes("pointermove"), true);
  assert.equal(targetSelection.includes("closest"), true);
  assert.equal(targetSelection.includes("uiEditorTargetSelectionArtifact"), true);
  assert.equal(targetSelection.includes('if (typeof module === "object"'), true);
  assert.equal(targetSelection.includes("globalThis"), true);
  assert.equal(targetSelection.includes("\nmodule.exports = {\n"), false);
  assert.equal(targetContract.includes("validateTargetContract"), true);
  assert.equal(targetContract.includes("validateTargetSurfaceContracts"), true);
  assert.equal(targetContract.includes("ERROR_CODES"), true);
  assert.equal(targetContract.includes("SURFACE_CONTRACT_FAILED"), true);
  assert.equal(targetContract.includes("DOM_TARGET_MISSING"), true);
  assert.equal(targetContract.includes("PARENT_ID_UNKNOWN"), true);
  assert.equal(targetContract.includes("DOM_PARENT_MISMATCH"), true);
  assert.equal(targetContract.includes("GROUP_WITHOUT_DOM_WRAPPER"), true);
  assert.equal(targetContract.includes("FIELD_NOT_INSIDE_GROUP"), true);
  assert.equal(targetContract.includes("uiEditorTargetContractArtifact"), true);
  assert.equal(targetContract.includes("data-ui-editor-id"), true);
  assert.equal(targetContract.includes('if (typeof module === "object"'), true);
  assert.equal(targetContract.includes("globalThis"), true);
  assert.equal(targetContract.includes("\nmodule.exports = {\n"), false);
  assert.equal(targetSelection.includes("querySelectorAll"), false);
  assert.equal(targetContract.includes("querySelectorAll"), false);
  assert.equal(targetSelection.includes("localStorage"), false);
  assert.equal(targetContract.includes("localStorage"), false);
  assert.equal(targetSelection.includes("sessionStorage"), false);
  assert.equal(targetContract.includes("sessionStorage"), false);
  assert.equal(targetSelection.includes("ipc"), false);
  assert.equal(targetContract.includes("ipc"), false);
  assert.equal(targetSelection.includes("preload"), false);
  assert.equal(targetContract.includes("preload"), false);
  assert.equal(targetSelection.includes("sqlite"), false);
  assert.equal(targetContract.includes("sqlite"), false);
  assert.equal(targetSelection.includes("postgres"), false);
  assert.equal(targetContract.includes("postgres"), false);
  assert.equal(targetSelection.includes("mysql"), false);
  assert.equal(targetContract.includes("mysql"), false);
  assert.equal(targetSelection.includes("BBM"), false);
  assert.equal(targetContract.includes("BBM"), false);
  assert.equal(targetSelection.includes("Restarbeiten"), false);
  assert.equal(targetContract.includes("Restarbeiten"), false);
  assert.equal(targetSelection.includes("Protokoll"), false);
  assert.equal(targetContract.includes("Protokoll"), false);
  const installedTargetSelectionModule = require(path.join(confirmedPlan.targetAppPath, "uiEditor/targetSelection.js"));
  assert.equal(typeof installedTargetSelectionModule.createTargetSelectionController, "function");
  assert.equal(typeof installedTargetSelectionModule.createTargetSelectionPanelController, "function");
  assert.equal(installedTargetSelectionModule.DEFAULT_TARGET_ATTRIBUTE_NAME, "data-ui-editor-id");
  assert.equal(installedTargetSelectionModule.HOVERED_TARGET_ATTRIBUTE_NAME, "data-ui-editor-hovered");
  assert.equal(installedTargetSelectionModule.SELECTED_TARGET_ATTRIBUTE_NAME, "data-ui-editor-selected");
  assertTargetSelectionIsEsmImportSafe(targetSelection);
  const installedTargetContractModule = require(path.join(confirmedPlan.targetAppPath, "uiEditor/targetContract.js"));
  assert.equal(typeof installedTargetContractModule.validateTargetContract, "function");
  assert.equal(typeof installedTargetContractModule.validateTargetSurfaceContracts, "function");
  assert.equal(installedTargetContractModule.DEFAULT_TARGET_ATTRIBUTE_NAME, "data-ui-editor-id");
  assert.equal(installedTargetContractModule.ERROR_CODES.DOM_TARGET_MISSING, "DOM_TARGET_MISSING");
  assert.equal(installedTargetContractModule.ERROR_CODES.SURFACE_CONTRACT_FAILED, "SURFACE_CONTRACT_FAILED");
  assertTargetContractIsEsmImportSafe(targetContract);
  assert.equal(launcherButton.includes("createUiEditorLauncherButton"), true);
  assert.equal(launcherButton.includes("uiEditor.launcherButton"), true);
  assert.equal(launcherButton.includes('name: "UI-Editor Launcher"'), true);
  assert.equal(launcherButton.includes('role: "editor-launcher"'), true);
  assert.equal(launcherButton.includes('parentId: "uiEditor.root"'), true);
  assert.equal(launcherButton.includes("order: 10"), true);
  assert.equal(launcherButton.includes("visible: true"), true);
  assert.equal(launcherButton.includes('area: "overlay"'), true);
  assert.equal(launcherButton.includes('allowedOps: Object.freeze(["inspect", "move", "hide", "show"])'), true);
  assert.equal(
    launcherButton.includes('lockedOps: Object.freeze(["rename", "delete", "executeTargetAction", "modifyDomainData"])'),
    true
  );
  assert.equal(launcherButton.includes("position: Object.freeze({ x: 24, y: 24 })"), true);
  assert.equal(launcherButton.includes("uiEditorLauncherButton: createUiEditorLauncherButton()"), true);
  assert.equal(launcherButton.includes('if (typeof module === "object"'), true);
  assert.equal(launcherButton.includes("globalThis"), true);
  assert.equal(launcherButton.includes("\nmodule.exports = {\n"), false);
  const installedLauncherButtonModule = require(path.join(confirmedPlan.targetAppPath, "uiEditor/uiEditorLauncherButton.js"));
  assert.equal(installedLauncherButtonModule.uiEditorLauncherButton.id, "uiEditor.launcherButton");
  assert.equal(installedLauncherButtonModule.uiEditorLauncherButton.area, "overlay");
  assertLauncherButtonIsEsmImportSafe(launcherButton);
  assert.equal(launcherButtonCss.includes(".ui-editor-launcher-button"), true);
  assert.equal(launcherButtonCss.includes("position: fixed"), true);
  assert.equal(launcherButtonCss.includes("inset-inline-end: 24px"), true);
  assert.equal(launcherButtonCss.includes("ui-editor-launcher-status"), true);
  assert.equal(launcherButtonCss.includes("ui-editor-launcher-status__header"), true);
  assert.equal(launcherButtonCss.includes("ui-editor-launcher-status__content"), true);
  assert.equal(launcherButtonCss.includes("ui-editor-launcher-status-reopen"), true);
  assert.equal(launcherButtonCss.includes("pointer-events: auto"), true);
  assert.equal(launcherButtonCss.includes("resize: both"), true);
  assert.equal(launcherButtonCss.includes('data-ui-editor-panel-collapsed="true"'), true);
  assert.equal(launcherButtonCss.includes('data-ui-editor-panel-hidden="true"'), true);
  assert.equal(launcherButtonCss.includes("white-space: pre-line"), true);
  assert.equal(launcherButtonCss.includes("max-inline-size: 360px"), true);
  assert.equal(launcherButtonCss.includes('[data-ui-editor-launcher-active="true"]'), true);
  assert.equal(getCssNumber(launcherButtonCss, "z-index") > 12010, true);
  assert.equal(launcherButtonCss.includes("left: 24px"), false);
  assert.equal(launcherButtonCss.includes("inset-block-start: 24px"), true);
  assert.equal(launcherButtonCss.includes("inline-size: auto"), true);
  assert.equal(launcherButtonCss.includes("width: auto"), true);
  assert.equal(launcherButtonCss.includes("min-inline-size: 44px"), true);
  assert.equal(launcherButtonCss.includes("min-block-size: 44px"), true);
  assert.equal(
    launcherButtonCss.includes("left: 24px") && launcherButtonCss.includes("inset-inline-end: 24px"),
    false
  );
  assert.equal(rules.includes("Ziel-App-Regelpaket-Bootstrap"), true);
  assert.equal(rules.includes("Kein UI-Scan."), true);
  assert.equal(rules.includes("Keine bestehende UI analysieren."), true);
  assert.equal(rules.includes("Keine bestehende UI scannen."), true);
  assert.equal(rules.includes("Keine automatische Bestandserkennung."), true);
  assert.equal(rules.includes("Keine automatische Elementerkennung."), true);
  assert.equal(rules.includes("Keine automatische UI-Elementliste erzeugen."), true);
  assert.equal(rules.includes("Keine automatische Migration."), true);
  assert.equal(rules.includes("Keine bestehende UI migrieren."), true);
  assert.equal(rules.includes("Keine automatische Freigabe."), true);
  assert.equal(rules.includes("explizit registrieren"), true);
  assert.equal(rules.includes("Keine fachlichen Aktionen."), true);
  assert.equal(rules.includes("Fachlogik und Fachdaten bleiben in der Ziel-App."), true);
  assert.equal(contractTest.includes("uiEditorRegistry contract"), true);
  assert.equal(contractTest.includes('assert.deepEqual(uiEditorRegistry.uiScopes[0].elements[0].lockedOps, [])'), true);
  assert.equal(contractTest.includes('assert.equal(uiEditorRegistry.uiScopes[0].elements[1].role, "editor-launcher")'), true);
  assert.equal(installationTest.includes("uiEditorInstallation"), true);
  [
    ["write", "FileSync"].join(""),
    ["mk", "dirSync"].join(""),
    ["rm", "Sync"].join(""),
    ["un", "linkSync"].join(""),
    "querySelector",
    "document.",
    "window.",
    ["D", "OMParser"].join(""),
    "createElement",
    "innerHTML",
  ].forEach((fragment) => {
    assert.equal(installationTest.includes(fragment), false, `Installationstest enthaelt verbotenes Fragment: ${fragment}`);
  });
  assert.equal(installationStatus.includes("UI-Editor-Regelpaket installiert."), true);
  assert.equal(installationStatus.includes("Nur Regelpaket und Pruefinfrastruktur installiert."), true);
  assert.equal(installationStatus.includes("Keine bestehende UI analysiert."), true);
  assert.equal(installationStatus.includes("Keine bestehende UI gescannt."), true);
  assert.equal(installationStatus.includes("Keine automatische UI-Elementliste erzeugt."), true);
  assert.equal(installationStatus.includes("Keine bestehende UI migriert."), true);
  assert.equal(installationStatus.includes("Keine Ziel-App-UI geaendert."), true);
  assert.equal(installationStatus.includes("Keine Elemente automatisch erkannt."), true);
  assert.equal(installationStatus.includes("Keine Elemente automatisch registriert."), true);
  assert.equal(installationStatus.includes("Keine fachlichen Aktionen ausgefuehrt."), true);
  assert.equal(installationStatus.includes("Vertragscheck vorhanden."), true);
  assert.equal(installationStatus.includes("Entwurfsentscheidungspflicht aktiv."), true);
  assert.equal(installationStatus.includes("Fachlogik und Fachdaten bleiben in der Ziel-App."), true);
  assert.equal(agentsFile.includes("# AGENTS"), true);
  assert.equal(agentsFile.includes("Diese Datei aktiviert die UI-Editor-Regeln"), true);
  assert.equal(agentsFile.includes("<!-- UI-EDITOR-KIT:START -->"), true);
  assert.equal(agentsFile.includes("<!-- UI-EDITOR-KIT:END -->"), true);
  assert.equal(agentsFile.includes(readRepo("codex/AGENTS_UI_EDITOR_BLOCK.md").trim()), true);

  const installedTestResult = runInstalledInstallationTest(confirmedPlan.targetAppPath);
  assert.equal(installedTestResult.status, 0, installedTestResult.stderr || installedTestResult.stdout);
  assert.equal(installedTestResult.stdout.includes("TESTS OK: uiEditorInstallation"), true);

  const missingFilePlan = createValidPlan();
  const missingFileInstallResult = executeTargetAppInstallerPlan(createConfirmedInputs(missingFilePlan));
  assert.equal(missingFileInstallResult.ok, true);
  fs.rmSync(path.join(missingFilePlan.targetAppPath, "docs/ui-editor/EDITOR_BAUPLAN.md"), { force: true });
  const missingFileTestResult = runInstalledInstallationTest(missingFilePlan.targetAppPath);
  assert.notEqual(missingFileTestResult.status, 0);

  const missingMarkerPlan = createValidPlan();
  const missingMarkerInstallResult = executeTargetAppInstallerPlan(createConfirmedInputs(missingMarkerPlan));
  assert.equal(missingMarkerInstallResult.ok, true);
  fs.writeFileSync(path.join(missingMarkerPlan.targetAppPath, "AGENTS.md"), "# AGENTS\n\nOhne UI-Editor-Marker\n", "utf8");
  const missingMarkerTestResult = runInstalledInstallationTest(missingMarkerPlan.targetAppPath);
  assert.notEqual(missingMarkerTestResult.status, 0);

  const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ui-editor-installer-outside-"));
  const outsidePlan = createValidPlan({ targetAppPath: path.join(outsideRoot, "target-app") });
  outsidePlan.installableFiles = outsidePlan.installableFiles.concat([path.join(outsideRoot, "outside.js")]);
  const outsideResult = executeTargetAppInstallerPlan(createConfirmedInputs(outsidePlan));
  assert.equal(outsideResult.ok, false);
  assert.equal(outsideResult.errors.some((error) => error.code === "absolute_installable_file_path"), true);
  assertNoFiles(outsidePlan.targetAppPath, "Absolute Ziel-Dateipfade duerfen keine Teilinstallation ausloesen.");
  assert.equal(fs.existsSync(path.join(outsideRoot, "outside.js")), false);

  const traversalPlan = createValidPlan();
  traversalPlan.installableFiles = traversalPlan.installableFiles.concat(["../outside.js"]);
  const traversalResult = executeTargetAppInstallerPlan(createConfirmedInputs(traversalPlan));
  assert.equal(traversalResult.ok, false);
  assert.equal(traversalResult.errors.some((error) => error.code === "traversal_installable_file_path"), true);
  assertNoFiles(traversalPlan.targetAppPath, ".. in Pfaden darf keine Teilinstallation ausloesen.");

  const existingPlan = createValidPlan();
  fs.mkdirSync(path.join(existingPlan.targetAppPath, "docs/ui-editor"), { recursive: true });
  fs.writeFileSync(path.join(existingPlan.targetAppPath, "docs/ui-editor/EDITOR_BAUPLAN.md"), "existing", "utf8");
  const existingResult = executeTargetAppInstallerPlan(createConfirmedInputs(existingPlan));
  assert.equal(existingResult.ok, false);
  assert.equal(existingResult.errors.some((error) => error.code === "target_file_already_exists"), true);
  assert.equal(
    existingResult.report.preflight.existingManagedFiles.includes("docs/ui-editor/EDITOR_BAUPLAN.md"),
    true
  );
  assert.equal(fs.readFileSync(path.join(existingPlan.targetAppPath, "docs/ui-editor/EDITOR_BAUPLAN.md"), "utf8"), "existing");
  assert.deepEqual(listFiles(existingPlan.targetAppPath), ["docs/ui-editor/EDITOR_BAUPLAN.md"]);

  const overwritePlan = { ...existingPlan, overwrite: true };
  const overwriteResult = executeTargetAppInstallerPlan(createConfirmedInputs(overwritePlan));
  assert.equal(overwriteResult.ok, true);
  assertWrittenFilesAreAllowed(overwritePlan.targetAppPath);
  assert.notEqual(
    fs.readFileSync(path.join(overwritePlan.targetAppPath, "docs/ui-editor/EDITOR_BAUPLAN.md"), "utf8"),
    "existing"
  );

  const appendAgentsPlan = createValidPlan();
  fs.mkdirSync(appendAgentsPlan.targetAppPath, { recursive: true });
  fs.writeFileSync(path.join(appendAgentsPlan.targetAppPath, "AGENTS.md"), "Bestehende Regel\n", "utf8");
  const appendAgentsResult = executeTargetAppInstallerPlan(createConfirmedInputs(appendAgentsPlan));
  assert.equal(appendAgentsResult.ok, true);
  assert.equal(appendAgentsResult.report.preflight.agentsStatus, "exists-will-append");
  assert.equal(appendAgentsResult.writtenFiles.includes("AGENTS.md"), true);
  const appendedAgents = readInstalled(appendAgentsPlan.targetAppPath, "AGENTS.md");
  assert.equal(appendedAgents.startsWith("Bestehende Regel\n"), true);
  assert.equal(appendedAgents.includes("<!-- UI-EDITOR-KIT:START -->"), true);
  assert.equal(appendedAgents.includes("<!-- UI-EDITOR-KIT:END -->"), true);

  const existingAgentsBlockPlan = createValidPlan();
  fs.mkdirSync(existingAgentsBlockPlan.targetAppPath, { recursive: true });
  fs.writeFileSync(
    path.join(existingAgentsBlockPlan.targetAppPath, "AGENTS.md"),
    "# AGENTS\n\n<!-- UI-EDITOR-KIT:START -->\nBereits da\n<!-- UI-EDITOR-KIT:END -->\n",
    "utf8"
  );
  const existingAgentsBlockResult = executeTargetAppInstallerPlan(createConfirmedInputs(existingAgentsBlockPlan));
  assert.equal(existingAgentsBlockResult.ok, true);
  assert.equal(existingAgentsBlockResult.report.preflight.agentsStatus, "exists-ui-editor-block-present");
  assert.equal(existingAgentsBlockResult.writtenFiles.includes("AGENTS.md"), false);
  const existingAgentsContent = readInstalled(existingAgentsBlockPlan.targetAppPath, "AGENTS.md");
  assert.equal(existingAgentsContent.match(/<!-- UI-EDITOR-KIT:START -->/gu).length, 1);
  assert.equal(existingAgentsContent.match(/<!-- UI-EDITOR-KIT:END -->/gu).length, 1);

  const moduleSource = fs.readFileSync(EXECUTION_MODULE_PATH, "utf8");
  assertNoForbiddenFragments(moduleSource, "target-app-installer-execution.cjs");
  assertNoForbiddenFragments(fs.readFileSync(ARTIFACTS_MODULE_PATH, "utf8"), "target-app-installer-artifacts.cjs");
  [
    readme,
    registry,
    targetAppRegistry,
    targetSelection,
    targetContract,
    launcherButton,
    launcherButtonCss,
    rules,
    contractTest,
    installationTest,
    installationStatus,
    agentsFile,
  ].forEach(
    (content, index) => {
      const contentForGuard = content === targetSelection || content === targetContract
        ? content.replace(/querySelector/gu, "directTargetLookup").replace(/DOM/gu, "targetTree")
        : content;
      assertNoForbiddenFragments(contentForGuard, `installierte Datei ${index}`);
    }
  );
  assert.equal(registry.includes("kunde"), false);
  assert.equal(registry.includes("auftrag"), false);
  assert.equal(registry.includes("produkt"), false);
  [registry, targetAppRegistry, targetSelection, targetContract, launcherButton, launcherButtonCss, installationStatus, agentsFile].forEach(
    (content, index) => {
      const forbiddenLookupFragment = content === targetSelection || content === targetContract ? "querySelectorAll" : "querySelector";
      assert.equal(
        content.includes(forbiddenLookupFragment),
        false,
        `Installer-Artefakt ${index} darf keinen UI-Scan enthalten.`
      );
      assert.equal(
        content.includes("detectElements"),
        false,
        `Installer-Artefakt ${index} darf keine automatische UI-Erkennung enthalten.`
      );
      assert.equal(
        content.includes("autoRegister"),
        false,
        `Installer-Artefakt ${index} darf keine automatische Registry-Befuellung enthalten.`
      );
      assert.equal(content.includes("writeFile"), false, `Installer-Artefakt ${index} darf keine Speicherung enthalten.`);
      assert.equal(content.includes("kunde"), false, `Installer-Artefakt ${index} darf keine Fachdaten enthalten.`);
      assert.equal(content.includes("auftrag"), false, `Installer-Artefakt ${index} darf keine Fachdaten enthalten.`);
      assert.equal(content.includes("produkt"), false, `Installer-Artefakt ${index} darf keine Fachdaten enthalten.`);
    }
  );

  console.log("TESTS OK: target-app-installer-execution");
}

run();
