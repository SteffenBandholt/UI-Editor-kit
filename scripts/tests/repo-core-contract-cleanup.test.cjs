#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const REQUIRED_NOTICE = "DAS UI-EDITOR-KIT WIRD NIEMALS IM BROWSER STATTFINDEN.";

const MUST_EXIST = [
  "README.md",
  "STATUS.md",
  "docs/EDITOR_GESAMT_LV.md",
  "docs/EDITOR_BAUPLAN.md",
  "docs/UI_ELEMENT_KATALOG.md",
  "docs/UI_BAU_UND_PRUEFREGELN.md",
  "docs/ZIEL_APP_ANBINDUNG.md",
  "docs/UI_EDITOR_VERTRAG.md",
  "docs/UI_PDF_ENTWURFSENTSCHEIDUNG.md",
  "docs/M47_NEUE_ZIEL_APP_MINIMAL_ANBINDUNG.md",
  "docs/M72_EDITOR_PANEL_TEXT_EDITING.md",
  "codex/AGENTS_UI_EDITOR_BLOCK.md",
  "codex/CODEX_BOOTSTRAP_ZIEL_APP.md",
  "scripts/tests/product-platform-boundary.test.cjs",
  "scripts/tests/documentation-no-browser.test.cjs",
  "scripts/ui-editor-contract-check.cjs",
  "scripts/install-ui-editor-to-target.cjs",
  "src/index.cjs",
];

const MUST_NOT_EXIST = [
  "dist/selection-runtime.browser.mjs",
  "examples/browser-reference",
  "scripts/build/build-selection-runtime-browser-esm.cjs",
  "scripts/reference",
  "src/browser",
  "src/selection",
  "src/installer-app",
  "src/core/target-contract.cjs",
  "src/core/target-selection.cjs",
  "src/panel/ui-editor-panel-renderer.cjs",
  "styles/ui-editor-panel.css",
  "scripts/start-installer-app.cjs",
  "scripts/tests/target-contract.test.cjs",
  "scripts/tests/target-selection.test.cjs",
  "docs/M57_SELECTION_ARCHITEKTUR.md",
  "docs/M58_SELECTION_RUNTIME.md",
  "docs/SELECTION_TARGET_CONTRACT_V1.md",
  "docs/M58_1_BROWSER_ESM_ENTRY.md",
  "docs/M71_GENERIC_BROWSER_HOST.md",
  "docs/M72_BROWSER_REFERENCE_APP.md",
  "docs/M72_REFERENCE_APP_CHECKLIST.md",
];

const FORBIDDEN_PRODUCT_TERMS = ["Protokoll", "Bauvorhaben", "Restarbeiten", "BBM", "Pferdeverwaltung"];

function read(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

for (const relativePath of MUST_EXIST) {
  assert.equal(fs.existsSync(path.join(REPO_ROOT, relativePath)), true, `Datei fehlt: ${relativePath}`);
}
for (const relativePath of MUST_NOT_EXIST) {
  assert.equal(fs.existsSync(path.join(REPO_ROOT, relativePath)), false, `Pfad existiert noch: ${relativePath}`);
}

const packageJson = JSON.parse(read("package.json"));
assert.equal(packageJson.main, "src/index.cjs");
assert.deepEqual(packageJson.exports, { ".": { require: "./src/index.cjs" } });
assert.equal(typeof packageJson.scripts.test, "string");
assert.equal(
  packageJson.scripts.test.startsWith("node scripts/tests/product-platform-boundary.test.cjs && node scripts/tests/documentation-no-browser.test.cjs && "),
  true,
  "npm test muss mit Produkt- und Dokumentationsschutz beginnen",
);
assert.equal(Object.keys(packageJson.scripts).some((name) => /browser|reference|start/i.test(name)), false);

for (const file of ["README.md", "STATUS.md", "docs/EDITOR_GESAMT_LV.md", "docs/EDITOR_BAUPLAN.md", "codex/AGENTS_UI_EDITOR_BLOCK.md"]) {
  assert.equal(read(file).includes(REQUIRED_NOTICE), true, `${file} enthaelt den Pflicht-Hinweis nicht`);
}

const readme = read("README.md");
for (const fragment of ["eigenstaendige", "fachneutrale", "node scripts/install-ui-editor-to-target.cjs", "M73"]) {
  assert.equal(readme.includes(fragment), true, `README enthaelt nicht: ${fragment}`);
}
for (const term of FORBIDDEN_PRODUCT_TERMS) {
  assert.equal(readme.includes(term), false, `README enthaelt verbotenen Begriff: ${term}`);
}

console.log("TESTS OK: repo-core-contract-cleanup");
