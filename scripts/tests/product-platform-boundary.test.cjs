#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const SELF = path.relative(ROOT, __filename).replaceAll("\\", "/");
const EXCLUDED = new Set([
  SELF,
  "scripts/tests/documentation-no-browser.test.cjs",
]);
const roots = ["src", "scripts", "test", "examples", "dist", "styles"];
const forbiddenPathParts = ["browser", ".html"];
const forbiddenSourcePatterns = [
  /\bwindow\b/,
  /\bdocument\b/,
  /\bHTMLElement\b/,
  /querySelector/,
  /getElementById\s*\(/,
  /MutationObserver/,
  /getBoundingClientRect/,
  /createElement\s*\(/,
  /localStorage/,
];
const violations = [];

function inspect(relativePath) {
  const normalized = relativePath.replaceAll("\\", "/");
  if (EXCLUDED.has(normalized)) return;
  const lower = normalized.toLowerCase();
  if (forbiddenPathParts.some((part) => lower.includes(part))) {
    violations.push(`${normalized}: verbotener Produktpfad`);
    return;
  }
  if (!/\.(?:cjs|mjs|js|css)$/.test(lower)) return;
  const content = fs.readFileSync(path.join(ROOT, relativePath), "utf8");
  for (const pattern of forbiddenSourcePatterns) {
    const match = content.match(pattern);
    if (match) violations.push(`${normalized}: ${JSON.stringify(match[0])}`);
  }
}

function walk(relativePath) {
  const absolute = path.join(ROOT, relativePath);
  if (!fs.existsSync(absolute)) return;
  const stat = fs.statSync(absolute);
  if (stat.isFile()) return inspect(relativePath);
  for (const name of fs.readdirSync(absolute)) walk(path.join(relativePath, name));
}

for (const root of roots) walk(root);

const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
assert.deepEqual(packageJson.exports, { ".": { require: "./src/index.cjs" } });
for (const [name, command] of Object.entries(packageJson.scripts || {})) {
  const normalizedCommand = command.replaceAll("documentation-no-browser.test.cjs", "documentation-guard.test.cjs");
  if (/browser/i.test(name) || /browser/i.test(normalizedCommand)) violations.push(`package.json scripts.${name}`);
}

if (violations.length) {
  console.error("Verbotene laufzeitgebundene Produktspuren:");
  for (const violation of [...new Set(violations)].sort()) console.error(`- ${violation}`);
  process.exit(1);
}

console.log("TESTS OK: product-platform-boundary");
