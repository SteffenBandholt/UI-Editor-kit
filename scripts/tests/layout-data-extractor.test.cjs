#!/usr/bin/env node

const assert = require("assert/strict");
const { extractLayoutDataFromDom, extractAndValidateLayoutData } = require("../layout-data-extractor.cjs");
const { validateLayoutData } = require("../layout-data-validator.cjs");

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

function snapshotTree(node) {
  return {
    attributes: node.attributes,
    children: Array.isArray(node.children) ? node.children.map(snapshotTree) : [],
  };
}

function run() {
  const tree = createNode(
    {},
    [
      createNode({ "data-ui-inspector-id": "demo.root", "data-ui-editor-editable": "true" }, [
        createNode(
          {
            "data-ui-inspector-id": "demo.header",
            "data-ui-editor-editable": "true",
            "data-ui-editor-ops": "move,hide",
          },
          []
        ),
        createNode({}, [createNode({}, [])]),
        createNode(
          {
            "data-ui-inspector-id": "demo.content",
            "data-ui-editor-editable": "false",
            "data-ui-editor-ops": "resize,layout",
          },
          []
        ),
      ]),
      createNode({ text: "sichtbarer Fachtext wird ignoriert" }, []),
    ]
  );

  const before = snapshotTree(tree);
  const data = extractLayoutDataFromDom(tree, { scope: "demo.scope" });

  // 1) gueltige Metadaten erzeugen valides Layoutdaten-Objekt
  const validation = validateLayoutData(data);
  assert.equal(validation.ok, true, "extracted layout data should be valid");

  // 2) Elemente ohne data-ui-* werden ignoriert
  assert.equal(Object.prototype.hasOwnProperty.call(data.items, "text"), false);
  assert.equal(Object.keys(data.items).length, 3);

  // 3) keine Fachdaten / sichtbaren Fachtexte benoetigt
  assert.equal(Object.prototype.hasOwnProperty.call(data.items, "sichtbarer Fachtext wird ignoriert"), false);

  // 4) Extraktion veraendert die Eingabe nicht
  assert.deepEqual(snapshotTree(tree), before, "extractor must not mutate input tree");

  // 5) Ergebnis kann mit K1.3-Validator geprueft werden
  const combined = extractAndValidateLayoutData(tree, { scope: "demo.scope" });
  assert.equal(combined.validation.ok, true, "combined extraction/validation should be ok");

  // 6) unvollstaendige/ungueltige Metadaten ohne Fachlogik:
  // Leer-ID wird ignoriert, verbleibender Datensatz bleibt neutral validierbar.
  const badTree = createNode({}, [
    createNode({ "data-ui-inspector-id": "", "data-ui-editor-editable": "true" }, []),
    createNode({ "data-ui-inspector-id": "demo.footer", "data-ui-editor-editable": "maybe" }, []),
  ]);
  const badData = extractLayoutDataFromDom(badTree);
  assert.equal(Object.prototype.hasOwnProperty.call(badData.items, ""), false, "empty IDs are ignored");
  assert.equal(Object.prototype.hasOwnProperty.call(badData.items, "demo.footer"), true);
  const badValidation = validateLayoutData(badData);
  assert.equal(badValidation.ok, true, "no fachlogik fallback, result remains neutrally valid");

  console.log("TESTS OK: layout-data-extractor");
}

run();
