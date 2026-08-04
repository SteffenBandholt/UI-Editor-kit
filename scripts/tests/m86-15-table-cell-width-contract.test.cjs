#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  createRegistryFingerprint,
  resolveTableCellWidthSource,
  updateTableColumnWidthFromCell,
  validateElectronRegistryScopes,
  validateRegistrationSnapshot,
  validateTableElementBindings,
} = require("../../src/index.cjs");
const { validateUiElementList } = require("../../src/core/ui-element-validator.cjs");

const root = path.resolve(__dirname, "../..");
let count = 0;

function run(name, action) {
  action();
  count += 1;
  console.log(`OK ${count} ${name}`);
}

function baseline(overrides = {}) {
  return {
    x: 0,
    y: 0,
    width: 240,
    height: 36,
    textOffsetX: 0,
    textOffsetY: 0,
    fontSize: 12,
    visible: true,
    minWidth: 80,
    maxWidth: 600,
    minHeight: 24,
    maxHeight: 100,
    ...overrides,
  };
}

function element(id, type, parentId, role, overrides = {}) {
  const allowedOps = overrides.allowedOps || [];
  return {
    id,
    name: overrides.name || id,
    type,
    role,
    parentId,
    order: overrides.order || 0,
    visible: true,
    editable: allowedOps.length > 0,
    allowedOps,
    lockedOps: overrides.lockedOps || [],
    semanticKey: id,
    registrationStatus: allowedOps.length > 0 ? "editorEnabled" : "editorContainer",
    refKey: `ref:${id}`,
    referenceResolved: true,
    baseline: baseline(overrides.baseline),
    ...overrides,
  };
}

function columnLayout() {
  return {
    columnId: "sample.table.description",
    displayName: "Beschreibung",
    headerElementId: "sample.table.description.header",
    dataCellTemplateId: "sample.table.description.cells",
    currentWidth: 240,
    minimumWidth: 80,
    maximumWidth: 600,
    widthMode: "fixed",
    resizable: true,
    wrapMode: "wordWrap",
    overflowMode: "clip",
    alignment: "stretch",
    visibility: true,
    order: 1,
    lockedOps: [],
    widthSourceId: "sample.table.description",
    flexible: false,
  };
}

function tableLayout() {
  const column = columnLayout();
  return {
    tableId: "sample.table",
    displayName: "Beispieltabelle",
    bounds: { left: 0, top: 0, width: 240, height: 200 },
    viewportBounds: { left: 0, top: 0, width: 240, height: 200 },
    contentBounds: { left: 0, top: 0, width: 240, height: 200 },
    parentId: "sample",
    topologyPolicy: "preserveTarget",
    columnIds: [column.columnId],
    rowTemplateId: "sample.table.row",
    horizontalOverflowMode: "auto",
    verticalOverflowMode: "auto",
    widthPolicy: "bounded",
    minimumWidth: 80,
    maximumWidth: 600,
    reservedWidth: 0,
    scrollbarWidth: 0,
    rowHeightMode: "bounded",
    minimumRowHeight: 24,
    maximumRowHeight: 100,
    columns: [column],
  };
}

function tableElements() {
  const layout = tableLayout();
  const cellOps = ["move", "resizeWidth", "resizeHeight", "textResize", "setVisibility"];
  return [
    element("sample", "root", null, "scopeRoot"),
    element("sample.table", "table", "sample", "contentTable", { tableLayout: layout }),
    element("sample.table.description", "tableColumn", "sample.table", "contentColumn", {
      allowedOps: ["resizeWidth"],
      columnRole: "contentColumn",
      tableColumnLayout: layout.columns[0],
      tableBinding: { tableId: "sample.table", columnId: "sample.table.description", widthSourceId: "sample.table.description", part: "column" },
    }),
    element("sample.table.description.header", "tableHeaderCell", "sample.table.description", "tableHeaderCell", {
      allowedOps: cellOps,
      selectionKind: "tableHeaderCell",
      tableBinding: { tableId: "sample.table", columnId: "sample.table.description", widthSourceId: "sample.table.description", part: "header" },
    }),
    element("sample.table.description.cells", "tableDataCell", "sample.table.description", "tableDataCell", {
      allowedOps: cellOps,
      selectionKind: "tableDataCell",
      tableBinding: { tableId: "sample.table", columnId: "sample.table.description", widthSourceId: "sample.table.description", part: "dataCellTemplate" },
    }),
  ];
}

function scope() {
  const elements = tableElements();
  return {
    scopeId: "sample",
    status: "complete",
    inventoryStatus: "complete",
    expectedElementIds: elements.map((entry) => entry.id),
    elements,
  };
}

function snapshot() {
  const registryScopes = [scope()];
  return {
    contract: {
      applicationId: "sample-target",
      displayName: "Sample Target",
      appVersion: "1.0.0",
      framework: "electron",
      contractVersion: "1.1",
      adapterVersion: "1.1",
      registryVersion: 1,
      registryFingerprint: createRegistryFingerprint(registryScopes),
      registryStatus: "complete",
      activeScopes: ["sample"],
      supportedOperations: ["move", "resizeWidth", "resizeHeight", "textResize", "setVisibility"],
      uiCapability: "layout",
      pdfCapability: "unavailable",
      labelFieldSeparation: true,
      visibilityCapability: true,
    },
    registryScopes,
  };
}

run("tableHeaderCell akzeptiert resizeWidth bei registrierter Spaltenquelle", () => {
  const result = validateTableElementBindings(tableElements());
  assert.equal(result.ok, true, JSON.stringify(result.errors));
});

run("tableDataCell akzeptiert resizeWidth im vollstaendigen UI-Vertrag", () => {
  const result = validateUiElementList(tableElements());
  assert.equal(result.ok, true, JSON.stringify(result.errors));
});

run("Header- und Datenzelle loesen dieselbe Breitenquelle auf", () => {
  const elements = tableElements();
  const header = resolveTableCellWidthSource(elements, "sample.table.description.header");
  const data = resolveTableCellWidthSource(elements, "sample.table.description.cells");
  assert.equal(header.ok, true, JSON.stringify(header.errors));
  assert.equal(data.ok, true, JSON.stringify(data.errors));
  assert.equal(header.widthSourceId, "sample.table.description");
  assert.equal(data.widthSourceId, header.widthSourceId);
  assert.deepEqual(header.affectedElementIds, data.affectedElementIds);
});

run("Breitenaenderung wirkt nur auf die registrierte Spalte und erhaelt die Topologie", () => {
  const elements = tableElements();
  const beforeElements = structuredClone(elements);
  const beforeIds = tableLayout().columnIds.slice();
  const result = updateTableColumnWidthFromCell(elements, tableLayout(), "sample.table.description.header", 360);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.widthSourceId, "sample.table.description");
  assert.equal(result.model.columns[0].currentWidth, 360);
  assert.deepEqual(result.model.columnIds, beforeIds);
  assert.deepEqual(elements, beforeElements);
});

run("ungueltige oder ausserhalb registrierter Grenzen liegende Breite wird abgewiesen", () => {
  const elements = tableElements();
  for (const width of [Number.NaN, 0, 79, 601]) {
    assert.equal(updateTableColumnWidthFromCell(elements, tableLayout(), "sample.table.description.cells", width).ok, false, `width=${width}`);
  }
});

run("neu gerenderte Multi-Refs verwenden weiterhin die gespeicherte Spaltenbreite", () => {
  const stored = updateTableColumnWidthFromCell(tableElements(), tableLayout(), "sample.table.description.cells", 420);
  const rerendered = tableElements();
  const source = resolveTableCellWidthSource(rerendered, "sample.table.description.cells");
  assert.equal(source.ok, true);
  assert.equal(stored.model.columns.find((entry) => entry.columnId === source.widthSourceId).currentWidth, 420);
  assert.doesNotMatch(rerendered.find((entry) => entry.type === "tableDataCell").id, /record|dataset|row-\d|project/i);
});

run("Registry-Preflight akzeptiert den Vertrag und Fingerprintabweichung bleibt gesperrt", () => {
  const currentScope = scope();
  assert.equal(validateElectronRegistryScopes([currentScope], ["sample"]).ok, true);
  const valid = snapshot();
  assert.equal(validateRegistrationSnapshot(valid).ok, true, JSON.stringify(validateRegistrationSnapshot(valid).errors));
  const withoutCellWidth = structuredClone(valid.registryScopes);
  withoutCellWidth[0].elements.find((entry) => entry.type === "tableHeaderCell").allowedOps = ["move", "resizeHeight", "textResize", "setVisibility"];
  assert.notEqual(createRegistryFingerprint(withoutCellWidth), valid.contract.registryFingerprint);
  valid.contract.registryFingerprint = `sha256:${"0".repeat(64)}`;
  assert.equal(validateRegistrationSnapshot(valid).ok, false);
});

run("weitere sichtbare Zelloperationen bleiben erhalten und unbekannte Operationen bleiben gesperrt", () => {
  const elements = tableElements();
  for (const type of ["tableHeaderCell", "tableDataCell"]) {
    const cell = elements.find((entry) => entry.type === type);
    assert.deepEqual(cell.allowedOps, ["move", "resizeWidth", "resizeHeight", "textResize", "setVisibility"]);
  }
  elements.push(element("sample.card", "card", "sample", "content", {
    allowedOps: ["move", "resizeWidth", "resizeHeight", "textResize", "setVisibility"],
  }));
  assert.equal(validateUiElementList(elements).ok, true);
  elements.find((entry) => entry.type === "tableHeaderCell").allowedOps.push("inventWidth");
  assert.equal(validateUiElementList(elements).ok, false);
});

run("abweichende oder nicht registrierte Breitenquelle bleibt gesperrt", () => {
  const elements = tableElements();
  elements.find((entry) => entry.type === "tableDataCell").tableBinding.widthSourceId = "sample.table.other";
  assert.equal(validateTableElementBindings(elements).ok, false);
  const independent = tableElements();
  independent.find((entry) => entry.type === "tableHeaderCell").allowedOps.push("changeWidth");
  assert.equal(validateTableElementBindings(independent).ok, false);
  const unavailable = tableElements();
  unavailable.find((entry) => entry.type === "tableColumn").allowedOps = [];
  assert.equal(validateTableElementBindings(unavailable).ok, false);
});

run("native Electron-Validierung und ESM-Distribution enthalten keine pauschale resizeWidth-Sperre", () => {
  const source = fs.readFileSync(path.join(root, "reference-target-app/src/ReferenceTargetApp.EditorIntegration/Electron/ElectronPipeHostAdapter.cs"), "utf8");
  assert.doesNotMatch(source, /cell\.AllowedOps\.Any\(operation\s*=>\s*operation is "resize" or "resizeWidth" or "changeWidth"\)/);
  assert.match(source, /widthSourceId/);
  const distribution = fs.readFileSync(path.join(root, "dist/table-layout-contract.mjs"), "utf8");
  assert.doesNotMatch(distribution, /\["resize", "resizeWidth", "changeWidth"\]/);
  assert.match(distribution, /function resolveTableCellWidthSource/);
  assert.match(distribution, /function updateTableColumnWidthFromCell/);
});

console.log(`TESTS OK: M86.15 Tabellenzellenbreite (${count}/${count})`);
