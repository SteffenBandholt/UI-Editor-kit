#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const GUIDE_PATH = path.join(REPO_ROOT, "docs", "HOST_APP_ADOPTION_GUIDE.md");
const FORBIDDEN_TERMS = ["Protokoll", "TOP", "Bauvorhaben", "Restarbeiten", "BBM"];

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function assertNoTerms(text, terms, label) {
  terms.forEach((term) => {
    assert.equal(text.includes(term), false, `${label} enthaelt verbotenen Begriff: ${term}`);
  });
}

function run() {
  assert.equal(fs.existsSync(GUIDE_PATH), true, `Datei fehlt: ${GUIDE_PATH}`);

  const guide = read(GUIDE_PATH);

  assert.equal(guide.includes("browser/mini-inspector-host-adapter.js"), true);
  assert.equal(guide.includes("styles/neutral-theme-tokens.css"), true);
  assert.equal(guide.includes("examples/host-app-basic/index.html"), true);
  assert.equal(guide.includes("updateMiniInspectorHostAdapter"), true);
  assert.equal(guide.includes("getrennten Inspector-Container"), true);
  assert.equal(guide.includes("Ziel-UI"), true);
  assert.equal(guide.includes("kein Speichern"), true);
  assert.equal(guide.includes("keine Layout-Anwendung"), true);
  assert.equal(guide.includes("keine Ziel-UI-Mutation"), true);
  assert.equal(guide.includes("keine Fachlogik"), true);

  assertNoTerms(guide, FORBIDDEN_TERMS, "HOST_APP_ADOPTION_GUIDE");

  console.log("TESTS OK: host-app-adoption-guide");
}

run();
