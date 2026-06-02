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
  "uiEditor/uiEditorRules.md",
  "uiEditor/uiEditorLauncherButton.js",
  "uiEditor/uiEditorLauncherButton.css",
  "uiEditor/tests/uiEditorRegistry.test.cjs",
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
  assert.deepEqual(previewResult.preview.directoriesToRemoveIfEmpty, ["uiEditor/tests", "uiEditor"]);
  assert.equal(previewResult.preview.willRemoveFiles, false);
  assert.equal(previewResult.preview.willRemoveSourceFiles, false);
  assert.equal(previewResult.preview.willRemoveUnknownFiles, false);
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
  writeFile(uninstallTarget, "src/app.js", "source stays");
  const uninstallResult = uninstallTargetAppInstallerArtifacts(createConfirmedInputs(uninstallTarget));
  assert.equal(uninstallResult.ok, true);
  assert.deepEqual(uninstallResult.errors, []);
  assert.deepEqual(uninstallResult.removedFiles.slice().sort(), KNOWN_ARTIFACTS.slice().sort());
  assert.equal(uninstallResult.removedDirectories.includes("uiEditor/tests"), true);
  assert.equal(uninstallResult.removedDirectories.includes("uiEditor"), true);
  assert.equal(exists(uninstallTarget, "uiEditor"), false, "Leere uiEditor-Ordner muessen entfernt werden.");
  assert.equal(exists(uninstallTarget, "src/app.js"), true, "Dateien ausserhalb uiEditor/ bleiben unangetastet.");
  assert.deepEqual(listFiles(uninstallTarget), ["src/app.js"]);

  const partialTarget = createTempTargetApp();
  writeFile(partialTarget, "uiEditor/README.md", "known");
  writeFile(partialTarget, "uiEditor/uiEditorRules.md", "known");
  const partialResult = uninstallTargetAppInstallerArtifacts(createConfirmedInputs(partialTarget));
  assert.equal(partialResult.ok, true);
  assert.deepEqual(partialResult.removedFiles.slice().sort(), ["uiEditor/README.md", "uiEditor/uiEditorRules.md"]);
  assert.equal(exists(partialTarget, "uiEditor"), false);

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

  assertNoForbiddenFragments(read("src/core/target-app-installer-uninstall.cjs"), "Uninstall-Core");

  console.log("TESTS OK: target-app-installer-uninstall");
}

run();
