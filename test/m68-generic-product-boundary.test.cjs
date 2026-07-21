"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const boundaryPath = path.join(repoRoot, "docs", "M68_GENERIC_PRODUCT_BOUNDARY.md");
const forbiddenProductiveTerms = ["bbm-produktiv", "bbm.main", "bbm.uiEditorTest", "restarbeiten", "protokoll.topsScreen"];
const productiveTextExtensions = new Set([".js", ".cjs", ".mjs", ".json", ".html", ".css", ".md"]);
const defaultExcludedDirectoryNames = new Set(["node_modules", "dist", "coverage"]);
const defaultExcludedPathFragments = [
  `${path.sep}scripts${path.sep}tests${path.sep}`,
  `${path.sep}scripts${path.sep}fixtures${path.sep}`,
  `${path.sep}test${path.sep}`,
  `${path.sep}docs${path.sep}M68_GENERIC_PRODUCT_BOUNDARY.md`,
  `${path.sep}STATUS.md`,
  `${path.sep}docs${path.sep}EDITOR_GESAMT_LV.md`,
];

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function assertIncludes(source, expected, label = expected) {
  assert.ok(source.includes(expected), `${label} fehlt`);
}

function toAbsolutePath(value) {
  return path.resolve(repoRoot, value);
}

function isExcludedPath(filePath, excludedPaths = []) {
  const normalizedFilePath = path.resolve(filePath);
  const pathWithSeparators = `${path.sep}${path.relative(repoRoot, normalizedFilePath)}`;

  if (defaultExcludedPathFragments.some((fragment) => pathWithSeparators.includes(fragment))) {
    return true;
  }

  return excludedPaths.some((excludedPath) => {
    const absoluteExcludedPath = path.resolve(excludedPath);
    return normalizedFilePath === absoluteExcludedPath || normalizedFilePath.startsWith(`${absoluteExcludedPath}${path.sep}`);
  });
}

function collectProductiveTextFiles(root, options = {}) {
  const rootPath = path.resolve(root);
  if (!fs.existsSync(rootPath)) return [];

  if (fs.statSync(rootPath).isFile()) {
    if (!productiveTextExtensions.has(path.extname(rootPath)) || isExcludedPath(rootPath, options.excludedPaths)) return [];
    return [rootPath];
  }

  const files = [];
  const stack = [rootPath];
  while (stack.length > 0) {
    const currentPath = stack.pop();
    const currentName = path.basename(currentPath);
    if (defaultExcludedDirectoryNames.has(currentName) || isExcludedPath(currentPath, options.excludedPaths)) {
      continue;
    }

    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
        continue;
      }

      if (!entry.isFile()) continue;
      if (!productiveTextExtensions.has(path.extname(entry.name))) continue;
      if (isExcludedPath(entryPath, options.excludedPaths)) continue;
      files.push(entryPath);
    }
  }

  return files.sort();
}

function scanForbiddenProductTerms({ roots, forbiddenTerms, excludedPaths = [] }) {
  const findings = [];
  for (const root of roots) {
    for (const filePath of collectProductiveTextFiles(root, { excludedPaths })) {
      const content = fs.readFileSync(filePath, "utf8");
      for (const term of forbiddenTerms) {
        if (content.includes(term)) {
          findings.push({ filePath, term });
        }
      }
    }
  }
  return findings;
}

function formatForbiddenFindings(findings) {
  return findings
    .map((finding) => `${path.relative(repoRoot, finding.filePath) || finding.filePath}: ${finding.term}`)
    .join("\n");
}

function assertNoForbiddenProductTerms(scanOptions) {
  const findings = scanForbiddenProductTerms(scanOptions);
  assert.equal(findings.length, 0, `Verbotene produktive BBM-/Fachbegriffe gefunden:\n${formatForbiddenFindings(findings)}`);
}

assert.ok(fs.existsSync(boundaryPath), "M68 boundary document must exist");

const boundary = read("docs/M68_GENERIC_PRODUCT_BOUNDARY.md");
const lv = read("docs/EDITOR_GESAMT_LV.md");
const status = read("STATUS.md");

[
  "## 1. Zweck und Ziel",
  "## 2. Heutiger Stand im UI-Editor-kit",
  "## 3. Heutiger Stand in BBM M63C-M67",
  "## 4. Funktionsmatrix",
  "## 5. Produktgrenze",
  "## 6. Oeffentliche API-Zielstruktur",
  "## 7. Datenfluss",
  "## 8. Eigentuemerschaft von Status und Layoutwahrheit",
  "## 9. Fehler- und Rollbackgrenzen",
  "## 10. Ref- und Selection-Vertrag",
  "## 11. Persistenzvertrag",
  "## 12. Verbotene Abhaengigkeiten",
  "## 13. Migrationsstrategie ohne Codekopie",
  "## 14. Folgepakete M69-M73",
  "## 15. Abnahmekriterien fuer BBM-Unabhaengigkeit",
].forEach((heading) => assertIncludes(boundary, heading));

["M69", "M70", "M71", "M72", "M73"].forEach((pkg) => assertIncludes(boundary, pkg));

[
  "Eine Referenzanwendung ausserhalb BBM laeuft",
  "Keine Datei aus BBM importiert wird",
  "Keine BBM-ID im Kit enthalten ist",
  "Move, Breite, Hoehe, Save, Load, Session-Verwerfen, Einzelreset und Gesamtreset funktionieren",
  "Alle Tests ohne BBM-Repo verfuegbar und gruen sind",
].forEach((criterion) => assertIncludes(boundary, criterion));

assertIncludes(boundary, "BBM ist in M68 nur Zielanwendung und externe Referenz");
assertIncludes(boundary, "| Funktion | aktueller Ort | Zielort | UI-Editor-kit Core | UI-Editor-kit UI | Ziel-App HostAdapter | Ziel-App Registry | BBM-spezifisch | Folgepaket | Risiko | Nachweis |");
assertIncludes(boundary, "createUiEditorRuntime({ registry, hostAdapter, layoutStorage, targetContext, messages })");
assertIncludes(boundary, "Ziel-App Registry\n-> UI-Editor Core");

["M63C", "M64", "M65", "M66", "M67"].forEach((pkg) => assertIncludes(boundary, pkg));

assert.doesNotMatch(boundary, /entscheidung\s+fuer\s+dom-scan/i, "must not decide for DOM scan");
assert.doesNotMatch(boundary, /automatische\s+Registry-Erkennung\s+ist\s+erlaubt/i, "must not allow automatic registry detection");
assert.match(boundary, /keine DOM-Suche|keine Ziel-App-DOM-Struktur scannen|darf nicht Ziel-App-DOM scannen/i);
assert.match(boundary, /keine automatische Registrierung|keine Elemente automatisch registrieren|automatisch Registry-Eintraege erzeugen/i);

assertIncludes(lv, "O1 / M68");
assertIncludes(lv, "M69 - Generische Runtime");
assertIncludes(status, "M68 gebaut");
assertIncludes(status, "| O1/M68 |");

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "m68-product-term-scan-"));
try {
  const badFile = path.join(tempRoot, "src", "bad-example.js");
  const goodFile = path.join(tempRoot, "src", "good-example.js");
  fs.mkdirSync(path.dirname(badFile), { recursive: true });
  fs.writeFileSync(badFile, 'const forbidden = "bbm-produktiv";\n');
  fs.writeFileSync(goodFile, 'const targetAppId = "neutral-demo-app";\n');

  const findings = scanForbiddenProductTerms({ roots: [path.join(tempRoot, "src")], forbiddenTerms: forbiddenProductiveTerms });
  assert.deepEqual(findings.map((finding) => finding.term), ["bbm-produktiv"]);
  assert.equal(findings[0].filePath, badFile);
  assert.equal(formatForbiddenFindings(findings).includes("bad-example.js"), true);
  assert.equal(formatForbiddenFindings(findings).includes("bbm-produktiv"), true);

  const allowedFindings = scanForbiddenProductTerms({ roots: [goodFile], forbiddenTerms: forbiddenProductiveTerms });
  assert.deepEqual(allowedFindings, []);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

assertNoForbiddenProductTerms({
  roots: [toAbsolutePath("src"), toAbsolutePath("scripts"), toAbsolutePath("examples")],
  forbiddenTerms: forbiddenProductiveTerms,
});

console.log("m68-generic-product-boundary.test.cjs passed");
