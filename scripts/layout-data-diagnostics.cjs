#!/usr/bin/env node

/*
 * UI-Editor-Kit Layoutdaten-Diagnose (K1.5)
 *
 * Fuehrt fachneutral Extraktion und Validierung zusammen.
 * Keine Speicherung, keine Layout-Anwendung, keine DOM-Aenderung.
 */

const { extractLayoutDataFromDom } = require("./layout-data-extractor.cjs");
const { validateLayoutData } = require("./layout-data-validator.cjs");

function createSummary(layoutData, validation) {
  const itemCount = layoutData && layoutData.items ? Object.keys(layoutData.items).length : 0;
  return {
    itemCount,
    errorCount: validation.errors.length,
    scope: layoutData.scope,
    version: layoutData.version,
  };
}

function createLayoutDataDiagnostics(rootElement, options) {
  const opts = options || {};
  const layoutData = extractLayoutDataFromDom(rootElement, opts);
  const validation = validateLayoutData(layoutData, opts.validationOptions);

  return {
    ok: validation.ok,
    layoutData,
    validation,
    errors: validation.errors.slice(),
    summary: createSummary(layoutData, validation),
  };
}

function createLayoutDataDiagnosticsFromLayoutData(layoutData, options) {
  const opts = options || {};
  const validation = validateLayoutData(layoutData, opts.validationOptions);

  return {
    ok: validation.ok,
    layoutData,
    validation,
    errors: validation.errors.slice(),
    summary: createSummary(layoutData, validation),
  };
}

module.exports = {
  createLayoutDataDiagnostics,
  createLayoutDataDiagnosticsFromLayoutData,
};
