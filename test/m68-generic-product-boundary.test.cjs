"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const boundaryPath = path.join(repoRoot, "docs", "M68_GENERIC_PRODUCT_BOUNDARY.md");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function assertIncludes(source, expected, label = expected) {
  assert.ok(source.includes(expected), `${label} fehlt`);
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

function getAddedProductiveLines() {
  const { execFileSync } = require("node:child_process");
  const diff = execFileSync("git", ["diff", "--", "src", "scripts", "examples"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return diff
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"));
}

const forbiddenProductiveTerms = ["bbm-produktiv", "bbm.main", "bbm.uiEditorTest", "restarbeiten", "protokoll.topsScreen"];
for (const line of getAddedProductiveLines()) {
  for (const term of forbiddenProductiveTerms) {
    assert.ok(!line.includes(term), `${term} darf nicht als neues produktives Vorkommen entstehen`);
  }
}

console.log("m68-generic-product-boundary.test.cjs passed");
