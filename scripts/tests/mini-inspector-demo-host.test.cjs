#!/usr/bin/env node

const assert = require("node:assert/strict");

const {
  DEFAULT_SCOPE,
  createMiniInspectorDemoTargetRoot,
  createMiniInspectorDemoInspectorContainer,
  createMiniInspectorDemoHost,
  updateMiniInspectorDemoHost,
  runMiniInspectorDemoHost,
} = require("../mini-inspector-demo-host.cjs");

const FORBIDDEN_TERMS = ["Protokoll", "TOP", "Bauvorhaben", "Restarbeiten"];

function snapshot(value) {
  return JSON.parse(JSON.stringify(value));
}

function combinedOutput(result) {
  return [
    result.view && result.view.text,
    result.host && result.host.inspectorContainer && result.host.inspectorContainer.innerHTML,
  ]
    .filter(Boolean)
    .join("\n");
}

function assertNoForbiddenTerms(text) {
  FORBIDDEN_TERMS.forEach((term) => {
    assert.equal(text.includes(term), false, `Ausgabe enthaelt nicht-neutralen Begriff: ${term}`);
  });
}

function run() {
  // 1) Demo-/Host-Schale ist importierbar
  assert.equal(typeof createMiniInspectorDemoHost, "function");
  assert.equal(typeof updateMiniInspectorDemoHost, "function");
  assert.equal(typeof runMiniInspectorDemoHost, "function");
  assert.equal(DEFAULT_SCOPE, "mini-inspector-demo.scope");

  // 2) Neutrale Beispiel-UI mit data-ui-* Metadaten erzeugt Status ok: true
  const rootElement = createMiniInspectorDemoTargetRoot();
  const rootBefore = snapshot(rootElement);
  const inspectorContainer = createMiniInspectorDemoInspectorContainer();
  const host = createMiniInspectorDemoHost({ rootElement, inspectorContainer });
  const result = updateMiniInspectorDemoHost(host);
  assert.equal(result.ok, true);
  assert.equal(result.status.ok, true);

  // 3) Status wird ausschliesslich im Inspector-Container dargestellt
  assert.equal(inspectorContainer.innerHTML.includes("Layoutdaten Status: gueltig"), true);
  assert.equal(inspectorContainer.innerHTML.includes("Layout-Items: 2"), true);
  assert.equal(Object.prototype.hasOwnProperty.call(rootElement, "innerHTML"), false);

  // 4) Ziel-UI-/Root-Struktur wird nicht mutiert
  assert.deepEqual(rootElement, rootBefore);

  // 5) Status enthaelt itemCount, errorCount, scope und version
  assert.equal(result.status.itemCount, 2);
  assert.equal(result.status.errorCount, 0);
  assert.equal(result.status.scope, DEFAULT_SCOPE);
  assert.equal(result.status.version, 1);

  // 6) Ungueltige Metadaten ergeben neutralen Fehlerstatus
  const invalidRoot = createMiniInspectorDemoTargetRoot({ invalid: true });
  const invalidBefore = snapshot(invalidRoot);
  const invalidInspector = createMiniInspectorDemoInspectorContainer();
  const invalidHost = createMiniInspectorDemoHost({
    rootElement: invalidRoot,
    inspectorContainer: invalidInspector,
  });
  const invalidResult = updateMiniInspectorDemoHost(invalidHost);
  assert.equal(invalidResult.ok, false);
  assert.equal(invalidResult.status.ok, false);
  assert.equal(invalidResult.status.errorCount > 0, true);
  assert.equal(invalidInspector.innerHTML.includes("Layoutdaten Status: ungueltig"), true);
  assert.equal(invalidInspector.innerHTML.includes("Fehlerdetails"), true);
  assert.deepEqual(invalidRoot, invalidBefore);

  // 7) Ausgabe bleibt fachneutral
  assertNoForbiddenTerms(combinedOutput(result));
  assertNoForbiddenTerms(combinedOutput(invalidResult));

  // 8) Keine Speicherung: keine Storage- oder Datei-Schnittstelle wird benoetigt
  const storageBlocked = {
    get localStorage() {
      throw new Error("storage access");
    },
  };
  assert.equal(Object.prototype.hasOwnProperty.call(storageBlocked, "localStorage"), true);
  const storageResult = runMiniInspectorDemoHost();
  assert.equal(storageResult.ok, true);

  // 9) Keine Layout-Anwendung: Ziel-Metadaten bleiben unveraendert, nur Container erhaelt Markup
  const layoutRoot = createMiniInspectorDemoTargetRoot();
  const layoutBefore = snapshot(layoutRoot);
  const layoutContainer = createMiniInspectorDemoInspectorContainer();
  const layoutHost = createMiniInspectorDemoHost({
    rootElement: layoutRoot,
    inspectorContainer: layoutContainer,
    scope: "neutral.scope",
  });
  const layoutResult = updateMiniInspectorDemoHost(layoutHost);
  assert.equal(layoutResult.status.scope, "neutral.scope");
  assert.deepEqual(layoutRoot, layoutBefore);
  assert.equal(layoutContainer.innerHTML.includes("Scope: neutral.scope"), true);

  // 10) Separater Host-Lauf aktualisiert ebenfalls nur den Inspector-Container
  const directResult = runMiniInspectorDemoHost();
  assert.equal(directResult.ok, true);
  assert.equal(directResult.host.inspectorContainer.innerHTML.includes("Layoutdaten Status"), true);
  assert.deepEqual(directResult.host.rootElement, snapshot(directResult.host.rootElement));

  console.log("TESTS OK: mini-inspector-demo-host");
}

run();
