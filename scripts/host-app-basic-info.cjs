#!/usr/bin/env node

const path = require("node:path");

const EXAMPLE_PATH = path.join("examples", "host-app-basic", "index.html");

function formatHostAppBasicInfo() {
  return [
    "Host-App-Beispiel",
    `Pfad: ${EXAMPLE_PATH}`,
    "Oeffnen: HTML-Datei direkt im Browser laden.",
    "Grenzen: rein lesend, kein Speichern, keine Layout-Anwendung, keine Ziel-UI-Mutation, keine Fachlogik.",
  ].join("\n");
}

module.exports = {
  EXAMPLE_PATH,
  formatHostAppBasicInfo,
};

if (require.main === module) {
  process.stdout.write(`${formatHostAppBasicInfo()}\n`);
}
