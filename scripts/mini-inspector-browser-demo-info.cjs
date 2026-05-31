#!/usr/bin/env node

/*
 * Mini-Inspector Browser-Demo Info (K5.0)
 *
 * Gibt nur den Pfad zur statischen, fachneutralen Browser-/HTML-Demo aus.
 * Kein Webserver, keine Speicherung, keine Layout-Anwendung.
 */

const path = require("node:path");

const DEMO_PATH = path.join("demo", "mini-inspector", "index.html");

function formatMiniInspectorBrowserDemoInfo() {
  return [
    "Mini-Inspector Browser-Demo",
    `Pfad: ${DEMO_PATH}`,
    "Oeffnen: HTML-Datei direkt im Browser laden.",
    "Grenzen: rein lesend, kein Speichern, keine Layout-Anwendung, keine Ziel-UI-Mutation, keine Fachlogik.",
  ].join("\n");
}

module.exports = {
  DEMO_PATH,
  formatMiniInspectorBrowserDemoInfo,
};

if (require.main === module) {
  process.stdout.write(`${formatMiniInspectorBrowserDemoInfo()}\n`);
}
