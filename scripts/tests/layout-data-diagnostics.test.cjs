#!/usr/bin/env node

const assert = require("assert/strict");
const { createLayoutDataDiagnostics } = require("../layout-data-diagnostics.cjs");

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
  // 1) gueltige data-ui-* Struktur -> ok true
  const validTree = createNode({}, [
    createNode({ "data-ui-inspector-id": "demo.root", "data-ui-editor-editable": "true" }, [
      createNode(
        {
          "data-ui-inspector-id": "demo.header",
          "data-ui-editor-editable": "false",
          "data-ui-editor-ops": "move,hide",
        },
        []
      ),
    ]),
  ]);

  const beforeValid = snapshotTree(validTree);
  const validReport = createLayoutDataDiagnostics(validTree, { scope: "demo.scope" });
  assert.equal(validReport.ok, true);
  assert.equal(validReport.summary.itemCount, 2);
  assert.equal(validReport.summary.errorCount, 0);
  assert.equal(validReport.summary.scope, "demo.scope");
  assert.deepEqual(snapshotTree(validTree), beforeValid, "diagnostics must not mutate input");

  // 2) ungueltige/unvollstaendige Metadaten -> ok false
  // (negative Breite via optionalem data-ui-layout-width fuehrt zu Validatorfehler)
  const invalidTree = createNode({}, [
    createNode(
      {
        "data-ui-inspector-id": "demo.content",
        "data-ui-editor-editable": "true",
        "data-ui-layout-width": "-5",
      },
      []
    ),
  ]);

  const invalidReport = createLayoutDataDiagnostics(invalidTree);
  assert.equal(invalidReport.ok, false);
  assert.equal(Array.isArray(invalidReport.errors), true);
  assert.equal(invalidReport.errors.length > 0, true);

  // 3) errors werden nachvollziehbar durchgereicht
  const negWidthError = invalidReport.errors.find((e) => e.code === "NEGATIVE_DIMENSION");
  assert.equal(Boolean(negWidthError), true);
  assert.equal(typeof negWidthError.path, "string");
  assert.equal(typeof negWidthError.message, "string");

  // 4) summary ist neutral-technisch
  assert.equal(typeof invalidReport.summary.itemCount, "number");
  assert.equal(typeof invalidReport.summary.errorCount, "number");
  assert.equal(typeof invalidReport.summary.scope, "string");
  assert.equal(typeof invalidReport.summary.version, "number");

  // 5) Eingabe wird nicht veraendert (auch im Fehlerfall)
  const beforeInvalid = snapshotTree(invalidTree);
  createLayoutDataDiagnostics(invalidTree);
  assert.deepEqual(snapshotTree(invalidTree), beforeInvalid, "invalid diagnostics must not mutate input");

  // 6) Funktion nutzt Extractor/Validator-orchestriertes Ergebnis:
  // validation-Objekt und errors sind konsistent.
  assert.equal(invalidReport.validation.ok, invalidReport.ok);
  assert.deepEqual(invalidReport.validation.errors, invalidReport.errors);

  console.log("TESTS OK: layout-data-diagnostics");
}

run();
