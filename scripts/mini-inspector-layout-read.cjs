#!/usr/bin/env node

/*
 * Mini-Inspector Layout-Read (K2.0)
 *
 * Nutzt den Layoutdaten-Kern lesend ueber die oeffentliche API.
 * Keine Speicherung, keine Layout-Anwendung, keine Fachlogik.
 */

const { createLayoutDataDiagnostics } = require("./layout-data-api.cjs");

function createMiniInspectorLayoutStatus(rootElement, options) {
  const opts = options || {};
  const report = createLayoutDataDiagnostics(rootElement, opts);

  return {
    ok: report.ok,
    itemCount: report.summary.itemCount,
    errorCount: report.summary.errorCount,
    scope: report.summary.scope,
    version: report.summary.version,
    errors: report.errors.slice(),
  };
}

function formatMiniInspectorLayoutStatus(status) {
  const s = status || {
    ok: false,
    itemCount: 0,
    errorCount: 0,
    scope: "app-or-screen-scope",
    version: 1,
    errors: [],
  };

  const lines = [
    `Layoutdaten gueltig: ${s.ok ? "ja" : "nein"}`,
    `Layout-Items: ${s.itemCount}`,
    `Fehler: ${s.errorCount}`,
    `Scope: ${s.scope}`,
    `Version: ${s.version}`,
  ];

  if (Array.isArray(s.errors) && s.errors.length > 0) {
    lines.push("Fehlerdetails:");
    s.errors.forEach((error, index) => {
      const pathValue = error && error.path ? error.path : "<unbekannt>";
      const codeValue = error && error.code ? error.code : "UNKNOWN";
      const messageValue = error && error.message ? error.message : "Kein Fehlertext";
      lines.push(`${index + 1}. ${pathValue} | ${codeValue} | ${messageValue}`);
    });
  }

  return {
    ok: Boolean(s.ok),
    lines,
    text: lines.join("\n"),
  };
}

module.exports = {
  createMiniInspectorLayoutStatus,
  formatMiniInspectorLayoutStatus,
  readMiniInspectorLayoutStatus: createMiniInspectorLayoutStatus,
  createMiniInspectorStatusViewModel: formatMiniInspectorLayoutStatus,
};
