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

const browserProductTerms = /\b(?:browser(?:betrieb|technik|technologie|loesung|lösung|-laufzeit)?|web-app|webanwendung|html|dom|electron|webview)\b/i;
const forbiddenPositiveClaims = [
  /\b(?:editor|ui-editor-kit|produkt)\b[^.!?\n]{0,100}\b(?:laeuft|läuft|findet statt|wird betrieben|wird ausgefuehrt|wird ausgeführt)\b[^.!?\n]{0,50}\b(?:im|in einem)\s+browser\b/i,
  /\b(?:editor|ui-editor-kit|produkt)\b[^.!?\n]{0,100}\b(?:kann|soll|wird)\b[^.!?\n]{0,40}\b(?:im|in einem)\s+browser\b[^.!?\n]{0,40}\b(?:laufen|betrieben|ausgefuehrt|ausgeführt)\b/i,
  /\b(?:editor|ui-editor-kit|produkt)\b[^.!?\n]{0,100}\b(?:verwendet|nutzt|setzt auf|basiert auf)\b[^.!?\n]{0,50}\b(?:browsertechnik|browsertechnologie|html|dom|electron|webview)\b/i,
  /\b(?:browserbetrieb|browsertechnik|browsertechnologie|browserloesung|browserlösung|browser-laufzeit|web-app|webanwendung)\b[^.!?\n]{0,80}\b(?:wird|ist|bleibt|soll|kann)\b[^.!?\n]{0,50}\b(?:unterstuetzt|unterstützt|moeglich|möglich|vorgesehen|angeboten|verwendet|gebaut|umgesetzt|bestandteil)\b/i,
  /\b(?:als\s+)?(?:web-app|webanwendung)\b[^.!?\n]{0,80}\b(?:gebaut|umgesetzt|betrieben|unterstuetzt|unterstützt|vorgesehen)\b/i,
  /\b(?:html|dom)\b[^.!?\n]{0,80}\b(?:bildet|bilden|dient|dienen|ist|sind|wird|werden)\b[^.!?\n]{0,50}\b(?:produktoberflaeche|produktoberfläche|produkt-ui|bedienoberflaeche|bedienoberfläche)\b/i,
];
const allowedNegativeClaims = [
  /\bbrowserfrei\b/i,
  /\b(?:kein|keine|keinen|keiner|keines|ohne)\b[^.!?\n]{0,40}\b(?:browser|browserbetrieb|browsertechnik|browser-laufzeit|web-app|webanwendung|web-laufzeit)\b/i,
  /\b(?:nicht|niemals)\b[^.!?\n]{0,40}\b(?:im|in einem)?\s*browser\b/i,
  /\b(?:darf|soll|wird|kann)\s+nicht\b[^.!?\n]{0,80}\bbrowser\b/i,
  /\bnicht\s+bestandteil\b[^.!?\n]{0,140}\bbrowser\b/i,
  /\b(?:browser|browserbetrieb|browsertechnik|browser-laufzeit)\b[^.!?\n]{0,100}\b(?:ausgeschlossen|verboten|nicht\s+(?:unterstuetzt|unterstützt|vorgesehen|erlaubt|moeglich|möglich))\b/i,
];
const violations = [];

function statementsFrom(content) {
  return content
    .split(/\r?\n/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map((statement) => statement.trim())
    .filter(Boolean);
}

function isForbiddenPositiveClaim(statement) {
  if (!browserProductTerms.test(statement)) return false;
  if (allowedNegativeClaims.some((pattern) => pattern.test(statement))) return false;
  return forbiddenPositiveClaims.some((pattern) => pattern.test(statement));
}

function assertClassifierExamples() {
  const allowed = [
    'Der Editor bleibt browserfrei.',
    'Browserbetrieb ist dauerhaft ausgeschlossen.',
    'Es gibt keine Browser-/Web-Laufzeit.',
    'Der Editor findet niemals im Browser statt.',
    'Der Editor darf nicht im Browser laufen.',
  ];
  const forbidden = [
    'Der Editor läuft im Browser.',
    'Der Editor verwendet Browsertechnik.',
    'HTML und DOM bilden die Produktoberfläche.',
    'Browserbetrieb wird unterstützt.',
    'Der Editor wird als Web-App gebaut.',
    'Der Editor kann in einem Browser ausgeführt werden.',
  ];

  for (const statement of allowed) {
    if (isForbiddenPositiveClaim(statement)) throw new Error(`Negative Browseraussage wurde faelschlich blockiert: ${statement}`);
  }
  for (const statement of forbidden) {
    if (!isForbiddenPositiveClaim(statement)) throw new Error(`Positive Browseraussage wurde nicht erkannt: ${statement}`);
  }
}

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
  const positiveClaims = statementsFrom(contentWithoutMandatoryNotice).filter(isForbiddenPositiveClaim);
  for (const claim of positiveClaims) {
    violations.push(`${relativePath}: positive Browser-/Web-Produktaussage: ${claim}`);
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

assertClassifierExamples();
for (const entry of documentationRoots) walk(entry);

if (violations.length > 0) {
  console.error('Dokumentationsgrenze verletzt:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('TESTS OK: mandatory-no-browser-product-notice');
