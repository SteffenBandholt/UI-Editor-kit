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

module.exports = {
  createMiniInspectorLayoutStatus,
};
