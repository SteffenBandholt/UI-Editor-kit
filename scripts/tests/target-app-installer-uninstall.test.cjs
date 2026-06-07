#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const UNINSTALL_MODULE_PATH = path.join(REPO_ROOT, "src/core/target-app-installer-uninstall.cjs");

const {
  getTargetAppInstallerUninstallRequiredInputs,
  createTargetAppInstallerUninstallPreview,
  uninstallTargetAppInstallerArtifacts,
  validateTargetAppInstallerUninstallRequest,
} = require(UNINSTALL_MODULE_PATH);

const KNOWN_ARTIFACTS = Object.freeze([
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

function createTempTargetApp() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ui-editor-installer-uninstall-"));
  return path.join(tempRoot, "target-app");
}

function writeFile(targetAppPath, relativePath, content) {
  const absolutePath = path.join(targetAppPath, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content || relativePath, "utf8");
}

function writeKnownArtifacts(targetAppPath) {
  KNOWN_ARTIFACTS.forEach((relativePath) => writeFile(targetAppPath, relativePath));
}

function createConfirmedInputs(targetAppPath, confirmationOverrides) {
  return {
    targetAppPath,
    confirmation: {
      uninstallConfirmed: true,
      targetAppSelected: true,
      installPathConfirmed: true,
      removeUiEditorArtifactsOnly: true,
      keepTargetAppSource: true,
      ...(confirmationOverrides || {}),
    },
  };
}

function exists(targetAppPath, relativePath) {
  return fs.existsSync(path.join(targetAppPath, relativePath));
}

function listFiles(rootPath) {
  if (!fs.existsSync(rootPath)) {
    return [];
  }

  const files = [];
  const pending = [rootPath];

  while (pending.length > 0) {
    const currentPath = pending.pop();
    fs.readdirSync(currentPath, { withFileTypes: true }).forEach((entry) => {
      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        pending.push(entryPath);
        return;
      }
      files.push(path.relative(rootPath, entryPath).split(path.sep).join("/"));
    });
  }

  return files.sort();
}

function read(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

function readInstalled(targetAppPath, relativePath) {
  return fs.readFileSync(path.join(targetAppPath, relativePath), "utf8");
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
    "elementDetection",
    "scanTarget",
    "autoDetect",
    "businessLogic",
    "domainLogic",
  ];

  forbiddenFragments.forEach((fragment) => {
    assert.equal(text.includes(fragment), false, `${label} enthaelt verbotenen Fragmenttext: ${fragment}`);
  });
}

function assertUninstallReport(report, targetAppPath, removedFiles, updatedFiles) {
  assert.equal(report.reportVersion, "1.0.0");
  assert.equal(report.phase, "uninstall");
  assert.equal(report.targetAppPath, targetAppPath);
  assert.deepEqual(report.removedManagedFiles.slice().sort(), removedFiles.slice().sort());
  assert.deepEqual(report.updatedFiles.slice().sort(), updatedFiles.slice().sort());
  assert.equal(report.agentsHandling.path, "AGENTS.md");
  assert.equal(report.agentsHandling.deletesAgentsFile, false);
  assert.equal(report.agentsHandling.removesMarkedBlockOnly, true);
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
}

function run() {
  assert.equal(typeof getTargetAppInstallerUninstallRequiredInputs, "function");
  assert.equal(typeof createTargetAppInstallerUninstallPreview, "function");
  assert.equal(typeof uninstallTargetAppInstallerArtifacts, "function");
  assert.equal(typeof validateTargetAppInstallerUninstallRequest, "function");
  assert.deepEqual(getTargetAppInstallerUninstallRequiredInputs(), ["targetAppPath", "confirmation"]);

  const previewTarget = createTempTargetApp();
  writeKnownArtifacts(previewTarget);
  writeFile(previewTarget, "src/keep.js", "keep");
  const filesBeforePreview = listFiles(previewTarget);
  const previewResult = createTargetAppInstallerUninstallPreview({ targetAppPath: previewTarget, confirmation: {} });
  assert.equal(previewResult.ok, true);
  assert.deepEqual(previewResult.errors, []);
  assert.equal(previewResult.preview.targetAppPath, previewTarget);
  assert.deepEqual(previewResult.preview.filesToRemove, KNOWN_ARTIFACTS);
  assert.deepEqual(previewResult.preview.filesToUpdate, ["AGENTS.md"]);
  assert.deepEqual(previewResult.preview.directoriesToRemoveIfEmpty, ["uiEditor/tests", "uiEditor", "docs/ui-editor"]);
  assert.equal(previewResult.preview.willRemoveFiles, false);
  assert.equal(previewResult.preview.willRemoveSourceFiles, false);
  assert.equal(previewResult.preview.willRemoveUnknownFiles, false);
  assertUninstallReport(previewResult.preview.report, previewTarget, [], []);
  assert.deepEqual(listFiles(previewTarget), filesBeforePreview, "Preview darf nichts loeschen oder schreiben.");

  const unconfirmedTarget = createTempTargetApp();
  writeKnownArtifacts(unconfirmedTarget);
  const unconfirmedResult = uninstallTargetAppInstallerArtifacts({
    targetAppPath: unconfirmedTarget,
    confirmation: { uninstallConfirmed: true },
  });
  assert.equal(unconfirmedResult.ok, false);
  assert.equal(unconfirmedResult.errors.some((error) => error.code === "missing_uninstall_confirmation_flag"), true);
  assert.deepEqual(unconfirmedResult.removedFiles, []);
  assert.deepEqual(listFiles(unconfirmedTarget), KNOWN_ARTIFACTS.slice().sort());

  const uninstallTarget = createTempTargetApp();
  writeKnownArtifacts(uninstallTarget);
  writeFile(
    uninstallTarget,
    "AGENTS.md",
    "# AGENTS\n\nLokale Regel bleibt.\n\n<!-- UI-EDITOR-KIT:START -->\nBlock\n<!-- UI-EDITOR-KIT:END -->\n",
    "utf8"
  );
  writeFile(uninstallTarget, "src/app.js", "source stays");
  const uninstallResult = uninstallTargetAppInstallerArtifacts(createConfirmedInputs(uninstallTarget));
  assert.equal(uninstallResult.ok, true);
  assert.deepEqual(uninstallResult.errors, []);
  assert.deepEqual(uninstallResult.removedFiles.slice().sort(), KNOWN_ARTIFACTS.slice().sort());
  assert.equal(uninstallResult.removedDirectories.includes("uiEditor/tests"), true);
  assert.equal(uninstallResult.removedDirectories.includes("uiEditor"), true);
  assert.equal(uninstallResult.removedDirectories.includes("docs/ui-editor"), true);
  assert.deepEqual(uninstallResult.updatedFiles, ["AGENTS.md"]);
  assertUninstallReport(uninstallResult.report, uninstallTarget, KNOWN_ARTIFACTS, ["AGENTS.md"]);
  assert.equal(exists(uninstallTarget, "uiEditor"), false, "Leere uiEditor-Ordner muessen entfernt werden.");
  assert.equal(exists(uninstallTarget, "docs/ui-editor"), false, "Leere ui-editor-Dokuordner muessen entfernt werden.");
  assert.equal(exists(uninstallTarget, "src/app.js"), true, "Dateien ausserhalb der Installer-Artefakte bleiben unangetastet.");
  assert.equal(exists(uninstallTarget, "AGENTS.md"), true, "AGENTS.md darf nicht geloescht werden.");
  assert.equal(readInstalled(uninstallTarget, "AGENTS.md").includes("Lokale Regel bleibt."), true);
  assert.equal(readInstalled(uninstallTarget, "AGENTS.md").includes("<!-- UI-EDITOR-KIT:START -->"), false);
  assert.equal(readInstalled(uninstallTarget, "AGENTS.md").includes("<!-- UI-EDITOR-KIT:END -->"), false);
  assert.deepEqual(listFiles(uninstallTarget), ["AGENTS.md", "src/app.js"]);

  const partialTarget = createTempTargetApp();
  writeFile(partialTarget, "uiEditor/README.md", "known");
  writeFile(partialTarget, "uiEditor/uiEditorRules.md", "known");
  writeFile(partialTarget, "docs/ui-editor/UI_EDITOR_VERTRAG.md", "known");
  const partialResult = uninstallTargetAppInstallerArtifacts(createConfirmedInputs(partialTarget));
  assert.equal(partialResult.ok, true);
  assert.deepEqual(
    partialResult.removedFiles.slice().sort(),
    ["docs/ui-editor/UI_EDITOR_VERTRAG.md", "uiEditor/README.md", "uiEditor/uiEditorRules.md"]
  );
  assert.equal(exists(partialTarget, "uiEditor"), false);
  assert.equal(exists(partialTarget, "docs/ui-editor"), false);

  const unknownTarget = createTempTargetApp();
  writeKnownArtifacts(unknownTarget);
  writeFile(unknownTarget, "uiEditor/custom-note.md", "unknown");
  writeFile(unknownTarget, "src/app.js", "source stays");
  const unknownResult = uninstallTargetAppInstallerArtifacts(createConfirmedInputs(unknownTarget));
  assert.equal(unknownResult.ok, false);
  assert.equal(unknownResult.errors.some((error) => error.code === "unknown-ui-editor-files"), true);
  assert.deepEqual(unknownResult.removedFiles, []);
  assert.equal(exists(unknownTarget, "uiEditor/README.md"), true, "Unbekannte Dateien blockieren jede Teil-Deinstallation.");
  assert.equal(exists(unknownTarget, "uiEditor/custom-note.md"), true);
  assert.equal(exists(unknownTarget, "src/app.js"), true);

  const traversalTarget = createTempTargetApp();
  const traversalResult = uninstallTargetAppInstallerArtifacts(
    createConfirmedInputs(`${traversalTarget}/../other-target`)
  );
  assert.equal(traversalResult.ok, false);
  assert.equal(traversalResult.errors.some((error) => error.code === "path-traversal-rejected"), true);
  assert.deepEqual(traversalResult.removedFiles, []);

  const nestedUnknownTarget = createTempTargetApp();
  writeFile(nestedUnknownTarget, "uiEditor/tests/custom.test.cjs", "unknown");
  const nestedUnknownPreview = createTargetAppInstallerUninstallPreview({
    targetAppPath: nestedUnknownTarget,
    confirmation: {},
  });
  assert.equal(nestedUnknownPreview.ok, false);
  assert.equal(nestedUnknownPreview.errors.some((error) => error.code === "unknown-ui-editor-files"), true);
  assert.equal(exists(nestedUnknownTarget, "uiEditor/tests/custom.test.cjs"), true, "Keine rekursive Blindloeschung.");

  const agentsWithoutBlockTarget = createTempTargetApp();
  writeKnownArtifacts(agentsWithoutBlockTarget);
  writeFile(agentsWithoutBlockTarget, "AGENTS.md", "# AGENTS\n\nEigene Regeln\n");
  const agentsWithoutBlockResult = uninstallTargetAppInstallerArtifacts(createConfirmedInputs(agentsWithoutBlockTarget));
  assert.equal(agentsWithoutBlockResult.ok, true);
  assert.deepEqual(agentsWithoutBlockResult.updatedFiles, []);
  assertUninstallReport(agentsWithoutBlockResult.report, agentsWithoutBlockTarget, KNOWN_ARTIFACTS, []);
  assert.equal(readInstalled(agentsWithoutBlockTarget, "AGENTS.md"), "# AGENTS\n\nEigene Regeln\n");

  assertNoForbiddenFragments(read("src/core/target-app-installer-uninstall.cjs"), "Uninstall-Core");

  console.log("TESTS OK: target-app-installer-uninstall");
}

run();
