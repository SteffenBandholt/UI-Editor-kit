"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createUiEditorPanelController } = require("../../src/index.cjs");

const root = path.join(__dirname, "../..");
let count = 0;
function run(name, action) {
  action();
  count += 1;
  console.log(`OK ${count}/10 ${name}`);
}

function fixture(initialFontSize) {
  let currentFontSize = initialFontSize;
  let applyCount = 0;
  const entry = {
    id: "generic.text.target",
    elementId: "generic.text.target",
    displayName: "Textziel",
    editable: true,
    allowedOps: ["textResize"],
    lockedOps: [],
    minFontSize: 6,
    maxFontSize: 40,
  };
  const runtime = {
    inspectElement: () => ({
      ok: true,
      currentEntry: {
        elementId: entry.id,
        element: { x: 0, y: 0, width: 100, height: 20, visible: true },
        ...(currentFontSize === undefined ? {} : { text: { fontSize: currentFontSize } }),
      },
      allowedOps: entry.allowedOps,
      effectiveOps: entry.allowedOps,
    }),
    applyChange: (changeRequest) => {
      applyCount += 1;
      currentFontSize = changeRequest.payload.text.fontSize;
      return { ok: true, changeRequest };
    },
  };
  const controller = createUiEditorPanelController({
    runtime,
    registry: { getElementById: (id) => id === entry.id ? entry : null },
    stepSize: 1,
  });
  controller.selectElement(entry.id);
  controller.setLayer("text");
  controller.setMode("text-size");
  return {
    controller,
    getCurrentFontSize: () => currentFontSize,
    setCurrentFontSize: (value) => { currentFontSize = value; },
    getApplyCount: () => applyCount,
  };
}

const current = fixture(8.667);
run("gueltiger Host-Istwert bleibt im verschachtelten Layout erhalten", () => {
  const prepared = current.controller.prepareDirectionChange("right");
  assert.equal(prepared.changeRequest.payload.text.expectedCurrentFontSize, 8.667);
});
run("Kleiner berechnet vom bestaetigten Host-Istwert", () => {
  const prepared = current.controller.prepareDirectionChange("left");
  assert.equal(prepared.changeRequest.payload.text.fontSize, 7.667);
});
run("Groesser berechnet vom bestaetigten Host-Istwert", () => {
  const prepared = current.controller.prepareDirectionChange("right");
  assert.equal(prepared.changeRequest.payload.text.fontSize, 9.667);
});
run("Zielwechsel liest den Istwert des neu inspizierten Ziels", () => {
  current.setCurrentFontSize(13.25);
  current.controller.selectElement("generic.text.target");
  assert.equal(current.controller.prepareDirectionChange("right").changeRequest.payload.text.expectedCurrentFontSize, 13.25);
});
run("Undo-Readback ersetzt den vorherigen Wunschwert", () => {
  current.setCurrentFontSize(8.667);
  current.controller.selectElement("generic.text.target");
  assert.equal(current.controller.prepareDirectionChange("left").changeRequest.payload.text.fontSize, 7.667);
});
run("Reset-Readback ersetzt den vorherigen Sitzungswert", () => {
  current.setCurrentFontSize(10);
  current.controller.selectElement("generic.text.target");
  assert.equal(current.controller.prepareDirectionChange("left").changeRequest.payload.text.fontSize, 9);
});

const missing = fixture(undefined);
run("fehlender Istwert blockiert Kleiner und Groesser verstaendlich", () => {
  const result = missing.controller.prepareDirectionChange("left");
  assert.equal(result.ok, false);
  assert.equal(result.code, "CURRENT_VALUE_UNAVAILABLE");
  assert.equal(result.details.field, "fontSize");
});
run("fehlender Istwert erreicht den Host nicht und erzeugt keine Aenderung", () => {
  const result = missing.controller.prepareDirectionChange("right");
  assert.equal(result.ok, false);
  assert.equal(missing.getApplyCount(), 0);
  assert.equal(missing.getCurrentFontSize(), undefined);
});
run("Einfachmodus zeigt denselben Istwert und deaktiviert auch die Direkteingabe", () => {
  const xaml = fs.readFileSync(path.join(root, "reference-target-app/src/ReferenceTargetApp.Wpf/UI/Views/CompactEditorWorkspaceView.xaml"), "utf8");
  assert.match(xaml, /Text="\{Binding SimpleFontSizeLabel\}"/);
  assert.match(xaml, /Text="\{Binding DirectFontSizeText\}"[^>]*IsEnabled="\{Binding CanSimpleFontSize\}"/);
});
run("gemeinsamer Istwertpfad bleibt frei von BBM-Elementkennungen", () => {
  const source = [
    "src/panel/ui-editor-panel-controller.cjs",
    "reference-target-app/src/ReferenceTargetApp.Wpf/UI/ViewModels/EditorWindowViewModel.cs",
  ].map((file) => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
  assert.doesNotMatch(source, /restarbeiten\.|protokoll\.|bbm\./i);
});

assert.equal(count, 10);
console.log("TESTS OK: M82.7.3 textResize-Istwert im Einfachmodus (10/10)");
