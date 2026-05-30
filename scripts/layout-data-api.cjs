#!/usr/bin/env node

/*
 * UI-Editor-Kit Layoutdaten-API (K1.8)
 *
 * Zentrale, fachneutrale Buendelung bestehender Layoutdaten-Bausteine.
 * Keine eigene Logik, keine Datei-I/O, keine Speicherung.
 */

const { validateLayoutData } = require("./layout-data-validator.cjs");
const {
  extractLayoutDataFromDom,
  extractAndValidateLayoutData,
} = require("./layout-data-extractor.cjs");
const {
  createLayoutDataDiagnostics,
  createLayoutDataDiagnosticsFromLayoutData,
} = require("./layout-data-diagnostics.cjs");

module.exports = {
  validateLayoutData,
  extractLayoutDataFromDom,
  extractAndValidateLayoutData,
  createLayoutDataDiagnostics,
  createLayoutDataDiagnosticsFromLayoutData,
};
