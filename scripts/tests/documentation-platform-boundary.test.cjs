'use strict';

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const mandatoryNotice = '**DAS UI-EDITOR-KIT WIRD NIEMALS IM BROWSER STATTFINDEN.**';
const requiredNoticeFiles = new Set([
  'README.md',
  'STATUS.md',
  'docs/EDITOR_GESAMT_LV.md',
  'docs/EDITOR_BAUPLAN.md',
  'codex/AGENTS_UI_EDITOR_BLOCK.md',
]);
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

  const relativePath = path.relative(repoRoot, filePath).replaceAll('\\', '/');
  const content = fs.readFileSync(filePath, 'utf8');

  if (requiredNoticeFiles.has(relativePath)) {
    const firstLines = content.split(/\r?\n/).slice(0, 8).join('\n');
    if (!firstLines.includes(mandatoryNotice)) {
      violations.push(`${relativePath}: verbindlicher Kopfhinweis fehlt`);
      return;
    }
  }

  const contentWithoutMandatoryNotice = content.replaceAll(mandatoryNotice, '');
  if (forbidden.test(contentWithoutMandatoryNotice) || forbidden.test(path.basename(filePath))) {
    violations.push(`${relativePath}: weiterer Browser-Bezug`);
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
  console.error('Dokumentationsgrenze verletzt:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('TESTS OK: mandatory-no-browser-product-notice');
