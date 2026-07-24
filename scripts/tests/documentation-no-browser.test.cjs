'use strict';

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const documentationRoots = [
  path.join(repoRoot, 'README.md'),
  path.join(repoRoot, 'STATUS.md'),
  path.join(repoRoot, 'CHANGELOG.md'),
  path.join(repoRoot, 'docs'),
  path.join(repoRoot, 'codex'),
];

const forbidden = /browser/i;
const violations = [];

function inspectFile(filePath) {
  if (!filePath.endsWith('.md')) return;
  const content = fs.readFileSync(filePath, 'utf8');
  if (forbidden.test(content) || forbidden.test(path.basename(filePath))) {
    violations.push(path.relative(repoRoot, filePath));
  }
}

function walk(entryPath) {
  if (!fs.existsSync(entryPath)) return;
  const stat = fs.statSync(entryPath);
  if (stat.isFile()) {
    inspectFile(entryPath);
    return;
  }
  for (const name of fs.readdirSync(entryPath)) {
    walk(path.join(entryPath, name));
  }
}

for (const entry of documentationRoots) walk(entry);

if (violations.length > 0) {
  console.error('Dokumentation enthaelt verbotene Browser-Bezuege:');
  for (const file of violations) console.error(`- ${file}`);
  process.exit(1);
}

console.log('TESTS OK: documentation-no-browser');
