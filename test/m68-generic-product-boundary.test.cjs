"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const boundaryPath = path.join(repoRoot, "docs", "M68_GENERIC_PRODUCT_BOUNDARY.md");

assert.equal(fs.existsSync(boundaryPath), true, "M68 boundary document must exist");

const boundary = fs.readFileSync(boundaryPath, "utf8");

[
  "# M68: Generische Produktgrenze",
  "## 1. Zweck",
  "## 2. Produktbestandteile",
  "### UI-Editor-kit Core",
  "### UI-Editor-kit UI/Runtime",
  "### Ziel-App HostAdapter",
  "### Ziel-App Registry",
  "## 3. Nicht Bestandteil des Kits",
  "## 4. Oeffentliche API-Zielstruktur",
  "## 5. Datenfluss",
  "## 6. Sicherheitsgrenzen",
  "## 7. Folgepakete",
  "## 8. Abnahme",
].forEach((heading) => {
  assert.equal(boundary.includes(heading), true, `${heading} fehlt`);
});

[
  "M69: Runtime und Session-/Layout-API",
  "M70: Bedienpanel und ViewModels",
  "M71: plattformneutrale Host- und Integrationsschicht",
  "M72: Panel-, Element- und Textbearbeitung",
  "M73: Release Candidate, Public API, Packaging und Integrationshandbuch",
].forEach((entry) => {
  assert.equal(boundary.includes(entry), true, `${entry} fehlt`);
});

[
  "Das Kit erzeugt keine Registry-Eintraege automatisch.",
  "Keine automatische Elementerkennung.",
  "Keine Fachlogik im Kit.",
  "Keine Fachdaten im Layoutspeicher.",
  "Keine produktive Abhaengigkeit von einer konkreten Ziel-App.",
  "Keine produktive Abhaengigkeit von einer konkreten Laufzeitumgebung.",
  "keine fest vorgeschriebene Laufzeitumgebung",
].forEach((criterion) => {
  assert.equal(boundary.includes(criterion), true, `${criterion} fehlt`);
});

[
  "bbm-produktiv",
  "bbm.main",
  "bbm.uiEditorTest",
  "restarbeiten",
  "protokoll.topsScreen",
].forEach((term) => {
  assert.equal(boundary.toLowerCase().includes(term.toLowerCase()), false, `Verbotener Fachbegriff in M68: ${term}`);
});

console.log("m68-generic-product-boundary.test.cjs passed");
