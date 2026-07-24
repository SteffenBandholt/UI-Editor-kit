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
  "scripts/tests/documentation-no-browser.test.cjs",
  "scripts/ui-editor-contract-check.cjs",
  "scripts/install-ui-editor-to-target.cjs",
  "src/index.cjs",
];

const MUST_NOT_EXIST = [
  "docs/M58_1_BROWSER_ESM_ENTRY.md",
  "docs/M71_GENERIC_BROWSER_HOST.md",
  "docs/M72_BROWSER_REFERENCE_APP.md",
  "docs/M72_REFERENCE_APP_CHECKLIST.md",
  "demo/mini-inspector/index.html",
  "examples/beispiel-ui/beispiel.html",
  "examples/host-app-basic/index.html",
  "examples/mini-inspector/index.html",
  "docs/MINI_INSPECTOR_REFERENZ.md",
  "docs/MINI_INSPECTOR_STATUS.md",
  "docs/REFERENCE_STATUS.md",
];

const FORBIDDEN_PRODUCT_TERMS = [
  "Protokoll",
  "Bauvorhaben",
  "Restarbeiten",
  "BBM",
  "Pferdeverwaltung",
];

function read(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

function assertExists(relativePath) {
  assert.equal(
    fs.existsSync(path.join(REPO_ROOT, relativePath)),
    true,
    `Datei fehlt: ${relativePath}`,
  );
}

function assertMissing(relativePath) {
  assert.equal(
    fs.existsSync(path.join(REPO_ROOT, relativePath)),
    false,
    `Datei existiert noch: ${relativePath}`,
  );
}

function assertIncludes(text, fragment, label) {
  assert.equal(text.includes(fragment), true, `${label} enthaelt nicht: ${fragment}`);
}

function assertNoTerms(text, terms, label) {
  for (const term of terms) {
    assert.equal(text.includes(term), false, `${label} enthaelt verbotenen Begriff: ${term}`);
  }
}

function run() {
  MUST_EXIST.forEach(assertExists);
  MUST_NOT_EXIST.forEach(assertMissing);

  const packageJson = JSON.parse(read("package.json"));
  assert.equal(packageJson.main, "src/index.cjs");
  assert.equal(typeof packageJson.scripts.test, "string");
  assert.equal(
    packageJson.scripts.test.startsWith("node scripts/tests/documentation-no-browser.test.cjs && "),
    true,
    "npm test muss mit dem Dokumentationsschutz beginnen",
  );
  assertIncludes(
    packageJson.scripts.test,
    "node scripts/tests/repo-core-contract-cleanup.test.cjs",
    "npm test",
  );

  const leadingDocuments = [
    "README.md",
    "STATUS.md",
    "docs/EDITOR_GESAMT_LV.md",
    "docs/EDITOR_BAUPLAN.md",
    "codex/AGENTS_UI_EDITOR_BLOCK.md",
  ];

  for (const file of leadingDocuments) {
    const content = read(file);
    assertIncludes(content, REQUIRED_NOTICE, file);
  }

  const readme = read("README.md");
  assertIncludes(readme, "eigenstaendige", "README");
  assertIncludes(readme, "fachneutrale", "README");
  assertIncludes(readme, "node scripts/install-ui-editor-to-target.cjs", "README");
  assertIncludes(readme, "M73", "README");
  assertNoTerms(readme, FORBIDDEN_PRODUCT_TERMS, "README");

  const status = read("STATUS.md");
  assertIncludes(status, "K6 / M73 - Release Candidate", "STATUS");
  assertIncludes(status, "keine bestimmte Laufzeitumgebung als Produktziel", "STATUS");

  const lv = read("docs/EDITOR_GESAMT_LV.md");
  assertIncludes(lv, "K6 / M73 - Release Candidate", "EDITOR_GESAMT_LV");
  assertIncludes(lv, "keine bestimmte Laufzeitumgebung als Produktziel", "EDITOR_GESAMT_LV");

  assertNoTerms(read("docs/UI_EDITOR_VERTRAG.md"), FORBIDDEN_PRODUCT_TERMS, "UI_EDITOR_VERTRAG");

  console.log("TESTS OK: repo-core-contract-cleanup");
}

run();
