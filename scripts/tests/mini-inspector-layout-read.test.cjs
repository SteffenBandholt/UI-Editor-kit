#!/usr/bin/env node

const assert = require("assert/strict");
const fs = require("fs");
const path = require("path");
const { createMiniInspectorLayoutStatus } = require("../mini-inspector-layout-read.cjs");

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
  // 1) neue Lesefunktion nutzt die oeffentliche Layoutdaten-API
  const source = fs.readFileSync(path.resolve(__dirname, "../mini-inspector-layout-read.cjs"), "utf8");
  assert.equal(source.includes("./layout-data-api.cjs"), true);
  assert.equal(source.includes("./layout-data-validator.cjs"), false);
  assert.equal(source.includes("./layout-data-extractor.cjs"), false);
  assert.equal(source.includes("./layout-data-diagnostics.cjs"), false);

  // 2) neutrale Mock-Struktur liefert gueltigen Layoutdaten-Status
  const validRoot = createNode({}, [
    createNode({ "data-ui-inspector-id": "demo.root", "data-ui-editor-editable": "true" }, [
      createNode({ "data-ui-inspector-id": "demo.header", "data-ui-editor-editable": "false" }, []),
    ]),
  ]);
  const validBefore = snapshotTree(validRoot);
  const validStatus = createMiniInspectorLayoutStatus(validRoot, { scope: "mini-inspector.scope" });
  assert.equal(validStatus.ok, true);
  assert.equal(validStatus.itemCount, 2);
  assert.equal(validStatus.errorCount, 0);
  assert.equal(validStatus.scope, "mini-inspector.scope");
  assert.equal(validStatus.version, 1);

  // 3) Elemente ohne data-ui-* bleiben fachneutral ignoriert
  const mixedRoot = createNode({}, [
    createNode({ text: "neutral text" }, []),
    createNode({ "data-ui-inspector-id": "demo.content", "data-ui-editor-editable": "true" }, []),
  ]);
  const mixedStatus = createMiniInspectorLayoutStatus(mixedRoot);
  assert.equal(mixedStatus.itemCount, 1);

  // 4) ungueltige Metadaten -> neutraler Fehlerstatus, kein Absturz
  const invalidRoot = createNode({}, [
    createNode(
      {
        "data-ui-inspector-id": "demo.footer",
        "data-ui-editor-editable": "true",
        "data-ui-layout-width": "-5",
      },
      []
    ),
  ]);
  const invalidStatus = createMiniInspectorLayoutStatus(invalidRoot);
  assert.equal(invalidStatus.ok, false);
  assert.equal(invalidStatus.errorCount > 0, true);
  assert.equal(Array.isArray(invalidStatus.errors), true);

  // 5/6) keine Speicherung und keine Layout-Anwendung: keine Mutation der Eingabe
  assert.deepEqual(snapshotTree(validRoot), validBefore);

  // 7) keine Fachbegriffe benoetigt
  assert.equal(typeof validStatus.ok, "boolean");

  console.log("TESTS OK: mini-inspector-layout-read");
}

run();
