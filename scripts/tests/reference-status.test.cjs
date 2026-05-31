#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const STATUS_PATH = path.join(REPO_ROOT, "docs", "REFERENCE_STATUS.md");
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
  assert.equal(fs.existsSync(STATUS_PATH), true, `Datei fehlt: ${STATUS_PATH}`);

  const status = read(STATUS_PATH);

  [
    "browser/mini-inspector-host-adapter.js",
    "styles/neutral-theme-tokens.css",
    "examples/host-app-basic/index.html",
    "docs/HOST_APP_ADOPTION_GUIDE.md",
  ].forEach((entry) => {
    assert.equal(status.includes(entry), true, `Referenzstand enthaelt nicht: ${entry}`);
  });

  [
    "npm test",
    "npm run layout:diagnose",
    "npm run mini-inspector:demo",
    "npm run mini-inspector:demo:browser",
    "npm run host-app:basic",
  ].forEach((command) => {
    assert.equal(status.includes(command), true, `Referenzstand nennt nicht: ${command}`);
  });

  [
    "kein Speichern",
    "keine Layout-Anwendung",
    "keine Ziel-UI-Mutation",
    "keine Fachlogik",
  ].forEach((boundary) => {
    assert.equal(status.includes(boundary), true, `Referenzstand enthaelt Grenze nicht: ${boundary}`);
  });

  assertNoTerms(status, FORBIDDEN_TERMS, "REFERENCE_STATUS");

  console.log("TESTS OK: reference-status");
}

run();
