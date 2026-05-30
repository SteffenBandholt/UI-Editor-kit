#!/usr/bin/env node

const assert = require("assert/strict");
const fs = require("fs");
const path = require("path");
const {
  createMiniInspectorLayoutStatus,
  formatMiniInspectorLayoutStatus,
  createMiniInspectorStatusDisplayModel,
  readMiniInspectorLayoutStatus,
  createMiniInspectorStatusViewModel,
} = require("../mini-inspector-layout-read.cjs");

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
  // 0) oeffentlicher Mini-Inspector-Einstieg ist importierbar
  assert.equal(typeof readMiniInspectorLayoutStatus, "function");
  assert.equal(typeof createMiniInspectorStatusViewModel, "function");
  assert.equal(typeof createMiniInspectorStatusDisplayModel, "function");

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
  const validStatusAlias = readMiniInspectorLayoutStatus(validRoot, { scope: "mini-inspector.scope" });
  assert.deepEqual(validStatusAlias, validStatus);
  assert.equal(validStatus.ok, true);
  assert.equal(validStatus.itemCount, 2);
  assert.equal(validStatus.errorCount, 0);
  assert.equal(validStatus.scope, "mini-inspector.scope");
  assert.equal(validStatus.version, 1);
  assert.equal(Array.isArray(validStatus.errors), true);
  const validView = formatMiniInspectorLayoutStatus(validStatus);
  const validViewAlias = createMiniInspectorStatusViewModel(validStatus);
  assert.deepEqual(validViewAlias, validView);
  const validDisplay = createMiniInspectorStatusDisplayModel(validRoot, { scope: "mini-inspector.scope" });
  assert.equal(typeof validDisplay, "object");
  assert.equal(typeof validDisplay.status, "object");
  assert.equal(typeof validDisplay.view, "object");
  assert.equal(validDisplay.status.ok, true);
  assert.equal(validDisplay.view.ok, true);
  assert.equal(validDisplay.view.lines.some((line) => line.includes("Layout-Items: 2")), true);
  assert.equal(validView.ok, true);
  assert.equal(Array.isArray(validView.lines), true);
  assert.equal(validView.lines.some((line) => line.includes("Layoutdaten gueltig: ja")), true);
  assert.equal(validView.lines.some((line) => line.includes("Layout-Items: 2")), true);
  assert.equal(validView.lines.some((line) => line.includes("Fehler: 0")), true);
  assert.equal(validView.lines.some((line) => line.includes("Scope: mini-inspector.scope")), true);
  assert.equal(validView.lines.some((line) => line.includes("Version: 1")), true);

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
  const invalidView = formatMiniInspectorLayoutStatus(invalidStatus);
  assert.equal(invalidView.ok, false);
  assert.equal(invalidView.lines.some((line) => line.includes("Layoutdaten gueltig: nein")), true);
  assert.equal(invalidView.lines.some((line) => line.includes("Fehlerdetails:")), true);
  const invalidDisplay = createMiniInspectorStatusDisplayModel(invalidRoot);
  assert.equal(invalidDisplay.status.ok, false);
  assert.equal(invalidDisplay.view.ok, false);
  assert.equal(invalidDisplay.status.errorCount > 0, true);

  // 5/6) keine Speicherung und keine Layout-Anwendung: keine Mutation der Eingabe
  assert.deepEqual(snapshotTree(validRoot), validBefore);

  // 7) keine Fachbegriffe benoetigt
  assert.equal(typeof validStatus.ok, "boolean");
  assert.equal(typeof validStatus.itemCount, "number");
  assert.equal(typeof validStatus.errorCount, "number");
  assert.equal(typeof validStatus.scope, "string");
  assert.equal(typeof validStatus.version, "number");
  assert.equal(validView.text.includes("Protokoll"), false);
  assert.equal(validView.text.includes("TOP"), false);
  assert.equal(validView.text.includes("Bauvorhaben"), false);
  assert.equal(validView.text.includes("Restarbeiten"), false);
  assert.deepEqual(snapshotTree(validRoot), validBefore);

  console.log("TESTS OK: mini-inspector-layout-read");
}

run();
