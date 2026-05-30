#!/usr/bin/env node

const assert = require("assert/strict");
const {
  validateLayoutData,
  extractLayoutDataFromDom,
  createLayoutDataDiagnostics,
} = require("../layout-data-api.cjs");

function createNode(attributes, children) {
  const attrs = attributes || {};
  const childNodes = children || [];
  return {
    attributes: attrs,
    children: childNodes,
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null;
    },
  };
}

function run() {
  // 1) API exportiert den Validator
  assert.equal(typeof validateLayoutData, "function");

  // 2) API exportiert den Extractor
  assert.equal(typeof extractLayoutDataFromDom, "function");

  // 3) API exportiert die Diagnosefunktion
  assert.equal(typeof createLayoutDataDiagnostics, "function");

  // 4) Validator ueber API erkennt gueltige Layoutdaten
  const validData = {
    version: 1,
    scope: "neutral.scope",
    items: {
      "demo.header": {
        visible: true,
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        order: 1,
      },
    },
  };
  const validation = validateLayoutData(validData);
  assert.equal(validation.ok, true);

  // 5) Extractor ueber API erzeugt validierbare Layoutdaten aus neutraler Mock-Struktur
  const root = createNode({}, [
    createNode({ "data-ui-inspector-id": "demo.root", "data-ui-editor-editable": "true" }, [
      createNode({ "data-ui-inspector-id": "demo.content", "data-ui-editor-editable": "false" }, []),
    ]),
  ]);
  const extracted = extractLayoutDataFromDom(root, { scope: "neutral.scope" });
  const extractedValidation = validateLayoutData(extracted);
  assert.equal(extractedValidation.ok, true);

  // 6) Diagnose ueber API erzeugt neutralen Bericht
  const report = createLayoutDataDiagnostics(root, { scope: "neutral.scope" });
  assert.equal(typeof report.ok, "boolean");
  assert.equal(Array.isArray(report.errors), true);
  assert.equal(typeof report.summary, "object");

  // 7) keine Fachbegriffe werden benoetigt
  assert.equal(Object.prototype.hasOwnProperty.call(extracted.items, "demo.content"), true);

  console.log("TESTS OK: layout-data-api");
}

run();
