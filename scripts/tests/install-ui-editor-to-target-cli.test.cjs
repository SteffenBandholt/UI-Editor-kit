#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const CLI_PATH = path.join(REPO_ROOT, "scripts/install-ui-editor-to-target.cjs");
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

function runCli(args) {
  return childProcess.spawnSync(process.execPath, [CLI_PATH, ...(args || [])], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
}

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

const missing = runCli([]);
assert.equal(missing.status, 1);
assert.equal(`${missing.stdout}\n${missing.stderr}`.includes("Nutzung:"), true);

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ui-editor-cli-"));
const targetAppPath = path.join(tempRoot, "target-app");
fs.mkdirSync(targetAppPath, { recursive: true });
const installed = runCli([targetAppPath]);
assert.equal(installed.status, 0, installed.stderr || installed.stdout);
assert.deepEqual(listFiles(targetAppPath), EXPECTED_FILES);
const output = `${installed.stdout}\n${installed.stderr}`;
for (const fragment of [
  "Ziel-UI gelesen: nein",
  "DOM gescannt: nein",
  "Elemente automatisch erkannt: nein",
  "Elemente automatisch registriert: nein",
  "Ziel-App-UI geaendert: nein",
]) {
  assert.equal(output.includes(fragment), true, `CLI-Ausgabe enthaelt nicht: ${fragment}`);
}
assert.equal(EXPECTED_FILES.some((file) => /selection|contract\.js|launcher|\.css$/i.test(file)), false);

const installedTest = childProcess.spawnSync(process.execPath, ["uiEditor/tests/uiEditorInstallation.test.cjs"], {
  cwd: targetAppPath,
  encoding: "utf8",
});
assert.equal(installedTest.status, 0, installedTest.stderr || installedTest.stdout);

fs.rmSync(tempRoot, { recursive: true, force: true });
console.log("TESTS OK: install-ui-editor-to-target-cli");
