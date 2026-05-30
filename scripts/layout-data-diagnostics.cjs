#!/usr/bin/env node

/*
 * UI-Editor-Kit Layoutdaten-Diagnose (K1.5)
 *
 * Fuehrt fachneutral Extraktion und Validierung zusammen.
 * Keine Speicherung, keine Layout-Anwendung, keine DOM-Aenderung.
 */

const { extractLayoutDataFromDom } = require("./layout-data-extractor.cjs");
const { validateLayoutData } = require("./layout-data-validator.cjs");

function createLayoutDataDiagnostics(rootElement, options) {
  const opts = options || {};
  const layoutData = extractLayoutDataFromDom(rootElement, opts);
  const validation = validateLayoutData(layoutData, opts.validationOptions);
  const itemCount = layoutData && layoutData.items ? Object.keys(layoutData.items).length : 0;

  return {
    ok: validation.ok,
    layoutData,
    validation,
    errors: validation.errors.slice(),
    summary: {
      itemCount,
      errorCount: validation.errors.length,
      scope: layoutData.scope,
      version: layoutData.version,
    },
  };
}

module.exports = {
  createLayoutDataDiagnostics,
};
