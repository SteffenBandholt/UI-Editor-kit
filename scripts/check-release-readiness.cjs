#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..");
const EXPECTED_VERSION = "0.2.0";
const FORBIDDEN_TERMS = ["Protokoll", "TOP", "Bauvorhaben", "Restarbeiten", "BBM", "Pferdeverwaltung", "Pilot", "pilot"];

const checks = [];

function repoPath(relativePath) {
  return path.join(REPO_ROOT, relativePath);
}

function read(relativePath) {
  return fs.readFileSync(repoPath(relativePath), "utf8");
}

function addCheck(label, run) {
  checks.push({ label, run });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function fileExists(relativePath) {
  return fs.existsSync(repoPath(relativePath));
}

function hasForbiddenTerm(relativePath) {
  const content = read(relativePath);
  return FORBIDDEN_TERMS.find((term) => content.includes(term));
}

addCheck("package.json existiert", () => assert(fileExists("package.json"), "package.json fehlt"));
addCheck("package.json.version ist exakt 0.2.0", () => {
  const packageJson = JSON.parse(read("package.json"));
  assert(packageJson.version === EXPECTED_VERSION, `Version ist ${packageJson.version}`);
});
addCheck("package.json.main verweist auf src/index.cjs", () => {
  const packageJson = JSON.parse(read("package.json"));
  assert(packageJson.main === "src/index.cjs", `main ist ${packageJson.main}`);
});
addCheck("package.json.exports enthaelt den oeffentlichen Einstieg", () => {
  const packageJson = JSON.parse(read("package.json"));
  assert(packageJson.exports && packageJson.exports["."] && packageJson.exports["."].require === "./src/index.cjs", "exports[.].require verweist nicht auf ./src/index.cjs");
});
addCheck("src/index.cjs existiert", () => assert(fileExists("src/index.cjs"), "src/index.cjs fehlt"));
addCheck("CHANGELOG.md enthaelt Abschnitt 0.2.0", () => assert(/^## 0\.2\.0\b/m.test(read("CHANGELOG.md")), "CHANGELOG.md enthaelt keinen Abschnitt ## 0.2.0"));
addCheck("docs/M49_RELEASE_FIXSTAND.md existiert", () => assert(fileExists("docs/M49_RELEASE_FIXSTAND.md"), "docs/M49_RELEASE_FIXSTAND.md fehlt"));
addCheck("docs/releases/v0.2.0.md existiert", () => assert(fileExists("docs/releases/v0.2.0.md"), "docs/releases/v0.2.0.md fehlt"));
addCheck("README.md erwaehnt Version 0.2.0", () => assert(read("README.md").includes("0.2.0"), "README.md erwaehnt 0.2.0 nicht"));
["src/index.cjs", "docs/releases/v0.2.0.md", "docs/M50_RELEASE_TAG_CHECKLIST.md"].forEach((relativePath) => {
  addCheck(`${relativePath} enthaelt keine verbotenen Fachbegriffe`, () => {
    const term = hasForbiddenTerm(relativePath);
    assert(!term, `${relativePath} enthaelt verbotenen Begriff: ${term}`);
  });
});

let failed = 0;
checks.forEach(({ label, run }) => {
  try {
    run();
    console.log(`OK  ${label}`);
  } catch (error) {
    failed += 1;
    console.error(`ERR ${label}: ${error.message}`);
  }
});

if (failed > 0) {
  console.error(`Release-Readiness fehlgeschlagen: ${failed} Fehler`);
  process.exit(1);
}

console.log(`Release-Readiness OK fuer UI-Editor-kit v${EXPECTED_VERSION}`);
