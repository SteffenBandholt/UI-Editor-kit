#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const PLAN_MODULE_PATH = path.join(REPO_ROOT, "src/core/target-app-installer-plan.cjs");
const EXECUTION_MODULE_PATH = path.join(REPO_ROOT, "src/core/target-app-installer-execution.cjs");

const { createTargetAppInstallerPlan } = require(PLAN_MODULE_PATH);
const {
  getTargetAppInstallerExecutionRequiredInputs,
  createTargetAppInstallerExecutionPreview,
  executeTargetAppInstallerPlan,
} = require(EXECUTION_MODULE_PATH);

const ALLOWED_FILES = Object.freeze([
  "uiEditor/README.md",
  "uiEditor/uiEditorRegistry.js",
  "uiEditor/uiEditorLauncherButton.js",
  "uiEditor/uiEditorLauncherButton.css",
  "uiEditor/uiEditorRules.md",
  "uiEditor/tests/uiEditorRegistry.test.cjs",
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
  return createTargetAppInstallerPlan({
    targetAppPath,
    targetAppId: "neutral-target-app",
    targetAppName: "Neutral Target App",
    selectedMode: "prepare-registry-structure",
    ...(overrides || {}),
  });
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

function assertNoFiles(root, message) {
  assert.deepEqual(listFiles(root), [], message);
}

function assertNoForbiddenFragments(text, label) {
  const forbiddenFragments = [
    ["B", "BM"].join(""),
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

function assertWrittenFilesAreAllowed(targetAppPath) {
  assert.deepEqual(listFiles(targetAppPath), ALLOWED_FILES.slice().sort());
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
  assert.equal(previewResult.preview.requiresConfirmation.includes("registry-structure-only"), true);
  assert.equal(previewResult.preview.willWriteFiles, false);
  assert.equal(previewResult.preview.willScanUi, false);
  assert.equal(previewResult.preview.willModifyTargetUi, false);
  assert.equal(previewResult.preview.willRegisterElements, false);
  assertNoFiles(previewPlan.targetAppPath, "Preview darf keine Dateien schreiben.");

  const unconfirmedPlan = createValidPlan();
  const unconfirmedResult = executeTargetAppInstallerPlan({
    installerPlan: unconfirmedPlan,
    confirmation: { installationConfirmed: true },
  });
  assert.equal(unconfirmedResult.ok, false);
  assert.equal(unconfirmedResult.errors.some((error) => error.code === "missing_execution_confirmation_flag"), true);
  assertNoFiles(unconfirmedPlan.targetAppPath, "Ohne vollstaendige Bestaetigung darf nichts geschrieben werden.");

  const confirmedPlan = createValidPlan();
  const confirmedResult = executeTargetAppInstallerPlan(createConfirmedInputs(confirmedPlan));
  assert.equal(confirmedResult.ok, true);
  assert.deepEqual(confirmedResult.writtenFiles.slice().sort(), ALLOWED_FILES.slice().sort());
  assertWrittenFilesAreAllowed(confirmedPlan.targetAppPath);

  const installedRegistryModule = require(path.join(confirmedPlan.targetAppPath, "uiEditor/uiEditorRegistry.js"));
  const installedLauncherElement = installedRegistryModule.uiEditorRegistry.uiScopes[0].elements[0];
  assert.equal(installedLauncherElement.id, "uiEditor.launcherButton");
  assert.equal(installedLauncherElement.type, "button");
  assert.equal(installedLauncherElement.role, "editor-launcher");
  assert.equal(installedLauncherElement.area, "overlay");
  assert.deepEqual(installedLauncherElement.position, { x: 24, y: 24 });
  assert.equal(installedLauncherElement.editable, true);
  assert.deepEqual(installedLauncherElement.allowedOps, ["move", "hide", "show"]);
  assert.equal(installedLauncherElement.lockedOps.includes("delete"), true);
  assert.equal(installedLauncherElement.lockedOps.includes("executeTargetAction"), true);

  const readme = fs.readFileSync(path.join(confirmedPlan.targetAppPath, "uiEditor/README.md"), "utf8");
  const registry = fs.readFileSync(path.join(confirmedPlan.targetAppPath, "uiEditor/uiEditorRegistry.js"), "utf8");
  const launcherButton = fs.readFileSync(path.join(confirmedPlan.targetAppPath, "uiEditor/uiEditorLauncherButton.js"), "utf8");
  const launcherButtonCss = fs.readFileSync(path.join(confirmedPlan.targetAppPath, "uiEditor/uiEditorLauncherButton.css"), "utf8");
  const rules = fs.readFileSync(path.join(confirmedPlan.targetAppPath, "uiEditor/uiEditorRules.md"), "utf8");
  const contractTest = fs.readFileSync(
    path.join(confirmedPlan.targetAppPath, "uiEditor/tests/uiEditorRegistry.test.cjs"),
    "utf8"
  );
  assert.equal(readme.includes("Registry-Struktur"), true);
  assert.equal(registry.includes("uiEditor.global"), true);
  assert.equal(registry.includes("uiEditor.launcherButton"), true);
  assert.equal(registry.includes('type: "button"'), true);
  assert.equal(registry.includes('role: "editor-launcher"'), true);
  assert.equal(registry.includes('area: "overlay"'), true);
  assert.equal(registry.includes("position: Object.freeze({ x: 24, y: 24 })"), true);
  assert.equal(registry.includes("editable: true"), true);
  assert.equal(registry.includes('allowedOps: Object.freeze(["move", "hide", "show"])'), true);
  assert.equal(registry.includes('lockedOps: Object.freeze(["delete", "executeTargetAction", "modifyDomainData"])'), true);
  assert.equal(launcherButton.includes("createUiEditorLauncherButton"), true);
  assert.equal(launcherButton.includes("uiEditor.launcherButton"), true);
  assert.equal(launcherButton.includes("position: Object.freeze({ x: 24, y: 24 })"), true);
  assert.equal(launcherButtonCss.includes(".ui-editor-launcher-button"), true);
  assert.equal(launcherButtonCss.includes("left: 24px"), true);
  assert.equal(launcherButtonCss.includes("top: 24px"), true);
  assert.equal(rules.includes("Kein Scan."), true);
  assert.equal(rules.includes("Keine automatische Elementerkennung."), true);
  assert.equal(rules.includes("Keine automatische Freigabe."), true);
  assert.equal(rules.includes("explizit registrieren"), true);
  assert.equal(rules.includes("Fachlogik und Fachdaten bleiben in der Ziel-App."), true);
  assert.equal(contractTest.includes("uiEditorRegistry contract"), true);

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
  fs.mkdirSync(path.join(existingPlan.targetAppPath, "uiEditor"), { recursive: true });
  fs.writeFileSync(path.join(existingPlan.targetAppPath, "uiEditor/README.md"), "existing", "utf8");
  const existingResult = executeTargetAppInstallerPlan(createConfirmedInputs(existingPlan));
  assert.equal(existingResult.ok, false);
  assert.equal(existingResult.errors.some((error) => error.code === "target_file_already_exists"), true);
  assert.equal(fs.readFileSync(path.join(existingPlan.targetAppPath, "uiEditor/README.md"), "utf8"), "existing");
  assert.deepEqual(listFiles(existingPlan.targetAppPath), ["uiEditor/README.md"]);

  const overwritePlan = { ...existingPlan, overwrite: true };
  const overwriteResult = executeTargetAppInstallerPlan(createConfirmedInputs(overwritePlan));
  assert.equal(overwriteResult.ok, true);
  assertWrittenFilesAreAllowed(overwritePlan.targetAppPath);
  assert.notEqual(fs.readFileSync(path.join(overwritePlan.targetAppPath, "uiEditor/README.md"), "utf8"), "existing");

  const moduleSource = fs.readFileSync(EXECUTION_MODULE_PATH, "utf8");
  assertNoForbiddenFragments(moduleSource, "target-app-installer-execution.cjs");
  [readme, registry, launcherButton, launcherButtonCss, rules, contractTest].forEach((content, index) => {
    assertNoForbiddenFragments(content, `installierte Datei ${index}`);
  });
  assert.equal(registry.includes("kunde"), false);
  assert.equal(registry.includes("auftrag"), false);
  assert.equal(registry.includes("produkt"), false);
  [registry, launcherButton, launcherButtonCss].forEach((content, index) => {
    assert.equal(content.includes("querySelector"), false, `Launcher-Artefakt ${index} darf keinen UI-Scan enthalten.`);
    assert.equal(content.includes("detectElements"), false, `Launcher-Artefakt ${index} darf keine automatische UI-Erkennung enthalten.`);
    assert.equal(content.includes("autoRegister"), false, `Launcher-Artefakt ${index} darf keine automatische Registry-Befuellung enthalten.`);
    assert.equal(content.includes("writeFile"), false, `Launcher-Artefakt ${index} darf keine Speicherung enthalten.`);
    assert.equal(content.includes("kunde"), false, `Launcher-Artefakt ${index} darf keine Fachdaten enthalten.`);
    assert.equal(content.includes("auftrag"), false, `Launcher-Artefakt ${index} darf keine Fachdaten enthalten.`);
    assert.equal(content.includes("produkt"), false, `Launcher-Artefakt ${index} darf keine Fachdaten enthalten.`);
  });

  console.log("TESTS OK: target-app-installer-execution");
}

run();
