#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const {
  createUiScopeFingerprint,
  loadTargetStartupLayout,
  validateTargetStartupLayoutProfile,
} = require("../../src/index.cjs");

const root = path.resolve(__dirname, "../..");
let count = 0;
function check(name, action) { action(); count += 1; process.stdout.write(`OK ${count}/36 ${name}\n`); }

function registry() {
  return [{
    scopeId: "app.edit.root", status: "complete", elements: [
      { id: "app.edit.root", name: "Eingabebereich", type: "root", role: "scopeRoot", parentId: null, editable: true, allowedOps: ["resizeHeight"], lockedOps: [], baseline: { minHeight: 190, maxHeight: 520 } },
      { id: "app.edit.group", name: "Kurze Beschreibung", type: "fieldGroup", role: "formFieldGroup", parentId: "app.edit.root", editable: true, allowedOps: ["move", "resizeWidth"], lockedOps: [], baseline: { minWidth: 120, maxWidth: 800 }, geometry: { maximumOffset: 80 }, selectionKind: "group", operationEffects: { move: "groupWithChildren", resizeWidth: "groupWithChildren" } },
      { id: "app.edit.label", name: "Beschriftung Kurze Beschreibung", type: "label", role: "fieldLabel", parentId: "app.edit.group", editable: true, allowedOps: ["textMove", "textResize", "setVisibility"], lockedOps: [], selectionKind: "label", operationEffects: { textMove: "elementOnly", textResize: "elementOnly", setVisibility: "elementOnly" } },
    ],
  }];
}

function profile(scopes) {
  return {
    schemaVersion: 2, applicationId: "app", profileId: "standard", savedAt: "2026-07-27T20:00:00.000Z",
    scopes: [{ scopeId: "app.edit.root", registryFingerprint: createUiScopeFingerprint(scopes[0]), explicitOperations: { "app.edit.root": ["resizeHeight"] }, layoutState: { elements: [
      { elementId: "app.edit.root", scopeId: "app.edit.root", height: 276 },
      { elementId: "app.edit.group", scopeId: "app.edit.root", x: 0, y: 0, width: 320 },
      { elementId: "app.edit.label", scopeId: "app.edit.root", textOffsetX: 0, textOffsetY: 0, fontSize: 14, visible: true },
    ] } }],
  };
}

async function run() {
  const selection = await import(pathToFileURL(path.join(root, "dist/direct-selection-contract.mjs")));
  const scopes = registry();
  const saved = profile(scopes);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "ui-editor-m82-1-"));
  try {
    check("Startprofilvalidator akzeptiert Schema 2", () => assert.equal(validateTargetStartupLayoutProfile(saved, { applicationId: "app", profileId: "standard", activeScopes: ["app.edit.root"], registryScopes: scopes }).ok, true));
    check("Fingerprint ist deterministisch", () => assert.equal(createUiScopeFingerprint(scopes[0]), createUiScopeFingerprint(structuredClone(scopes[0]))));
    check("Fingerprint ist sha256", () => assert.match(createUiScopeFingerprint(scopes[0]), /^sha256:[a-f0-9]{64}$/));
    check("Fehlendes Profil bedeutet Baseline", () => assert.equal(loadTargetStartupLayout({ profileRoot: temp, applicationId: "app", activeScopes: ["app.edit.root"], registryScopes: scopes }).state, "missing"));
    check("Fehlendes Profil braucht keinen Editorprozess", () => assert.equal(loadTargetStartupLayout({ profileRoot: temp, applicationId: "app", activeScopes: ["app.edit.root"], registryScopes: scopes }).editorProcessRequired, false));
    fs.writeFileSync(path.join(temp, "standard.layout-profile.json"), JSON.stringify(saved));
    const loaded = loadTargetStartupLayout({ profileRoot: temp, applicationId: "app", activeScopes: ["app.edit.root"], registryScopes: scopes });
    check("Kompatibles Profil wird beim Zielstart geladen", () => assert.equal(loaded.ok, true));
    check("Kompatibles Profil wird gefunden", () => assert.equal(loaded.found, true));
    check("Laden markiert nicht voreilig als angewandt", () => assert.equal(loaded.applied, false));
    check("Laden startet keinen Editorprozess", () => assert.equal(loaded.editorProcessRequired, false));
    check("Profilhash ist vorhanden", () => assert.match(loaded.profileSha256, /^[A-F0-9]{64}$/));
    check("Scope wird vollständig mit expliziter Wirkung geliefert", () => {
      assert.equal(loaded.scopes[0].elements.length, 3);
      assert.deepEqual(loaded.scopes[0].explicitOperations, { "app.edit.root": ["resizeHeight"] });
    });
    check("Root-Höhe bleibt erhalten", () => assert.equal(loaded.scopes[0].elements[0].height, 276));
    check("Positionswerte bleiben erhalten", () => assert.equal(loaded.scopes[0].elements[1].x, 0));
    check("Textwerte bleiben erhalten", () => assert.equal(loaded.scopes[0].elements[2].fontSize, 14));
    const corruptPath = path.join(temp, "standard.layout-profile.json");
    fs.writeFileSync(corruptPath, "{");
    const corrupt = loadTargetStartupLayout({ profileRoot: temp, applicationId: "app", activeScopes: ["app.edit.root"], registryScopes: scopes });
    check("Defektes JSON wird abgewiesen", () => assert.equal(corrupt.ok, false));
    check("Defektes JSON wird als corrupt klassifiziert", () => assert.equal(corrupt.state, "corrupt"));
    check("Recovery-Marker wird atomar erzeugt", () => assert.equal(fs.existsSync(corrupt.recoveryMarkerPath), true));
    fs.writeFileSync(corruptPath, JSON.stringify({ ...saved, scopes: [{ ...saved.scopes[0], registryFingerprint: "sha256:old" }] }));
    const incompatible = loadTargetStartupLayout({ profileRoot: temp, applicationId: "app", activeScopes: ["app.edit.root"], registryScopes: scopes });
    check("Inkompatibler Fingerprint wird abgewiesen", () => assert.equal(incompatible.ok, false));
    check("Inkompatibler Fingerprint wird klassifiziert", () => assert.equal(incompatible.state, "incompatible"));
    check("Inkompatibles Profil wird nicht angewandt", () => assert.equal(incompatible.applied, false));
    fs.writeFileSync(corruptPath, JSON.stringify(saved));
    loadTargetStartupLayout({ profileRoot: temp, applicationId: "app", activeScopes: ["app.edit.root"], registryScopes: scopes });
    check("Kompatibler Folgelauf entfernt Recovery-Marker", () => assert.equal(fs.existsSync(path.join(temp, "startup-profile-recovery.json")), false));
    const chain = selection.createDirectSelectionHierarchy(scopes[0].elements, "app.edit.label");
    check("Direktauswahl beginnt am Element", () => assert.equal(chain[0].entry.id, "app.edit.label"));
    check("Direktauswahl enthält die Gruppe", () => assert.equal(chain[1].entry.id, "app.edit.group"));
    check("Auswahlebenen heißen verständlich", () => assert.deepEqual(chain.map((item) => item.level), ["Element", "Gruppe"]));
    check("Unbekannte ID ergibt keine geratenen Treffer", () => assert.deepEqual(selection.createDirectSelectionHierarchy(scopes[0].elements, "missing"), []));
    check("Tab wechselt vorwärts", () => assert.equal(selection.cycleDirectSelectionIndex(0, 2), 1));
    check("Tab rotiert am Ende", () => assert.equal(selection.cycleDirectSelectionIndex(1, 2), 0));
    check("Shift-Tab wechselt rückwärts", () => assert.equal(selection.cycleDirectSelectionIndex(0, 2, true), 1));
    check("Leere Auswahl hat Index -1", () => assert.equal(selection.cycleDirectSelectionIndex(0, 0), -1));
    check("Elementrahmen ist durchgezogen", () => assert.equal(selection.directSelectionFramePresentation("Element").lineStyle, "solid"));
    check("Gruppenrahmen ist gestrichelt", () => assert.equal(selection.directSelectionFramePresentation("Gruppe").lineStyle, "dashed"));
    check("Bereichsrahmen ist doppelt", () => assert.equal(selection.directSelectionFramePresentation("Bereich").lineStyle, "double"));
    check("Gruppenbeschreibung nennt Kinderzahl", () => assert.match(selection.describeDirectSelection(chain[1], 3), /3 Elemente/));
    check("Erlaubte Gruppenwirkung wird beschrieben", () => assert.equal(selection.validateLayoutEffect(scopes[0].elements[1], "move").effectScope, "groupWithChildren"));
    check("Gruppenwirkung warnt über Mehrfachwirkung", () => assert.equal(selection.validateLayoutEffect(scopes[0].elements[1], "move").affectsMultiple, true));
    check("Nicht erlaubte Operation wird gesperrt", () => assert.equal(selection.validateLayoutEffect(scopes[0].elements[2], "move").ok, false));
    assert.equal(count, 36);
    console.log("TESTS OK: M82.1 Startprofil, direkte Auswahl und Layout-Wirkungsgrenzen (36/36)");
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
