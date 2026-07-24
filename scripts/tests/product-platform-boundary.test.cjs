#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const pathRoots = ["src", "scripts", "test", "examples", "dist", "styles"];
const sourceRoots = ["src"];
const forbiddenPathParts = ["browser", ".html"];
const forbiddenSourcePatterns = [
  /\bwindow\s*\./,
  /\bdocument\s*\./,
  /\bHTMLElement\b/,
  /\.querySelector\s*\(/,
  /\bMutationObserver\b/,
  /\.getBoundingClientRect\s*\(/,
  /\.createElement\s*\(/,
  /\blocalStorage\s*\./,
];
const violations = [];

function walk(relativePath, visitor) {
  const absolute = path.join(ROOT, relativePath);
  if (!fs.existsSync(absolute)) return;
  const stat = fs.statSync(absolute);
  if (stat.isFile()) return visitor(relativePath);
  for (const name of fs.readdirSync(absolute)) walk(path.join(relativePath, name), visitor);
}

for (const root of pathRoots) {
  walk(root, (relativePath) => {
    const normalized = relativePath.replaceAll("\\", "/");
    const lower = normalized.toLowerCase();
    if (forbiddenPathParts.some((part) => lower.includes(part))) {
      violations.push(`${normalized}: verbotener Produktpfad`);
    }
  });
}

for (const root of sourceRoots) {
  walk(root, (relativePath) => {
    const normalized = relativePath.replaceAll("\\", "/");
    if (!/\.(?:cjs|mjs|js|css)$/.test(normalized.toLowerCase())) return;
    const content = fs.readFileSync(path.join(ROOT, relativePath), "utf8");
    for (const pattern of forbiddenSourcePatterns) {
      const match = content.match(pattern);
      if (match) violations.push(`${normalized}: ${JSON.stringify(match[0])}`);
    }
  });
}

const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
assert.deepEqual(packageJson.exports, { ".": { require: "./src/index.cjs" } });
for (const [name, command] of Object.entries(packageJson.scripts || {})) {
  if (/browser/i.test(name) || /browser/i.test(command)) violations.push(`package.json scripts.${name}`);
}

if (violations.length) {
  console.error("Verbotene laufzeitgebundene Produktspuren:");
  for (const violation of [...new Set(violations)].sort()) console.error(`- ${violation}`);
  process.exit(1);
}

console.log("TESTS OK: product-platform-boundary");
