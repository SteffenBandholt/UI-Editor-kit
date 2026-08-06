"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), "utf8");

const coordinator = read("reference-target-app/src/ReferenceTargetApp.Wpf/UI/Editor/EditorWindowCoordinator.cs");
const viewModel = read("reference-target-app/src/ReferenceTargetApp.Wpf/UI/ViewModels/EditorWindowViewModel.cs");
const electronEditor = read("reference-target-app/src/ReferenceTargetApp.Wpf/UI/Editor/ElectronTargetEditor.cs");
const pipeAdapter = read("reference-target-app/src/ReferenceTargetApp.EditorIntegration/Electron/ElectronPipeHostAdapter.cs");

function run(name, test) {
  try { test(); console.log(`ok - ${name}`); }
  catch (error) { console.error(`not ok - ${name}`); throw error; }
}

run("M82.7.5 Kit 01: gemeinsamer Close-Vertrag kennt genau die vier Lebenszyklusausgaenge", () => {
  assert.match(coordinator, /enum EditorCloseDisposition[\s\S]*Unknown,[\s\S]*Clean,[\s\S]*Saved,[\s\S]*Discarded,/);
});
run("M82.7.5 Kit 02: sauberer Close wird explizit gemeldet", () => {
  assert.match(viewModel, /!IsDirty && !pdfWorkspace\.IsDirty[\s\S]*CloseDisposition = EditorCloseDisposition\.Clean/);
});
run("M82.7.5 Kit 03: Ohne Speichern wird als verworfen gemeldet", () => {
  assert.match(viewModel, /decision != UnsavedChangesDecision\.Save[\s\S]*CloseDisposition = EditorCloseDisposition\.Discarded/);
});
run("M82.7.5 Kit 04: Speichern wird erst nach erfolgreichen UI- und PDF-Saves gemeldet", () => {
  const savedIndex = viewModel.indexOf("CloseDisposition = EditorCloseDisposition.Saved");
  assert.ok(savedIndex > viewModel.indexOf("!await SaveAsync()"));
  assert.ok(savedIndex > viewModel.indexOf("!await pdfWorkspace.SaveAsync()"));
});
run("M82.7.5 Kit 05: Abbruch bleibt unbekannt und schliesst nicht", () => {
  assert.match(viewModel, /CloseDisposition = EditorCloseDisposition\.Unknown[\s\S]*UnsavedChangesDecision\.Cancel[\s\S]*return false/);
});
run("M82.7.5 Kit 06: Coordinator bewahrt die Disposition ueber Window-Cleanup hinaus", () => {
  assert.match(coordinator, /LastCloseDisposition = currentViewModel\?\.CloseDisposition \?\? EditorCloseDisposition\.Unknown/);
});
run("M82.7.5 Kit 07: Electron-Ereignis transportiert Disposition und bestätigte Save-ID als Payload", () => {
  assert.match(pipeAdapter, /SendEventAsync\("editorClosed", new \{ disposition, saveRequestId \}, cancellationToken\)/);
});
run("M82.7.5 Kit 08: Ziel-App erhaelt die normalisierte Disposition beim Sitzungsende", () => {
  assert.match(electronEditor, /LastCloseDisposition\.ToString\(\)\.ToLowerInvariant\(\)/);
  assert.match(electronEditor, /ShutdownTargetSessionAsync\(disposition, layoutSession\.LastAcknowledgedSaveRequestId\)/);
  assert.match(electronEditor, /prepareTargetClose: disposition => target\.PrepareTargetCloseAsync/);
});
run("M82.7.5 Kit 09: gemeinsame Dateien enthalten keine BBM-Element-IDs", () => {
  for (const source of [coordinator, viewModel, electronEditor, pipeAdapter]) assert.doesNotMatch(source, /restarbeiten\.|protokoll\.|bbm\./i);
});
run("M82.7.5 Kit 10: bestehender atomarer Profilstore bleibt der einzige Speicherweg", () => {
  assert.match(electronEditor, /AtomicJsonLayoutProfileStore/);
  assert.doesNotMatch(electronEditor, /writeFile|File\.Write|JsonSerializer\.Serialize/);
});
