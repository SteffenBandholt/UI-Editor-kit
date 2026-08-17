"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { resizeTableColumnBoundary, validateTableColumnRuntimeMetrics, validateTableLayoutIntent } = require("../../src/core/table-layout-contract.cjs");

function column(id, displayName, width, minimumWidth, maximumWidth, order, widthMode = "fixed") {
  return {
    columnId: id, displayName, headerElementId: `${id}.header`, dataCellTemplateId: `${id}.cells`,
    currentWidth: width, minimumWidth, maximumWidth, widthMode, resizable: true,
    wrapMode: "wordWrap", overflowMode: "clip", alignment: "stretch", visibility: true,
    order, lockedOps: [], widthSourceId: id,
  };
}

function table(policy = "adjacentPreserveTotal") {
  const columns = [
    column("column-a", "Spalte A", 80, 50, 120, 1),
    column("column-b", "Spalte B", 620, 180, 800, 2, "proportional"),
    column("column-c", "Spalte C", 180, 120, 260, 3),
  ];
  return {
    tableId: "table-neutral", displayName: "Neutrale Inhaltstabelle",
    bounds: { left: 0, top: 0, width: 880, height: 300 }, viewportBounds: { left: 0, top: 0, width: 880, height: 300 },
    contentBounds: { left: 0, top: 0, width: 880, height: 300 }, parentId: "scope",
    columnIds: columns.map((entry) => entry.columnId), rowTemplateId: "table-neutral.row",
    horizontalOverflowMode: "fitViewport", verticalOverflowMode: "none", widthPolicy: "bounded",
    minimumWidth: 300, maximumWidth: 1600, reservedWidth: 0, scrollbarWidth: 0,
    rowHeightMode: "bounded", minimumRowHeight: 24, maximumRowHeight: 160,
    boundaryResizePolicy: policy, columns,
  };
}

const intent = { leftColumnId: "column-b", rightColumnId: "column-c", delta: 24 };
const result = resizeTableColumnBoundary(table(), intent);
assert.equal(result.ok, true);
assert.equal(result.model.columns[0].currentWidth, 80);
assert.equal(result.model.columns[1].currentWidth, 644);
assert.equal(result.model.columns[2].currentWidth, 156);
assert.equal(result.model.columns[1].widthMode, "proportional");
assert.equal(result.model.columns[2].widthMode, "fixed");
assert.equal(result.model.columns.reduce((sum, entry) => sum + entry.currentWidth, 0), 880);
assert.deepEqual(result.boundary, { leftColumnId: "column-b", rightColumnId: "column-c", delta: 24, leftWidth: 644, rightWidth: 156, totalWidth: 880 });
assert.equal(resizeTableColumnBoundary(table(), { ...intent, rightColumnId: "column-a" }).errors[0].code, "table_boundary_columns_not_adjacent");
assert.equal(resizeTableColumnBoundary(table(), { ...intent, delta: 70 }).errors[0].code, "table_boundary_right_minimum");
assert.equal(resizeTableColumnBoundary(table("independent"), intent).errors[0].code, "table_boundary_policy_forbidden");
assert.equal(validateTableLayoutIntent("resizeColumnBoundary", { table: intent }).ok, true);
assert.equal(validateTableLayoutIntent("resizeColumnBoundary", { table: { ...intent, delta: 0 } }).ok, false);
const runtimeMetrics = {
  columnId: "column-b", logicalWidth: 620, effectiveWidth: 644, headerWidth: 644,
  headerContentWidth: 628, dataCellWidths: [644, 644, 644], dataContentWidths: [624, 624, 624],
  mountedDataCellCount: 3,
};
assert.equal(validateTableColumnRuntimeMetrics(runtimeMetrics).ok, true);
assert.equal(validateTableColumnRuntimeMetrics({ ...runtimeMetrics, dataCellWidths: [644, 590, 644] }).errors[0].code, "table_runtime_width_mismatch");
assert.equal(validateTableColumnRuntimeMetrics({ ...runtimeMetrics, dataCellWidths: [644, 644], mountedDataCellCount: 3 }).errors[0].code, "table_runtime_data_cells_incomplete");
assert.equal(validateTableColumnRuntimeMetrics({ ...runtimeMetrics, dataContentWidths: [624, 700, 624] }).errors[0].code, "table_runtime_content_width_invalid");
assert.doesNotMatch(fs.readFileSync(path.join(__dirname, "../../src/core/table-layout-contract.cjs"), "utf8"), /bbm|protokoll|restarbeiten/i);

const uiViewModel = fs.readFileSync(path.join(__dirname, "../../reference-target-app/src/ReferenceTargetApp.Wpf/UI/ViewModels/EditorWindowViewModel.cs"), "utf8");
const pdfViewModel = fs.readFileSync(path.join(__dirname, "../../reference-target-app/src/ReferenceTargetApp.Wpf/UI/ViewModels/PdfEditorWorkspaceViewModel.cs"), "utf8");
const uiView = fs.readFileSync(path.join(__dirname, "../../reference-target-app/src/ReferenceTargetApp.Wpf/UI/Views/CompactEditorWorkspaceView.xaml"), "utf8");
const editorWindow = fs.readFileSync(path.join(__dirname, "../../reference-target-app/src/ReferenceTargetApp.Wpf/UI/Views/EditorWindow.xaml"), "utf8");
assert.match(uiViewModel, /HasTableOverview => IsTableLayout && TableColumns\.Count > 0/);
assert.match(uiViewModel, /wirksam \{EffectiveWidth:0\.###\} DIP · gespeichert \{LogicalWidth:0\.###\}/);
assert.match(uiViewModel, /Direkte Eingabe ist im proportionalen Modus nicht eindeutig/);
assert.match(pdfViewModel, /HasTableOverview => selected\?\.Kind is PdfElementKind\.Table or PdfElementKind\.TableColumn && TableColumns\.Count > 0/);
assert.match(pdfViewModel, /CanWidth => selected\?\.Kind != PdfElementKind\.TableColumn/);
assert.match(pdfViewModel, /HasDirectModes => HasElementModes \|\| HasTextModes/);
assert.match(pdfViewModel, /FriendlyTableColumnName[\s\S]*column\.Role == PdfElementRole\.Meta[\s\S]*\? "Meta rechts"/);
assert.match(uiView, /AutomationProperties\.Name="Spaltengrenze nach links"[\s\S]*CommandParameter="left"/);
assert.match(uiView, /AutomationProperties\.Name="Spaltengrenze nach rechts"[\s\S]*CommandParameter="right"/);
assert.match(uiView, /<ListBox ItemsSource="\{Binding TableBoundaries\}"[\s\S]*DisplayMemberPath="DisplayName"/);
assert.match(uiView, /Text="\{Binding StepText, UpdateSourceTrigger=PropertyChanged\}"[\s\S]*Content="Tabelle Original"/);
assert.match(uiView, /Text="\{Binding RuntimeLabel\}"/);
assert.match(uiView, /Text="\{Binding ColumnWidthInputStatus\}"/);
assert.match(editorWindow, /AutomationProperties\.Name="PDF-Spaltengrenze nach links"[\s\S]*AutomationProperties\.Name="PDF-Spaltengrenze nach rechts"/);
assert.match(editorWindow, /<ListBox ItemsSource="\{Binding TableBoundaries\}"[\s\S]*DisplayMemberPath="DisplayName"/);
assert.match(editorWindow, /Header="Bearbeitung in Millimetern" Visibility="\{Binding HasDirectModes/);
assert.match(editorWindow, /Content="R&#x00FC;ckg&#x00E4;ngig"[\s\S]*Content="Tabelle Original"/);

console.log("TESTS OK: K17 atomare, app-neutrale Spaltengrenzen-Bedienung");
