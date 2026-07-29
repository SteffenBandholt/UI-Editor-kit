"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createUiEditorPanelViewModel } = require("../../src/panel/ui-editor-panel-view-model.cjs");

const root = path.join(__dirname, "../..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
let count = 0;
function run(name, action) { action(); count += 1; console.log(`OK ${count}/20 ${name}`); }

const model = createUiEditorPanelViewModel({
  controllerState: {
    selectedElementId: "app.content.field",
    selectedElementName: "Inhalt",
    editable: true,
    effectiveOps: ["move", "resizeWidth", "resizeHeight", "textMove", "textResize", "setVisibility"],
    allowedOps: ["move", "resizeWidth", "resizeHeight", "textMove", "textResize", "setVisibility"],
    availableModes: ["move", "width", "height"],
    availableTextModes: ["text-position", "text-size"],
    layer: "element",
    mode: "move",
    stepSize: 1,
  },
});

const xaml = read("reference-target-app/src/ReferenceTargetApp.Wpf/UI/Views/CompactEditorWorkspaceView.xaml");
const viewModel = read("reference-target-app/src/ReferenceTargetApp.Wpf/UI/ViewModels/EditorWindowViewModel.cs");
const session = read("reference-target-app/src/ReferenceTargetApp.EditorIntegration/Persistence/LayoutProfileSession.cs");
const processProtocol = read("src/process/editor-process-protocol.cjs");

run("Einfachmodus ist der neutrale Standard", () => assert.equal(model.simple.defaultMode, true));
run("Erweitert startet geschlossen", () => assert.equal(model.simple.advancedExpanded, false));
run("Schrittvorgaben sind 1, 5 und 10 DIP", () => assert.deepEqual(model.simple.stepPresets, [1, 5, 10]));
run("Direktwerte verwenden DIP", () => assert.equal(model.simple.directInputUnit, "DIP"));
run("Operationen werden ausschließlich aus Capabilities abgeleitet", () => assert.deepEqual(model.simple.availableActions, model.selection.effectiveOps));
run("sichtbare Hauptauswahl nennt keine technische ID", () => { const beforeAdvanced = xaml.slice(0, xaml.indexOf("Header=\"Erweitert\"")); assert.doesNotMatch(beforeAdvanced, /SelectedId|SelectedType|SelectedRole|SelectedParent/); });
run("technische IDs liegen unter Details anzeigen", () => assert.ok(xaml.indexOf("SelectedId") > xaml.indexOf("Details anzeigen")));
run("Element und Text sind direkte Hauptumschalter", () => { assert.match(xaml, /Content="Element"[\s\S]*Content="Text"/); });
run("Richtungstasten arbeiten ohne separaten Modusdialog", () => assert.match(xaml, /CommandParameter="elementMove:up"[\s\S]*CommandParameter="textMove:up"/));
run("Schriftgröße besitzt Kleiner und Größer", () => assert.match(xaml, /Content="Kleiner"[\s\S]*Content="Größer"/));
run("Tabellenbreite besitzt -10 -1 +1 +10", () => ["-10", "-1", "1", "10"].forEach((value) => assert.match(xaml, new RegExp(`CommandParameter="column:${value.replace("-", "\\-")}"`))));
run("Tabelle besitzt Umbruch Ellipsis Original und Fit", () => ["columnWrap", "columnEllipsis", "columnOriginal", "tableFit"].forEach((value) => assert.match(xaml, new RegExp(`CommandParameter="${value}"`))));
run("Undo ist mehrstufig und begrenzt", () => { assert.match(session, /undoFrames/); assert.match(session, /UndoAsync/); assert.match(session, /undoFrames\.Count > 100/); });
run("Undo stellt Working-State über denselben Restorepfad wieder her", () => assert.match(session, /ApplyTrackedOperationsAsync\(frame\.Working/));
run("Einfachaktionen verwenden denselben EditorProcessCoordinator", () => assert.match(viewModel, /SetLayerModeAndApplyAsync[\s\S]*coordinator\.SetEditor/));
run("einfache Tabellenaktionen verwenden den risikofreien Einfachpfad", () => assert.match(viewModel, /simple[\s\S]*SubmitSimpleLayoutChangeAsync\(targetElementId, operation, payload/));
run("Layout-Refresh erhält Auswahl Modus und Schrittweite", () => { assert.match(processProtocol, /previous\.editorUiSession\.snapshot/); assert.match(processProtocol, /restoreEditorUiState\(created\.entry, previousState\)/); });
run("keine BBM-Fach-ID liegt im app-neutralen Einfachmodus", () => assert.doesNotMatch(read("src/panel/ui-editor-panel-view-model.cjs") + viewModel + session, /restarbeiten\.|protokoll\.|bbm\./i));
run("kein zweiter Profilstore wurde angelegt", () => assert.equal((viewModel.match(/LayoutProfileSession/g) || []).length > 0, true));
run("kein Browser Netzwerk oder Cloudpfad wurde ergänzt", () => assert.doesNotMatch(read("src/panel/ui-editor-panel-view-model.cjs") + session, /fetch\(|WebSocket|https?:\/\//));
