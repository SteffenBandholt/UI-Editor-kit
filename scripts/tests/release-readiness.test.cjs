#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const REPO_ROOT = path.resolve(__dirname, "../..");
const SCRIPT_PATH = path.join(REPO_ROOT, "scripts/check-release-readiness.cjs");
const NEW_PUBLIC_RELEASE_FILES = ["docs/releases/v0.2.0.md", "docs/M50_RELEASE_TAG_CHECKLIST.md"];
const FORBIDDEN_TERMS = ["Protokoll", "TOP", "Bauvorhaben", "Restarbeiten", "BBM", "Pferdeverwaltung", "Pilot", "pilot"];

function read(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

function statSnapshot() {
  return [
    "package.json",
    "README.md",
    "CHANGELOG.md",
    "STATUS.md",
    "src/index.cjs",
    "scripts/check-release-readiness.cjs",
    ...NEW_PUBLIC_RELEASE_FILES,
  ].map((relativePath) => {
    const stat = fs.statSync(path.join(REPO_ROOT, relativePath));
    return [relativePath, stat.mtimeMs, stat.size];
  });
}

const before = statSnapshot();
const result = spawnSync(process.execPath, [SCRIPT_PATH], {
  cwd: REPO_ROOT,
  encoding: "utf8",
});
const after = statSnapshot();

assert.equal(result.status, 0, result.stderr || result.stdout);
assert.match(result.stdout, /Release-Readiness OK fuer UI-Editor-kit v0\.2\.0/);
assert.deepEqual(after, before, "Release-Readiness-Skript darf keine Dateien aendern");

const packageJson = JSON.parse(read("package.json"));
assert.equal(packageJson.version, "0.2.0");
assert.equal(packageJson.main, "src/index.cjs");
assert.equal(packageJson.exports["."].require, "./src/index.cjs");
assert.equal(packageJson.scripts["release:check"], "node scripts/check-release-readiness.cjs");

NEW_PUBLIC_RELEASE_FILES.forEach((relativePath) => {
  assert.equal(fs.existsSync(path.join(REPO_ROOT, relativePath)), true, `${relativePath} fehlt`);
  const content = read(relativePath);
  FORBIDDEN_TERMS.forEach((term) => {
    assert.equal(content.includes(term), false, `${relativePath} enthaelt verbotenen Begriff: ${term}`);
  });
});

const scriptContent = read("scripts/check-release-readiness.cjs");
["git tag", "git push", "github", "https://", "http://", "node:https", "node:http", "node:net", "node:dns", "child_process"].forEach((fragment) => {
  assert.equal(scriptContent.includes(fragment), false, `Readiness-Skript enthaelt unerlaubten Netzwerk-, Prozess- oder Tag-Bezug: ${fragment}`);
});

console.log("TESTS OK: release-readiness");
