#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const {
  createTargetAppInstallerUninstallPreview,
  uninstallTargetAppInstallerArtifacts,
} = require(path.join(REPO_ROOT, "src/core/target-app-installer-uninstall.cjs"));
const { getTargetAppInstallerManagedFiles } = require(path.join(REPO_ROOT, "src/core/target-app-installer-artifacts.cjs"));

function write(targetRoot, relativePath, content = relativePath) {
  const absolute = path.join(targetRoot, relativePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, content, "utf8");
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ui-editor-installer-uninstall-"));
const targetAppPath = path.join(tempRoot, "target-app");
for (const relativePath of getTargetAppInstallerManagedFiles()) write(targetAppPath, relativePath);
write(targetAppPath, "AGENTS.md", "vorher\n<!-- UI-EDITOR-KIT:START -->\nblock\n<!-- UI-EDITOR-KIT:END -->\nnachher\n");
write(targetAppPath, "src/target-app-source.js", "module.exports = true;\n");

const confirmation = {
  uninstallConfirmed: true,
  targetAppSelected: true,
  installPathConfirmed: true,
  removeUiEditorArtifactsOnly: true,
  keepTargetAppSource: true,
};
const preview = createTargetAppInstallerUninstallPreview({ targetAppPath, confirmation: {} });
assert.equal(preview.ok, true);
assert.equal(preview.preview.willRemoveFiles, false);

const result = uninstallTargetAppInstallerArtifacts({ targetAppPath, confirmation });
assert.equal(result.ok, true);
for (const relativePath of getTargetAppInstallerManagedFiles()) {
  assert.equal(fs.existsSync(path.join(targetAppPath, relativePath)), false, `nicht entfernt: ${relativePath}`);
}
assert.equal(fs.existsSync(path.join(targetAppPath, "src/target-app-source.js")), true);
const agents = fs.readFileSync(path.join(targetAppPath, "AGENTS.md"), "utf8");
assert.equal(agents.includes("UI-EDITOR-KIT:START"), false);
assert.equal(agents.includes("vorher"), true);
assert.equal(agents.includes("nachher"), true);

fs.rmSync(tempRoot, { recursive: true, force: true });
console.log("TESTS OK: target-app-installer-uninstall");
