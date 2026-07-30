"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createUiEditorPanelViewModel } = require("../../src/panel/ui-editor-panel-view-model.cjs");

const root = path.join(__dirname, "../..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
let count = 0;
function run(name, action) { action(); count += 1; console.log(`OK ${count}/14 ${name}`); }

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

run("Einfachmodus uebernimmt ausschliesslich die gelieferten Capabilities", () => assert.deepEqual(model.simple.availableActions, operations));
run("Breite wird ohne Capability nicht angeboten", () => assert.equal(model.simple.availableActions.includes("resizeWidth"), false));
run("Hoehe wird ohne Capability nicht angeboten", () => assert.equal(model.simple.availableActions.includes("resizeHeight"), false));
run("Schriftgroesse und Sichtbarkeit bleiben verfuegbar", () => { assert.equal(model.simple.availableActions.includes("textResize"), true); assert.equal(model.simple.availableActions.includes("setVisibility"), true); });
run("nicht unterstuetzte Groessenzeilen sind capability-gesteuert ausgeblendet", () => { assert.match(xaml, /ShowSimpleElementSize, Converter=\{StaticResource BoolToVisibility\}/); assert.match(xaml, /ShowSimpleDirectSize, Converter=\{StaticResource BoolToVisibility\}/); });
run("Schriftaktionen sind nur bei textResize sichtbar und aktiv", () => assert.match(xaml, /CanSimpleFontSize, Converter=\{StaticResource BoolToVisibility\}[\s\S]*?CommandParameter="fontSize:left"[\s\S]*?CommandParameter="fontSize:right"/));
run("direkte Schriftgroesse ist nur bei textResize sichtbar", () => assert.match(xaml, /ShowSimpleDirectFontSize, Converter=\{StaticResource BoolToVisibility\}[\s\S]*?CommandParameter="fontSize"/));
run("kompaktes Textziel wird ohne BBM-Sonderfall aus Capabilities erkannt", () => assert.match(viewModel, /IsSimpleInlineTextTarget\s*=>\s*CanSimpleMove && CanSimpleFontSize && !CanSimpleTextMove && !CanSimpleWidth && !CanSimpleHeight && !IsTableTarget/));
run("Steuerkreuz nutzt textMove oder den freigegebenen Elementoffset", () => { assert.match(xaml, /Text\/Anzeige verschieben[\s\S]*?CanSimpleDisplayMove/); assert.match(viewModel, /if \(CanSimpleTextMove\)[\s\S]*else if \(IsSimpleInlineTextTarget\) await SetLayerModeAndApplyAsync\("element", "move"/); });
run("direkte X- und Y-Werte bleiben an move gebunden", () => { assert.match(xaml, /ShowSimpleDirectPosition[\s\S]*?CommandParameter="x"[\s\S]*?CanSimpleMove[\s\S]*?CommandParameter="y"/); assert.match(viewModel, /case "x" when CanSimpleMove:[\s\S]*HostAdapterOperations\.Move/); });
run("Sichtbarkeit bleibt an setVisibility gebunden", () => { assert.match(viewModel, /CanChangeVisibility[\s\S]*HostAdapterOperations\.SetVisibility/); assert.match(xaml, /CommandParameter="visibility" IsEnabled="\{Binding CanChangeVisibility\}"/); });
run("erfolgreiche Einfachaenderung aktiviert Undo und Dirty ueber die vorhandene Session", () => { assert.match(viewModel, /layoutSession\.CommitUndoFrame\(\);[\s\S]*RaiseUndoChanged\(\)/); assert.match(session, /IsDirty/); });
run("blockierte Operation erzeugt keinen Undo-Frame", () => assert.match(viewModel, /if \(!undoCommitted\) layoutSession\.CancelUndoFrame\(\)/));
run("Core bleibt ziel-app-neutral und erzeugt keine Registry", () => { assert.doesNotMatch(core + viewModel, /restarbeiten\.|protokoll\.|bbm\./i); assert.doesNotMatch(core, /registerElement|createRegistry/); });

assert.equal(count, 14);
console.log("TESTS OK: M82.7 capability-gesteuerter Einfachmodus (14/14)");
