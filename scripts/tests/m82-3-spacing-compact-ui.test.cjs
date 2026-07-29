"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { SPACING_TARGETS, SPACING_OPERATIONS, WIDTH_FLOW_ACTIONS, normalizeSpacingValues, validateSpacingIntent } = require("../../src/core/spacing-contract.cjs");
const { RISK_TYPES, RISK_ACTIONS, evaluateGeometryRisk } = require("../../src/core/geometry-risk-contract.cjs");
const { validateTargetStartupLayoutProfile, createUiScopeFingerprint } = require("../../src/electron-target/layout-profile-startup.cjs");

const root = path.join(__dirname, "../..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
let count = 0;
function run(name, action) { action(); count += 1; console.log(`OK ${count}/35 ${name}`); }
const bounds = (left, width) => ({ left, top: 0, width, height: 24 });
const widthRisk = (groupWidthEditable = true) => evaluateGeometryRisk({
  operationId: "m82-3", operation: "resizeWidth", editMode: "guided",
  currentBounds: bounds(0, 150), targetBounds: bounds(0, 130),
  target: { elementId: "app.label", displayName: "Kurztext/Gegenstand", elementType: "label", bounds: bounds(0, 150) },
  group: { elementId: "app.group", displayName: "Kurztext/Gegenstand", elementType: "group", bounds: bounds(0, 500) },
  parent: { elementId: "app.root", displayName: "Eingabebereich", elementType: "area", bounds: bounds(0, 800) },
  affectedNeighbors: [{ elementId: "app.counter", displayName: "Restzeichenanzeige", elementType: "label", bounds: bounds(180, 30), geometryChanged: true }],
  groupWidthEditable,
});

run("Elementbreite bleibt eigene Operation", () => assert.equal(SPACING_OPERATIONS.includes("resizeWidth"), false));
run("reservierte Breite ist neutraler Spacer", () => assert.ok(SPACING_TARGETS.includes("reservedWidth")));
run("Spacer davor ist vorhanden", () => assert.ok(SPACING_TARGETS.includes("beforeElement")));
run("Spacer danach ist vorhanden", () => assert.ok(SPACING_TARGETS.includes("afterElement")));
run("Gruppenpadding links ist vorhanden", () => assert.ok(SPACING_TARGETS.includes("groupPaddingLeft")));
run("Gruppenpadding rechts ist vorhanden", () => assert.ok(SPACING_TARGETS.includes("groupPaddingRight")));
run("Spacing-Reset ist eigene Operation", () => assert.ok(SPACING_OPERATIONS.includes("spacingReset")));
run("Spacing-Werte sind reproduzierbar normalisiert", () => assert.deepEqual(normalizeSpacingValues({ reservedWidth: "20" }), { reservedWidth: 20 }));
run("negative Spacing-Werte sind gesperrt", () => assert.throws(() => normalizeSpacingValues({ reservedWidth: -1 }), /nicht negativ/));
run("unbekannte Spacing-Ziele sind gesperrt", () => assert.throws(() => normalizeSpacingValues({ bbmSpacer: 1 }), /Unbekanntes/));
run("Spacing-Payload wird validiert", () => assert.equal(validateSpacingIntent("spacingSet", { spacing: { target: "beforeElement", value: 4 } }).ok, true));
run("nicht freigegebenes Ziel wird abgelehnt", () => assert.equal(validateSpacingIntent("spacingSet", { spacing: { target: "beforeElement", value: 4 } }, ["afterElement"]).ok, false));
run("Breitenverkleinerung erkennt frei werdenden Platz", () => assert.equal(widthRisk().riskType, RISK_TYPES.FREED_SPACE));
run("Dialog nennt verständlichen Feldnamen", () => assert.match(widthRisk().message, /Kurztext\/Gegenstand.*frei werdenden Platz/));
run("technische ID bleibt außerhalb des Haupttexts", () => assert.doesNotMatch(widthRisk().message, /app\.label/));
run("Freien Platz stehen lassen ist Standardaktion", () => assert.equal(widthRisk().suggestedActions[0], RISK_ACTIONS.PRESERVE_SPACE));
run("Nachrücken ist getrennte bewusste Aktion", () => assert.ok(widthRisk().suggestedActions.includes(WIDTH_FLOW_ACTIONS.REFLOW_NEIGHBORS)));
run("Trotzdem anwenden wählt Nachrücken nicht", () => assert.equal(widthRisk().suggestedActions.includes(RISK_ACTIONS.APPLY_ANYWAY), false));
run("Gruppenverkleinerung ist getrennte Aktion", () => assert.ok(widthRisk().suggestedActions.includes(WIDTH_FLOW_ACTIONS.SHRINK_GROUP)));
run("nicht editierbare Gruppenbreite wird nicht angeboten", () => assert.equal(widthRisk(false).suggestedActions.includes(WIDTH_FLOW_ACTIONS.SHRINK_GROUP), false));
run("Vorschau enthält alte und neue Breite", () => assert.deepEqual([widthRisk().preview.currentBounds.width, widthRisk().preview.targetBounds.width], [150, 130]));
run("Nachbarn tragen verständliche Anzeigenamen", () => assert.equal(widthRisk().affectedNeighbors[0].displayName, "Restzeichenanzeige"));
run("technische Details nennen reservierte Breite", () => assert.equal(widthRisk().technicalDetails.spacingTarget, "reservedWidth"));
run("WPF-Adapter besitzt lokale Stabilitätsprüfung", () => assert.match(read("reference-target-app/src/ReferenceTargetApp.EditorIntegration/HostAdapter/WpfHostAdapter.cs"), /unexpected_neighbor_change/));
run("Electron-Adapter unterstützt betroffene Gruppenstände", () => assert.match(read("reference-target-app/src/ReferenceTargetApp.EditorIntegration/Electron/ElectronPipeHostAdapter.cs"), /AffectedStates/));
run("Spacing wird im Profil gespeichert", () => assert.match(read("reference-target-app/src/ReferenceTargetApp.EditorIntegration/Persistence/PersistedLayoutDocument.cs"), /Spacing/));
run("Spacing wird beim Start wiederhergestellt", () => assert.match(read("reference-target-app/src/ReferenceTargetApp.EditorIntegration/Persistence/LayoutRestoreCoordinator.cs"), /SpacingSet/));
run("responsive Electron-Baselines werden getrennt vom Registry-Fingerprint erfasst", () => { const source = read("src/electron-target/target-registration.cjs"); assert.match(source, /capturedBaseline[\s\S]*baselineDimensionAvailable/); assert.doesNotMatch(source.match(/function canonicalElement[\s\S]*?\n}/)?.[0] || "", /capturedBaseline/); });
run("responsive UI enthält Ein-Zwei-Drei-Modus", () => { const source = read("reference-target-app/src/ReferenceTargetApp.Wpf/UI/Views/CompactEditorWorkspaceView.xaml.cs"); assert.match(source, /width < 860 \? 1 : width < 1260 \? 2 : 3/); });
run("Aktionsleiste bleibt außerhalb des Inhaltsgrids", () => { const xaml = read("reference-target-app/src/ReferenceTargetApp.Wpf/UI/Views/CompactEditorWorkspaceView.xaml"); assert.ok(xaml.indexOf("Speichern") < xaml.indexOf("AdaptiveColumns")); });
run("Baum besitzt internen Scrollbereich", () => assert.match(read("reference-target-app/src/ReferenceTargetApp.Wpf/UI/Views/CompactEditorWorkspaceView.xaml"), /CompactElementTree[\s\S]*ScrollViewer\.VerticalScrollBarVisibility="Auto"/));
run("technische Details sind einklappbar", () => assert.match(read("reference-target-app/src/ReferenceTargetApp.Wpf/UI/Views/CompactEditorWorkspaceView.xaml"), /Expander Header="Technische Details"/));
run("PDF-Workspace verwendet dieselben Breitenstufen", () => assert.match(read("reference-target-app/src/ReferenceTargetApp.Wpf/UI/Views/EditorWindow.xaml.cs"), /e\.NewSize\.Width < 860 \? 1 : e\.NewSize\.Width < 1260 \? 2 : 3/));
run("Core enthält keine BBM-IDs", () => assert.doesNotMatch(read("src/core/spacing-contract.cjs") + read("src/core/geometry-risk-contract.cjs"), /restarbeiten\.|bbm\.|protokoll\./i));
run("kein Browser- oder Netzwerkpfad", () => assert.doesNotMatch(read("src/core/spacing-contract.cjs"), /fetch\(|WebSocket|https?:\/\//));

assert.equal(count, 35);
console.log("TESTS OK: M82.3 Spacingvertrag und kompakter Editor (35/35)");
