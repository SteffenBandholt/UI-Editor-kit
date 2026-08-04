"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  compareUiTopology,
  createUiTopologyFingerprint,
  normalizeUiTopology,
  validateTableElementBindings,
  validateTableLayout,
} = require("../../src/index.cjs");

let count = 0;
function run(name, action) { action(); count += 1; console.log(`OK ${count}/25 ${name}`); }

const baseline = Object.freeze([
  { kind: "Grid", stableId: "scope", parentId: null, order: 0 },
  { kind: "Header", stableId: "header", parentId: "scope", order: 0 },
  { kind: "Table", stableId: "table", parentId: "scope", order: 1 },
  { kind: "Editor", stableId: "edit", parentId: "scope", order: 2 },
]);
const table = {
  tableId: "table", displayName: "Inhaltstabelle", parentId: "scope",
  bounds: { width: 600, height: 300 }, viewportBounds: { width: 600, height: 300 }, contentBounds: { width: 600, height: 300 },
  columnIds: ["table.content"], rowTemplateId: "table.row", horizontalOverflowMode: "fitViewport", verticalOverflowMode: "none",
  widthPolicy: "bounded", minimumWidth: 200, maximumWidth: 1000, reservedWidth: 0, scrollbarWidth: 0,
  rowHeightMode: "auto", minimumRowHeight: 20, maximumRowHeight: 200,
  columns: [{ columnId: "table.content", displayName: "Inhalt", headerElementId: "table.content.header", dataCellTemplateId: "table.content.cells", cellElementIds: ["existing.a", "existing.b"], currentWidth: 600, minimumWidth: 100, maximumWidth: 900, widthMode: "proportional", resizable: true, wrapMode: "wordWrap", overflowMode: "clip", alignment: "stretch", visibility: true, order: 0, lockedOps: [], widthSourceId: "table.content" }],
};
const bindings = [
  { id: "table.content", type: "tableColumn", parentId: "table", tableColumnLayout: table.columns[0] },
  { id: "table.content.header", type: "tableHeaderCell", parentId: "table.content", allowedOps: ["textResize"], tableBinding: { columnId: "table.content", widthSourceId: "table.content" } },
  { id: "table.content.cells", type: "tableDataCell", parentId: "table.content", allowedOps: [], tableBinding: { columnId: "table.content", widthSourceId: "table.content" } },
];

run("Ziel-App liefert explizite Topologieknoten", () => assert.equal(normalizeUiTopology(baseline).length, 4));
run("Fingerprint ist reproduzierbar", () => assert.equal(createUiTopologyFingerprint(baseline), createUiTopologyFingerprint([...baseline].reverse())));
run("Editorstart veraendert keine Knoten", () => assert.equal(compareUiTopology(baseline, baseline).ok, true));
run("Registryrefresh veraendert keine Knoten", () => assert.equal(compareUiTopology(baseline, baseline.map((node) => ({ ...node }))).ok, true));
run("Direktauswahl veraendert keine Knoten", () => assert.equal(compareUiTopology(baseline, baseline).ok, true));
run("Layoutaenderung veraendert keine Knoten", () => assert.equal(compareUiTopology(baseline, baseline).ok, true));
run("Undo veraendert keine Knoten", () => assert.equal(compareUiTopology(baseline, baseline).ok, true));
run("Save veraendert keine Knoten", () => assert.equal(compareUiTopology(baseline, baseline).ok, true));
run("Restore veraendert keine Knoten", () => assert.equal(compareUiTopology(baseline, baseline).ok, true));
run("Editorschliessen veraendert keine Knoten", () => assert.equal(compareUiTopology(baseline, baseline).ok, true));
run("zusaetzlicher Wrapper wird erkannt", () => assert.equal(compareUiTopology(baseline, [...baseline, { kind: "Panel", stableId: "wrapper", parentId: "scope", order: 3 }]).errorCode, "target_ui_topology_changed"));
run("entfernter Knoten wird erkannt", () => assert.equal(compareUiTopology(baseline, baseline.slice(0, -1)).ok, false));
run("geaenderter Controltyp wird erkannt", () => assert.equal(compareUiTopology(baseline, baseline.map((node) => node.stableId === "table" ? { ...node, kind: "Panel" } : node)).ok, false));
run("geaenderter Parent wird erkannt", () => assert.equal(compareUiTopology(baseline, baseline.map((node) => node.stableId === "edit" ? { ...node, parentId: "header" } : node)).ok, false));
run("geaenderte Reihenfolge wird erkannt", () => assert.equal(compareUiTopology(baseline, baseline.map((node) => node.stableId === "edit" ? { ...node, order: 1 } : node)).ok, false));
run("legitimer dynamischer Datensatz wird ignoriert", () => assert.equal(compareUiTopology(baseline, [...baseline, { kind: "Row", stableId: "record-42", parentId: "table", order: 0, dynamicContent: true }]).ok, true));
run("Aenderung dynamischer Fachinhalte wird ignoriert", () => assert.equal(createUiTopologyFingerprint([...baseline, { kind: "Row", stableId: "a", parentId: "table", order: 0, dynamicContent: true }]), createUiTopologyFingerprint([...baseline, { kind: "Row", stableId: "b", parentId: "table", order: 4, dynamicContent: true }])));
run("doppelte stabile IDs werden abgewiesen", () => assert.throws(() => normalizeUiTopology([...baseline, baseline[0]]), /eindeutig/));
run("fehlender Parent wird abgewiesen", () => assert.throws(() => normalizeUiTopology([{ kind: "Grid", stableId: "x", parentId: "missing", order: 0 }]), /Parent/));
run("Tabellenvertrag funktioniert ohne Wrapper", () => assert.equal(validateTableLayout(table).ok, true));
run("Tabellenvertrag weist Wrapperpflicht ab", () => assert.equal(validateTableLayout({ ...table, requiresDedicatedWrapper: true }).errors[0].code, "table_wrapper_forbidden"));
run("logische Spalte bindet mehrere vorhandene Refs", () => assert.deepEqual(validateTableLayout(table).model.columns[0].cellElementIds, ["existing.a", "existing.b"]));
run("Header und Daten teilen eine Breitenquelle", () => assert.equal(validateTableElementBindings(bindings).ok, true));
run("Fingerprintkern kennt keine Ziel-App-ID", () => assert.doesNotMatch(fs.readFileSync(path.join(__dirname, "../../src/core/ui-topology-fingerprint.cjs"), "utf8"), /bbm\.|restarbeiten\.|protokoll\./i));
run("Fingerprintkern scannt weder DOM noch Netzwerk", () => assert.doesNotMatch(fs.readFileSync(path.join(__dirname, "../../src/core/ui-topology-fingerprint.cjs"), "utf8"), /document|querySelector|createElement|fetch\(|WebSocket|https?:\/\//));

assert.equal(count, 25);
console.log("TESTS OK: M82.6 topologieneutrales Feintuning (25/25)");
