"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createUiEditorPanelViewModel } = require("../../src/panel/ui-editor-panel-view-model.cjs");
const { createUiEditorPanelController } = require("../../src/index.cjs");
const { setup } = require("../../test/m70-test-helpers.cjs");

const root = path.join(__dirname, "../..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
let count = 0;
function run(name, action) { action(); count += 1; console.log(`OK ${count}/31 ${name}`); }
async function runAsync(name, action) { await action(); count += 1; console.log(`OK ${count}/31 ${name}`); }

const operations = ["move", "textResize", "setVisibility"];
const model = createUiEditorPanelViewModel({
  controllerState: {
    selectedElementId: "target.scope.remaining",
    selectedElementName: "Restzeichenanzeige",
    editable: true,
    allowedOps: operations,
    effectiveOps: operations,
    availableModes: ["move"],
    availableTextModes: ["text-size"],
    layer: "text",
    mode: "text-size",
    stepSize: 1,
  },
});

const xaml = read("reference-target-app/src/ReferenceTargetApp.Wpf/UI/Views/CompactEditorWorkspaceView.xaml");
const viewModel = read("reference-target-app/src/ReferenceTargetApp.Wpf/UI/ViewModels/EditorWindowViewModel.cs");
const session = read("reference-target-app/src/ReferenceTargetApp.EditorIntegration/Persistence/LayoutProfileSession.cs");
const core = read("src/panel/ui-editor-panel-view-model.cjs");

async function main() {
run("Einfachmodus uebernimmt ausschliesslich die gelieferten Capabilities", () => assert.deepEqual(model.simple.availableActions, operations));
run("Breite wird ohne Capability nicht angeboten", () => assert.equal(model.simple.availableActions.includes("resizeWidth"), false));
run("Hoehe wird ohne Capability nicht angeboten", () => assert.equal(model.simple.availableActions.includes("resizeHeight"), false));
run("Schriftgroesse und Sichtbarkeit bleiben verfuegbar", () => { assert.equal(model.simple.availableActions.includes("textResize"), true); assert.equal(model.simple.availableActions.includes("setVisibility"), true); });
run("nicht unterstuetzte Groessenzeilen sind capability-gesteuert ausgeblendet", () => { assert.match(xaml, /ShowSimpleElementSize, Converter=\{StaticResource BoolToVisibility\}/); assert.match(xaml, /ShowSimpleDirectSize, Converter=\{StaticResource BoolToVisibility\}/); });
run("Schriftaktionen sind nur bei textResize sichtbar und bei vorhandenem Istwert aktiv", () => { assert.match(xaml, /ShowSimpleFontSize, Converter=\{StaticResource BoolToVisibility\}[\s\S]*?CommandParameter="fontSize:left" IsEnabled="\{Binding CanSimpleFontSize\}"[\s\S]*?CommandParameter="fontSize:right" IsEnabled="\{Binding CanSimpleFontSize\}"/); assert.match(xaml, /SimpleFontSizeLabel/); });
run("direkte Schriftgroesse ist nur bei textResize sichtbar", () => assert.match(xaml, /ShowSimpleDirectFontSize, Converter=\{StaticResource BoolToVisibility\}[\s\S]*?CommandParameter="fontSize"/));
run("kompaktes Textziel wird ohne BBM-Sonderfall aus Capabilities erkannt", () => assert.match(viewModel, /IsSimpleInlineTextTarget\s*=>\s*CanSimpleMove && ShowSimpleFontSize && !CanSimpleTextMove && !CanSimpleWidth && !CanSimpleHeight && !IsTableTarget/));
run("Steuerkreuz nutzt textMove oder den freigegebenen Elementoffset", () => { assert.match(xaml, /Text\/Anzeige verschieben[\s\S]*?CanSimpleDisplayMove/); assert.match(viewModel, /if \(CanSimpleTextMove\)[\s\S]*else if \(IsSimpleInlineTextTarget\) await SetLayerModeAndApplyAsync\("element", "move"/); });
run("direkte X- und Y-Werte bleiben an move gebunden", () => { assert.match(xaml, /ShowSimpleDirectPosition[\s\S]*?CommandParameter="x"[\s\S]*?CanSimpleMove[\s\S]*?CommandParameter="y"/); assert.match(viewModel, /case "x" when CanSimpleMove:[\s\S]*HostAdapterOperations\.Move/); });
run("Sichtbarkeit bleibt an setVisibility gebunden", () => { assert.match(viewModel, /CanChangeVisibility[\s\S]*HostAdapterOperations\.SetVisibility/); assert.match(xaml, /CommandParameter="visibility" IsEnabled="\{Binding CanChangeVisibility\}"/); });
run("erfolgreiche Einfachaenderung aktiviert Undo und Dirty ueber die vorhandene Session", () => { assert.match(viewModel, /layoutSession\.CommitUndoFrame\(\);[\s\S]*RaiseUndoChanged\(\)/); assert.match(session, /IsDirty/); });
run("blockierte Operation erzeugt keinen Undo-Frame", () => assert.match(viewModel, /if \(!undoCommitted\) layoutSession\.CancelUndoFrame\(\)/));
run("Core bleibt ziel-app-neutral und erzeugt keine Registry", () => { assert.doesNotMatch(core + viewModel, /restarbeiten\.|protokoll\.|bbm\./i); assert.doesNotMatch(core, /registerElement|createRegistry/); });
run("M82.7.4 Move-Gruppe folgt ausschliesslich der move-Capability", () => assert.match(viewModel, /ShowSimpleMove\s*=>\s*CanSimpleMove/));
run("M82.7.4 Move-Gruppe wird capability-gesteuert vollstaendig ein- oder ausgeblendet", () => assert.match(xaml, /StackPanel Visibility="\{Binding ShowSimpleMove, Converter=\{StaticResource BoolToVisibility\}\}"[\s\S]*?Text="Element verschieben"[\s\S]*?CommandParameter="elementMove:down"/));
run("M82.7.4 Groessenbereich existiert nur fuer mindestens eine Groessencapability", () => assert.match(viewModel, /ShowSimpleElementSize\s*=>\s*CanSimpleWidth \|\| CanSimpleHeight/));
run("M82.7.4 Breitenbedienung folgt ausschliesslich resizeWidth oder resize", () => { assert.match(viewModel, /CanSimpleWidth\s*=>\s*HasOperation\(HostAdapterOperations\.ResizeWidth\) \|\| HasOperation\(HostAdapterOperations\.Resize\)/); assert.match(xaml, /CommandParameter="elementWidth:left"[^>]*Visibility="\{Binding CanSimpleWidth/); });
run("M82.7.4 Hoehenbedienung folgt ausschliesslich resizeHeight oder resize", () => { assert.match(viewModel, /CanSimpleHeight\s*=>\s*HasOperation\(HostAdapterOperations\.ResizeHeight\) \|\| HasOperation\(HostAdapterOperations\.Resize\)/); assert.match(xaml, /CommandParameter="elementHeight:up"[^>]*Visibility="\{Binding CanSimpleHeight/); });
run("M82.7.4 Sichtbarkeit folgt ausschliesslich setVisibility", () => { assert.match(viewModel, /ShowSimpleVisibility\s*=>\s*HasOperation\(HostAdapterOperations\.SetVisibility\)/); assert.match(xaml, /CommandParameter="visibility"[^>]*Visibility="\{Binding ShowSimpleVisibility/); });
run("M82.7.4 Capability-Kombinationen bleiben voneinander unabhaengig", () => { const visible = (ops) => ({ move: ops.includes("move"), size: ops.some((item) => ["resize", "resizeWidth", "resizeHeight"].includes(item)), width: ops.some((item) => ["resize", "resizeWidth"].includes(item)), height: ops.some((item) => ["resize", "resizeHeight"].includes(item)), visibility: ops.includes("setVisibility") }); assert.deepEqual(visible(["resizeWidth", "setVisibility"]), { move: false, size: true, width: true, height: false, visibility: true }); assert.deepEqual(visible(["move", "resizeHeight"]), { move: true, size: true, width: false, height: true, visibility: false }); });
run("M82.7.4 gemeinsamer Capability-Weg enthaelt keine BBM-Kennung", () => assert.doesNotMatch(viewModel + xaml, /restarbeiten\.|protokoll\.|bbm\./i));
run("M82.7.4 Dirty-, Undo- und Save-Vertrag bleibt unveraendert", () => { assert.match(viewModel, /SaveCommand = new AsyncCommand\([^\n]*IsDirty\)/); assert.match(viewModel, /layoutSession\.CommitUndoFrame\(\)/); assert.match(session, /IsDirty/); });

const { registry, host, runtime } = setup();
const controller = createUiEditorPanelController({ runtime, registry });
controller.selectElement("demo.card");
controller.setMode("move");
await runAsync("aktiver Move-Button kann zehnmal hintereinander kumulativ ausgeloest werden", async () => { controller.setStepSize(5); for (let index = 0; index < 10; index += 1) await controller.activateDirection("left"); assert.equal(host.dump()["demo.card"].x, -50); });
await runAsync("wiederholte Gegenrichtung erreicht exakt den Ausgangswert", async () => { for (let index = 0; index < 10; index += 1) await controller.activateDirection("right"); assert.equal(host.dump()["demo.card"].x, 0); });
await runAsync("Schrittweiten 1 und 10 bauen jeweils auf dem aktuellen Wert auf", async () => { controller.setStepSize(1); for (let index = 0; index < 3; index += 1) await controller.activateDirection("right"); controller.setStepSize(10); for (let index = 0; index < 2; index += 1) await controller.activateDirection("right"); assert.equal(host.dump()["demo.card"].x, 23); });
await runAsync("freie Schrittweite bleibt wiederholt kumulativ", async () => { controller.setStepSize(7); for (let index = 0; index < 3; index += 1) await controller.activateDirection("down"); assert.equal(host.dump()["demo.card"].y, 21); });
run("Positionsanzeige wird nach jedem Ergebnis aus dem aktuellen State aktualisiert", () => assert.match(viewModel, /ApplyState\(outcome\.State\);[\s\S]*RefreshLayoutStatus\(\)/));
run("erfolgreiche Bewegung meldet Anzeigename und kumulierten Alt-Neu-Wert", () => { assert.match(viewModel, /DescribeSuccessfulChange\(outcome\.Result, SelectedName/); assert.match(viewModel, /X: \{result\.PreviousState\.X:G\} → \{result\.NewState\.X:G\}/); assert.doesNotMatch(viewModel.match(/private static string DescribeSuccessfulChange[\s\S]*?\n    \}/)?.[0] || "", /result\.ElementId/); });
run("technische Ziel-App-Grenze erscheint im Hauptstatus", () => { assert.match(viewModel, /ShowTechnicalFailure\(outcome\.Result\);\s*StatusMessage = ErrorMessage;/); assert.match(viewModel, /string\.IsNullOrWhiteSpace\(result\.Message\)[\s\S]*result\.Message/); });
run("wirkungslose oder blockierte Aenderung erzeugt weder Dirty noch Undo", () => assert.match(viewModel, /else if \(!LayoutStatesDiffer\(outcome\.Result\.PreviousState, outcome\.Result\.NewState\)\)[\s\S]*else\s*\{[\s\S]*layoutSession\.CommitUndoFrame\(\)/));

assert.equal(count, 31);
console.log("TESTS OK: M82.7.1 bis M82.7.4 capability-gesteuerter Einfachmodus (31/31)");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
