"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  EDIT_MODES, RISK_TYPES, RISK_ACTIONS, evaluateGeometryRisk, createPdfGeometryNotice,
} = require("../../src/core/geometry-risk-contract.cjs");
const {
  createUiScopeFingerprint, validateTargetStartupLayoutProfile,
} = require("../../src/electron-target/layout-profile-startup.cjs");

let count = 0;
function run(name, test) { test(); count += 1; console.log(`OK ${count}/42 ${name}`); }
const rect = (left, top, width = 20, height = 20) => ({ left, top, width, height });
const base = (overrides = {}) => ({
  operationId: "operation-1", currentBounds: rect(10, 10), targetBounds: rect(12, 10),
  target: { elementId: "app.target", displayName: "Diktatbutton", elementType: "button", bounds: rect(10, 10) },
  group: { elementId: "app.group", displayName: "Kurztext/Gegenstand", elementType: "group", bounds: rect(0, 0, 100, 100) },
  parent: { elementId: "app.parent", displayName: "Eingabebereich", elementType: "area", bounds: rect(0, 0, 120, 120) },
  editableArea: { elementId: "app.area", displayName: "Bearbeitbarer Bereich", elementType: "area", bounds: rect(0, 0, 120, 120) },
  affectedNeighbors: [], ...overrides,
});
const evalRisk = (overrides) => evaluateGeometryRisk(base(overrides));

run("Standardmodus ist geführt", () => assert.equal(evalRisk().editMode, EDIT_MODES.GUIDED));
run("Modus kann frei sein", () => assert.equal(evalRisk({ editMode: "free" }).editMode, EDIT_MODES.FREE));
run("Moduswechsel verändert Eingabegeometrie nicht", () => { const value = base(); const before = JSON.stringify(value); evaluateGeometryRisk(value); assert.equal(JSON.stringify(value), before); });
run("Auswahl ohne Zieländerung erzeugt keine Warnung", () => assert.equal(evalRisk({ targetBounds: rect(10, 10) }).hasRisks, false));
run("Parent-Reflow ist neutrale Eigenschaft", () => assert.doesNotMatch(fs.readFileSync(path.join(__dirname, "../../reference-target-app/src/ReferenceTargetApp.Wpf/UI/ViewModels/EditorWindowViewModel.cs"), "utf8"), /Achtung: Parent-Reflow/));
run("leavesGroup wird erkannt", () => assert.ok(evalRisk({ targetBounds: rect(90, 10) }).risks.some((item) => item.riskType === RISK_TYPES.LEAVES_GROUP)));
run("leavesParent wird erkannt", () => assert.ok(evalRisk({ targetBounds: rect(115, 10) }).risks.some((item) => item.riskType === RISK_TYPES.LEAVES_PARENT)));
run("entersNeighborArea wird erkannt", () => assert.ok(evalRisk({ targetBounds: rect(45, 10), affectedNeighbors: [{ elementId: "app.neighbor.area", displayName: "Verantwortlich", elementType: "area", bounds: rect(50, 0, 40, 40) }] }).risks.some((item) => item.riskType === RISK_TYPES.ENTERS_NEIGHBOR_AREA)));
run("overlapsNeighbor wird erkannt", () => assert.ok(evalRisk({ targetBounds: rect(45, 10), affectedNeighbors: [{ elementId: "app.neighbor", displayName: "Restzeichenanzeige", elementType: "label", bounds: rect(50, 10, 20, 20) }] }).risks.some((item) => item.riskType === RISK_TYPES.OVERLAPS_NEIGHBOR)));
run("leavesEditableArea wird erkannt", () => assert.ok(evalRisk({ targetBounds: rect(115, 10) }).risks.some((item) => item.riskType === RISK_TYPES.LEAVES_EDITABLE_AREA)));
run("Haupttext verwendet Anzeigenamen", () => assert.match(evalRisk({ targetBounds: rect(90, 10) }).message, /Diktatbutton.*Kurztext\/Gegenstand/));
run("technische IDs stehen nur in Details", () => { const risk = evalRisk({ targetBounds: rect(90, 10) }); assert.doesNotMatch(risk.message, /app\./); assert.equal(risk.technicalDetails.elementId, "app.target"); });
run("geführt bietet In der Gruppe halten", () => assert.ok(evalRisk({ targetBounds: rect(90, 10) }).suggestedActions.includes(RISK_ACTIONS.CLAMP_TO_GROUP)));
run("Clamp verändert keine Größe", () => { const risk = evalRisk({ targetBounds: rect(90, 10) }); assert.deepEqual([risk.clampedToGroupBounds.width, risk.clampedToGroupBounds.height], [20, 20]); });
run("Clamp verändert keine Nachbarn", () => { const neighbors = [{ elementId: "n", displayName: "N", elementType: "label", bounds: rect(50, 50) }]; const before = JSON.stringify(neighbors); evalRisk({ targetBounds: rect(90, 10), affectedNeighbors: neighbors }); assert.equal(JSON.stringify(neighbors), before); });
run("Trotzdem anwenden ist konkrete Aktion", () => assert.ok(evalRisk({ targetBounds: rect(90, 10) }).suggestedActions.includes(RISK_ACTIONS.APPLY_ANYWAY)));
run("Abbrechen ist konkrete Aktion", () => assert.ok(evalRisk({ targetBounds: rect(90, 10) }).suggestedActions.includes(RISK_ACTIONS.CANCEL)));
run("Zurück ist bei Nachbarrisiko vorhanden", () => assert.ok(evalRisk({ targetBounds: rect(45, 10), affectedNeighbors: [{ elementId: "n", displayName: "N", elementType: "label", bounds: rect(50, 10) }] }).suggestedActions.includes(RISK_ACTIONS.GO_BACK)));
run("frei erlaubt Gruppenverlassen als bestätigbares Risiko", () => { const risk = evalRisk({ editMode: "free", targetBounds: rect(90, 10) }); assert.equal(risk.riskType, RISK_TYPES.LEAVES_GROUP); assert.ok(risk.suggestedActions.includes(RISK_ACTIONS.APPLY_ANYWAY)); });
run("frei erlaubt Überlappung als bestätigbares Risiko", () => assert.ok(evalRisk({ editMode: "free", targetBounds: rect(45, 10), affectedNeighbors: [{ elementId: "n", displayName: "N", elementType: "label", bounds: rect(50, 10) }] }).suggestedActions.includes(RISK_ACTIONS.APPLY_ANYWAY)));
run("freie Position ändert Registry-Parent nicht", () => assert.equal(evalRisk({ editMode: "free", targetBounds: rect(90, 10) }).target.elementId, "app.target"));
run("freie Position ist serialisierbar", () => assert.doesNotThrow(() => JSON.stringify(evalRisk({ editMode: "free", targetBounds: rect(90, 10) }))));
run("Präferenz liegt außerhalb Layoutprofil", () => assert.match(fs.readFileSync(path.join(__dirname, "../../reference-target-app/src/ReferenceTargetApp.EditorIntegration/Persistence/EditorPreferenceStore.cs"), "utf8"), /editor-preferences\.json/));
run("negative Größe bleibt blockiert", () => assert.throws(() => evalRisk({ targetBounds: rect(10, 10, -1, 20) }), /positiver/));
run("NaN bleibt blockiert", () => assert.throws(() => evalRisk({ targetBounds: rect(Number.NaN, 10) }), /endliches/));
run("Infinity bleibt blockiert", () => assert.throws(() => evalRisk({ targetBounds: rect(Infinity, 10) }), /endliches/));
run("Fachoperationen sind nicht Teil des Vertrags", () => assert.equal(Object.values(RISK_ACTIONS).some((value) => /save|delete|domain/i.test(value)), false));
run("Readbackdetails sind technisch getrennt", () => assert.ok(Object.hasOwn(evalRisk().technicalDetails, "hostAdapterReadback")));
run("Rollbackstatus ist Vertragsbestandteil", () => assert.equal(evalRisk().technicalDetails.rollbackStatus, "guaranteed"));
run("operationId bleibt konkret", () => assert.equal(evalRisk().operationId, "operation-1"));
run("Busy wird im finally beendet", () => assert.match(fs.readFileSync(path.join(__dirname, "../../reference-target-app/src/ReferenceTargetApp.Wpf/UI/ViewModels/EditorWindowViewModel.cs"), "utf8"), /finally \{ RunOnUi\(\(\) => IsBusy = false\); \}/));
run("Vorschau hat aktuellen durchgezogenen Rahmen", () => assert.match(fs.readFileSync(path.join(__dirname, "../../reference-target-app/src/ReferenceTargetApp.EditorIntegration/HostAdapter/WpfGeometryPreviewAdorner.cs"), "utf8"), /Brushes\.Black/));
run("Vorschau hat gestricheltes Ziel", () => assert.match(fs.readFileSync(path.join(__dirname, "../../reference-target-app/src/ReferenceTargetApp.EditorIntegration/HostAdapter/WpfGeometryPreviewAdorner.cs"), "utf8"), /DashStyles\.Dash/));
run("WPF-HostAdapter bedient Vertrag", () => assert.match(fs.readFileSync(path.join(__dirname, "../../reference-target-app/src/ReferenceTargetApp.EditorIntegration/HostAdapter/WpfHostAdapter.cs"), "utf8"), /IGeometryRiskHostAdapter/));
run("Electron-HostAdapter bedient Vertrag", () => assert.match(fs.readFileSync(path.join(__dirname, "../../reference-target-app/src/ReferenceTargetApp.EditorIntegration/Electron/ElectronPipeHostAdapter.cs"), "utf8"), /IGeometryRiskHostAdapter/));
run("UI-Editor nutzt gemeinsamen Vertrag", () => assert.match(fs.readFileSync(path.join(__dirname, "../../reference-target-app/src/ReferenceTargetApp.Wpf/UI/ViewModels/EditorWindowViewModel.cs"), "utf8"), /GeometryRiskConfirmation/));
run("PDF nutzt gemeinsame Meldungsstruktur", () => assert.match(createPdfGeometryNotice({ displayName: "Titel" }).message, /Titel.*Seitenbereich/));
run("M82.1-Direktauswahlvertrag bleibt exportiert", () => assert.ok(fs.existsSync(path.join(__dirname, "../../dist/direct-selection-contract.mjs"))));
run("kein Browser- oder Netzwerkpfad", () => assert.doesNotMatch(fs.readFileSync(path.join(__dirname, "../../src/core/geometry-risk-contract.cjs"), "utf8"), /fetch\(|WebSocket|https?:\/\//));
run("keine app-spezifischen IDs im Core", () => assert.doesNotMatch(fs.readFileSync(path.join(__dirname, "../../src/core/geometry-risk-contract.cjs"), "utf8"), /restarbeiten\.|bbm\.|protokoll\./i));
const freeScope = { scopeId: "app.root", status: "complete", elements: [{
  id: "app.root", name: "Bereich", type: "root", role: "scopeRoot", parentId: null,
  editable: true, allowedOps: ["move"], lockedOps: [], geometry: { maximumOffset: 80, maximumStoredOffset: 2400 },
}] };
const freeProfile = (x) => ({
  schemaVersion: 2, applicationId: "app", profileId: "standard", savedAt: "2026-07-28T08:00:00.000Z",
  scopes: [{ scopeId: "app.root", registryFingerprint: createUiScopeFingerprint(freeScope), explicitOperations: { "app.root": ["move"] }, layoutState: { elements: [{ elementId: "app.root", scopeId: "app.root", x, y: 0 }] } }],
});
run("freie gespeicherte Position bleibt innerhalb der harten Speichergrenze startfähig", () => assert.equal(validateTargetStartupLayoutProfile(freeProfile(400), { applicationId: "app", profileId: "standard", activeScopes: ["app.root"], registryScopes: [freeScope] }).ok, true));
run("freie gespeicherte Position bleibt außerhalb der harten Speichergrenze gesperrt", () => assert.equal(validateTargetStartupLayoutProfile(freeProfile(2401), { applicationId: "app", profileId: "standard", activeScopes: ["app.root"], registryScopes: [freeScope] }).ok, false));

assert.equal(count, 42);
console.log("TESTS OK: M82.2 Geführt/Frei und Geometrierisikovertrag (42/42)");
