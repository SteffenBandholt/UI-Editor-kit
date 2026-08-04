"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  TABLE_ELEMENT_TYPES,
  validateTableLayout,
  validateTableElementBindings,
  measureTableLayout,
  fitTableToViewport,
  updateTableColumn,
} = require("../../src/core/table-layout-contract.cjs");
const {
  createUiScopeFingerprint,
  validateTargetStartupLayoutProfile,
} = require("../../src/electron-target/layout-profile-startup.cjs");
const { createSessionState } = require("../../src/runtime/session-state.cjs");

let count = 0;
function run(name, action) { action(); count += 1; console.log(`OK ${count}/41 ${name}`); }

function column(id, width, minimumWidth, extra = {}) {
  return {
    columnId: id,
    displayName: id === "description" ? "Beschreibung" : id,
    headerElementId: `table.${id}.header`,
    dataCellTemplateId: `table.${id}.cells`,
    currentWidth: width,
    minimumWidth,
    maximumWidth: 900,
    widthMode: extra.widthMode || "fixed",
    resizable: extra.resizable !== false,
    wrapMode: extra.wrapMode || "wordWrap",
    overflowMode: extra.overflowMode || "clip",
    alignment: "stretch",
    visibility: true,
    order: extra.order || 0,
    lockedOps: extra.lockedOps || [],
    widthSourceId: id,
    flexible: extra.flexible === true,
  };
}

function table(overrides = {}) {
  const columns = overrides.columns || [
    column("number", 80, 60, { resizable: true, order: 1 }),
    column("description", 700, 180, { widthMode: "proportional", flexible: true, order: 2 }),
    column("meta", 180, 120, { order: 3 }),
  ];
  return {
    tableId: "table",
    displayName: "Aufgabenliste",
    bounds: { left: 0, top: 0, width: 984, height: 400 },
    viewportBounds: { left: 0, top: 0, width: 760, height: 360 },
    contentBounds: { left: 0, top: 0, width: 984, height: 400 },
    parentId: "scope",
    columnIds: columns.map((entry) => entry.columnId),
    rowTemplateId: "table.row",
    horizontalOverflowMode: "auto",
    verticalOverflowMode: "auto",
    widthPolicy: "bounded",
    minimumWidth: 360,
    maximumWidth: 1600,
    reservedWidth: 24,
    scrollbarWidth: 0,
    rowHeightMode: "bounded",
    minimumRowHeight: 36,
    maximumRowHeight: 120,
    columns,
    ...overrides,
  };
}

function boundElements() {
  const result = [{ id: "table", type: "table", allowedOps: [] }];
  for (const item of table().columns) {
    result.push({ id: item.columnId, type: "tableColumn", parentId: "table", tableColumnLayout: item, allowedOps: ["resizeWidth"] });
    result.push({ id: item.headerElementId, type: "tableHeaderCell", parentId: item.columnId, tableBinding: { columnId: item.columnId, widthSourceId: item.columnId }, allowedOps: [] });
    result.push({ id: item.dataCellTemplateId, type: "tableDataCell", parentId: item.columnId, tableBinding: { columnId: item.columnId, widthSourceId: item.columnId }, allowedOps: [] });
  }
  return result;
}

run("Tabellenmodell unterscheidet alle Vertragstypen", () => assert.deepEqual(TABLE_ELEMENT_TYPES, ["table", "tableHeader", "tableBody", "tableRow", "tableColumn", "tableHeaderCell", "tableDataCell", "tableFooter", "tableViewport", "horizontalScrollArea"]));
run("gültige Tabelle wird akzeptiert", () => assert.equal(validateTableLayout(table()).ok, true));
run("Spalte besitzt eine eindeutige Breitenquelle", () => assert.equal(validateTableLayout(table()).model.columns[1].widthSourceId, "description"));
run("abweichende Breitenquelle wird abgewiesen", () => assert.equal(validateTableLayout(table({ columns: [column("x", 100, 40, { }), { ...column("y", 100, 40), widthSourceId: "x" }] })).ok, false));
run("Header- und Datenzelle sind an dieselbe Spalte gebunden", () => assert.equal(validateTableElementBindings(boundElements()).ok, true));
run("Zellbreite nutzt kontrolliert dieselbe registrierte Spaltenquelle", () => { const elements = boundElements(); elements.filter((entry) => ["tableHeaderCell", "tableDataCell"].includes(entry.type)).forEach((entry) => { entry.allowedOps = ["resizeWidth"]; }); assert.equal(validateTableElementBindings(elements).ok, true); });
run("fehlender Datenzellenbereich wird erkannt", () => assert.equal(validateTableElementBindings(boundElements().filter((entry) => entry.id !== "table.description.cells")).ok, false));
run("Viewportbreite wird gemessen", () => assert.equal(measureTableLayout(table()).viewportWidth, 760));
run("Spaltensumme wird gemessen", () => assert.equal(measureTableLayout(table()).columnWidth, 960));
run("reservierte Breite wird berücksichtigt", () => assert.equal(measureTableLayout(table()).reservedWidth, 24));
run("Überlauf wird korrekt berechnet", () => assert.equal(measureTableLayout(table()).overflow, 224));
run("Überlaufspalten werden benannt", () => assert.ok(measureTableLayout(table()).overflowColumnIds.includes("description")));
run("Fit erzeugt eine Vorschau", () => assert.equal(fitTableToViewport(table()).preview.action, "fitTableToViewport"));
run("Fit begrenzt Tabelle auf Viewport", () => assert.equal(fitTableToViewport(table()).fullyFitted, true));
run("feste Spalte bleibt stabil", () => assert.equal(fitTableToViewport(table()).model.columns[0].currentWidth, 80));
run("flexible Hauptspalte wird verkleinert", () => assert.ok(fitTableToViewport(table()).model.columns[1].currentWidth < 700));
run("Mindestbreite bleibt erhalten", () => assert.ok(fitTableToViewport(table()).model.columns[1].currentWidth >= 180));
run("nur ausgewählte Spalte kann verkleinert werden", () => { const result = fitTableToViewport(table(), { selectedColumnId: "description" }); assert.equal(result.model.columns[2].currentWidth, 180); });
run("nicht ausreichende Einzelspalte lässt bewussten Überlauf", () => { const constrained = table({ viewportBounds: { left: 0, top: 0, width: 600, height: 360 }, contentBounds: { left: 0, top: 0, width: 704, height: 400 }, columns: [column("number", 80, 80, { resizable: false }), column("description", 300, 280), column("meta", 300, 300, { resizable: false })] }); assert.equal(fitTableToViewport(constrained, { selectedColumnId: "description" }).fullyFitted, false); });
run("genaue Breite wird geklemmt", () => assert.equal(updateTableColumn(table(), "description", { currentWidth: 100 }).model.columns[1].currentWidth, 180));
run("Maximalbreite wird geklemmt", () => assert.equal(updateTableColumn(table(), "description", { currentWidth: 5000 }).model.columns[1].currentWidth, 900));
run("Breitenmodus proportional wird gespeichert", () => assert.equal(updateTableColumn(table(), "description", { widthMode: "proportional" }).model.columns[1].widthMode, "proportional"));
run("Textumbruch wird gespeichert", () => assert.equal(updateTableColumn(table(), "description", { wrapMode: "wordWrap" }).model.columns[1].wrapMode, "wordWrap"));
run("Ellipsis wird gespeichert", () => { const result = updateTableColumn(table(), "description", { wrapMode: "ellipsis", overflowMode: "ellipsis" }); assert.equal(result.model.columns[1].overflowMode, "ellipsis"); });
run("unbekannte Spalte wird abgewiesen", () => assert.equal(updateTableColumn(table(), "unknown", { currentWidth: 100 }).ok, false));
run("Fachdaten sind verboten", () => assert.equal(validateTableLayout({ ...table(), records: [{ recordId: 1 }] }).ok, false));
run("Spaltenreihenfolge ist verbindlich", () => assert.equal(validateTableLayout({ ...table(), columnIds: ["meta", "description", "number"] }).ok, false));
run("Zeilenhöhe ist begrenzt", () => assert.equal(validateTableLayout(table()).model.maximumRowHeight, 120));
run("Core enthält keine Ziel-App-IDs", () => assert.doesNotMatch(fs.readFileSync(path.join(__dirname, "../../src/core/table-layout-contract.cjs"), "utf8"), /restarbeiten\.|bbm\.|protokoll\./i));
run("Core enthält keinen Browser- oder Netzwerkpfad", () => assert.doesNotMatch(fs.readFileSync(path.join(__dirname, "../../src/core/table-layout-contract.cjs"), "utf8"), /fetch\(|WebSocket|https?:\/\//));

const startupColumn = {
  id: "table.description", type: "tableColumn", parentId: "table", editable: true,
  allowedOps: ["resizeWidth", "setColumnWidthMode", "setColumnWrapMode", "setColumnOverflowMode"],
  baseline: { width: 320, minWidth: 180, maxWidth: 900 },
  tableColumnLayout: column("table.description", 320, 180),
  tableBinding: { tableId: "table", columnId: "table.description", widthSourceId: "table.description", part: "column" },
};
const startupScope = { scopeId: "scope", status: "complete", elements: [startupColumn] };
function startupProfile(tableState) {
  return {
    schemaVersion: 2, applicationId: "app", profileId: "standard", savedAt: "2026-07-29T12:00:00.000Z",
    scopes: [{
      scopeId: "scope", registryFingerprint: createUiScopeFingerprint(startupScope),
      layoutState: { elements: [{ elementId: startupColumn.id, scopeId: "scope", width: 320, table: tableState }] },
    }],
  };
}
const startupOptions = { applicationId: "app", profileId: "standard", activeScopes: ["scope"], registryScopes: [startupScope] };
run("Electron-Startprofil akzeptiert persistierte Spaltenmodi", () => assert.equal(validateTargetStartupLayoutProfile(startupProfile({ tableId: "table", columnId: startupColumn.id, widthMode: "fixed", wrapMode: "wordWrap", overflowMode: "clip" }), startupOptions).ok, true));
run("Electron-Startprofil weist ungueltigen Spaltenmodus ab", () => assert.equal(validateTargetStartupLayoutProfile(startupProfile({ tableId: "table", columnId: startupColumn.id, widthMode: "domain", wrapMode: "wordWrap", overflowMode: "clip" }), startupOptions).ok, false));
run("Electron-Startprofil verlangt Tabellenstatus bei Tabellenoperation", () => assert.equal(validateTargetStartupLayoutProfile(startupProfile(null), startupOptions).ok, false));
run("kompakte UI bietet explizite Ueberlaufsteuerung", () => assert.match(fs.readFileSync(path.join(__dirname, "../../reference-target-app/src/ReferenceTargetApp.Wpf/UI/Views/CompactEditorWorkspaceView.xaml"), "utf8"), /setColumnOverflowMode:ellipsis/));
run("kompakte UI bietet Viewport-Fit mit Vorschau", () => assert.match(fs.readFileSync(path.join(__dirname, "../../reference-target-app/src/ReferenceTargetApp.Wpf/UI/Views/CompactEditorWorkspaceView.xaml"), "utf8"), /fitTableToViewport/));
run("WPF-Tabellenkern bleibt fachneutral", () => assert.doesNotMatch(fs.readFileSync(path.join(__dirname, "../../reference-target-app/src/ReferenceTargetApp.EditorIntegration/Tables/TableLayoutContract.cs"), "utf8"), /restarbeiten\.|bbm\.|protokoll\./i));
run("kompakte UI bietet schmaler, breiter und Grenzwerte", () => { const source = fs.readFileSync(path.join(__dirname, "../../reference-target-app/src/ReferenceTargetApp.Wpf/UI/Views/CompactEditorWorkspaceView.xaml"), "utf8"); for (const value of ["columnWidth:decrease", "columnWidth:increase", "columnWidth:minimum", "columnWidth:maximum"]) assert.match(source, new RegExp(value)); });
run("Header- und Datenziel bieten ganze Spalte auswaehlen", () => { const source = fs.readFileSync(path.join(__dirname, "../../reference-target-app/src/ReferenceTargetApp.Wpf/UI/Views/CompactEditorWorkspaceView.xaml"), "utf8"); assert.match(source, /Ganze Spalte ausw/); assert.match(source, /fitSelectedColumn/); });
run("Editor-Session erhaelt Laufzeitmetriken fuer ausgewaehlte Tabellenspalten", () => {
  const session = createSessionState(() => 1);
  session.begin([{ elementId: "table.description", element: { width: 320 }, table: { tableId: "table", columnId: "table.description", viewportWidth: 760, tableWidth: 984, overflow: 224, overflowColumnIds: ["table.description"] } }]);
  assert.deepEqual(session.getSessionEntries()[0].table, { tableId: "table", columnId: "table.description", viewportWidth: 760, tableWidth: 984, overflow: 224, overflowColumnIds: ["table.description"] });
});
run("kompakte UI protokolliert Tabellenoperationen am vor Readback gesicherten Ziel", () => {
  const source = fs.readFileSync(path.join(__dirname, "../../reference-target-app/src/ReferenceTargetApp.Wpf/UI/ViewModels/EditorWindowViewModel.cs"), "utf8");
  assert.match(source, /var targetElementId = elementId \?\? SelectedId;[\s\S]*RecordExplicitOperation\(targetScopeId, targetElementId, outcome\.Result\.Operation\)/);
  assert.match(source, /AffectedStates[\s\S]*RecordExplicitOperation\(affected\.ScopeId, affected\.ElementId, HostAdapterOperations\.ResizeWidth\)/);
});
run("Tabellenreset wird nicht als wiederherzustellende Layoutoperation gespeichert", () => {
  const source = fs.readFileSync(path.join(__dirname, "../../reference-target-app/src/ReferenceTargetApp.Wpf/UI/ViewModels/EditorWindowViewModel.cs"), "utf8");
  assert.match(source, /ResetTableColumn or HostAdapterOperations\.ResetTable[\s\S]*ClearExplicitOperations\(targetScopeId, targetElementId\)/);
});

assert.equal(count, 41);
console.log("TESTS OK: M82.4 Tabellenlayoutvertrag (41/41)");
