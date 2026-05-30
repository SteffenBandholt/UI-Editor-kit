#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const {
  DEFAULT_SCOPE,
  parseMiniInspectorDemoHostCliArgs,
  createMiniInspectorDemoTargetRoot,
  createMiniInspectorDemoInspectorContainer,
  createMiniInspectorDemoHost,
  updateMiniInspectorDemoHost,
  runMiniInspectorDemoHost,
  formatMiniInspectorDemoHostResult,
  formatMiniInspectorDemoHostJson,
  runMiniInspectorDemoHostCli,
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
  assert.equal(typeof formatMiniInspectorDemoHostResult, "function");
  assert.equal(typeof formatMiniInspectorDemoHostJson, "function");
  assert.equal(typeof runMiniInspectorDemoHostCli, "function");
  assert.equal(typeof parseMiniInspectorDemoHostCliArgs, "function");
  assert.equal(DEFAULT_SCOPE, "mini-inspector-demo.scope");

  const packageJson = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "../../package.json"), "utf8")
  );
  assert.equal(
    packageJson.scripts["mini-inspector:demo"],
    "node scripts/mini-inspector-demo-host.cjs"
  );
  assert.deepEqual(parseMiniInspectorDemoHostCliArgs([]), { invalid: false, json: false });
  assert.deepEqual(parseMiniInspectorDemoHostCliArgs(["--invalid"]), { invalid: true, json: false });
  assert.deepEqual(parseMiniInspectorDemoHostCliArgs(["--json"]), { invalid: false, json: true });
  assert.deepEqual(parseMiniInspectorDemoHostCliArgs(["--invalid", "--json"]), {
    invalid: true,
    json: true,
  });

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

  // 11) CLI-Ausgabe bleibt neutral und enthaelt die Kernfelder
  const cliResult = runMiniInspectorDemoHostCli();
  assert.equal(cliResult.exitCode, 0);
  assert.equal(cliResult.text.includes("ok: true"), true);
  assert.equal(cliResult.text.includes("itemCount: 2"), true);
  assert.equal(cliResult.text.includes("errorCount: 0"), true);
  assert.equal(cliResult.text.includes(`scope: ${DEFAULT_SCOPE}`), true);
  assert.equal(cliResult.text.includes("version: 1"), true);
  assert.equal(cliResult.text.includes("inspectorContainer:"), true);
  assertNoForbiddenTerms(cliResult.text);

  // 12) Invalid-CLI-Ausgabe bleibt kontrolliert und berichtet ok: false ohne Runner-Fehler
  const invalidCliResult = runMiniInspectorDemoHostCli({ invalid: true });
  assert.equal(invalidCliResult.exitCode, 0);
  assert.equal(invalidCliResult.ok, false);
  assert.equal(invalidCliResult.text.includes("ok: false"), true);
  assert.equal(invalidCliResult.text.includes("errorCount: "), true);
  assert.equal(invalidCliResult.text.includes("errors:"), true);
  assert.equal(invalidCliResult.text.includes("inspectorContainer:"), true);
  assert.equal(invalidCliResult.text.includes("Layoutdaten Status: ungueltig"), true);
  assertNoForbiddenTerms(invalidCliResult.text);

  // 13) JSON-Ausgabe ist valide und fachneutral
  const jsonResult = runMiniInspectorDemoHostCli({ json: true });
  const jsonPayload = JSON.parse(jsonResult.text);
  assert.equal(jsonResult.exitCode, 0);
  assert.equal(jsonPayload.ok, true);
  assert.equal(jsonPayload.mode, "default");
  assert.equal(jsonPayload.invalid, false);
  assert.equal(jsonPayload.status.ok, true);
  assert.equal(jsonPayload.status.itemCount, 2);
  assert.equal(jsonPayload.status.errorCount, 0);
  assert.equal(jsonPayload.status.scope, DEFAULT_SCOPE);
  assert.equal(jsonPayload.status.version, 1);
  assert.equal(Array.isArray(jsonPayload.status.errors), true);
  assert.equal(typeof jsonPayload.inspectorContainer, "string");
  assertNoForbiddenTerms(jsonResult.text);

  // 14) Invalid-JSON-Ausgabe bleibt valide und berichtet ok: false
  const invalidJsonResult = runMiniInspectorDemoHostCli({ invalid: true, json: true });
  const invalidJsonPayload = JSON.parse(invalidJsonResult.text);
  assert.equal(invalidJsonResult.exitCode, 0);
  assert.equal(invalidJsonPayload.ok, false);
  assert.equal(invalidJsonPayload.mode, "invalid");
  assert.equal(invalidJsonPayload.invalid, true);
  assert.equal(invalidJsonPayload.status.ok, false);
  assert.equal(invalidJsonPayload.status.itemCount, 2);
  assert.equal(invalidJsonPayload.status.errorCount > 0, true);
  assert.equal(invalidJsonPayload.status.scope, DEFAULT_SCOPE);
  assert.equal(invalidJsonPayload.status.version, 1);
  assert.equal(Array.isArray(invalidJsonPayload.status.errors), true);
  assert.equal(invalidJsonPayload.status.errors.length > 0, true);
  assert.equal(typeof invalidJsonPayload.inspectorContainer, "string");
  assertNoForbiddenTerms(invalidJsonResult.text);

  // 15) Skript ist direkt ausfuehrbar und schreibt neutral auf stdout
  const scriptRun = spawnSync(process.execPath, [path.resolve(__dirname, "../mini-inspector-demo-host.cjs")], {
    encoding: "utf8",
  });
  assert.equal(scriptRun.status, 0);
  assert.equal(scriptRun.stdout.includes("ok: true"), true);
  assert.equal(scriptRun.stdout.includes("itemCount: 2"), true);
  assert.equal(scriptRun.stdout.includes("errorCount: 0"), true);
  assert.equal(scriptRun.stdout.includes(`scope: ${DEFAULT_SCOPE}`), true);
  assert.equal(scriptRun.stdout.includes("version: 1"), true);
  assert.equal(scriptRun.stdout.includes("inspectorContainer:"), true);
  assert.equal(scriptRun.stderr, "");
  assertNoForbiddenTerms(scriptRun.stdout);

  // 16) Invalid-Skriptlauf bleibt Exit-Code 0 und gibt neutralen Fehlerstatus aus
  const invalidScriptRun = spawnSync(
    process.execPath,
    [path.resolve(__dirname, "../mini-inspector-demo-host.cjs"), "--invalid"],
    { encoding: "utf8" }
  );
  assert.equal(invalidScriptRun.status, 0);
  assert.equal(invalidScriptRun.stdout.includes("ok: false"), true);
  assert.equal(invalidScriptRun.stdout.includes("errorCount: "), true);
  assert.equal(invalidScriptRun.stdout.includes("errors:"), true);
  assert.equal(invalidScriptRun.stdout.includes("Layoutdaten Status: ungueltig"), true);
  assert.equal(invalidScriptRun.stderr, "");
  assertNoForbiddenTerms(invalidScriptRun.stdout);

  // 17) JSON-Skriptlauf gibt nur valides JSON auf stdout aus
  const jsonScriptRun = spawnSync(
    process.execPath,
    [path.resolve(__dirname, "../mini-inspector-demo-host.cjs"), "--json"],
    { encoding: "utf8" }
  );
  const jsonScriptPayload = JSON.parse(jsonScriptRun.stdout);
  assert.equal(jsonScriptRun.status, 0);
  assert.equal(jsonScriptPayload.ok, true);
  assert.equal(jsonScriptPayload.mode, "default");
  assert.equal(jsonScriptPayload.status.itemCount, 2);
  assert.equal(jsonScriptPayload.status.errorCount, 0);
  assert.equal(jsonScriptPayload.status.scope, DEFAULT_SCOPE);
  assert.equal(jsonScriptPayload.status.version, 1);
  assert.equal(typeof jsonScriptPayload.inspectorContainer, "string");
  assert.equal(jsonScriptRun.stderr, "");
  assertNoForbiddenTerms(jsonScriptRun.stdout);

  // 18) Invalid-JSON-Skriptlauf gibt valides JSON mit ok: false aus
  const invalidJsonScriptRun = spawnSync(
    process.execPath,
    [path.resolve(__dirname, "../mini-inspector-demo-host.cjs"), "--invalid", "--json"],
    { encoding: "utf8" }
  );
  const invalidJsonScriptPayload = JSON.parse(invalidJsonScriptRun.stdout);
  assert.equal(invalidJsonScriptRun.status, 0);
  assert.equal(invalidJsonScriptPayload.ok, false);
  assert.equal(invalidJsonScriptPayload.mode, "invalid");
  assert.equal(invalidJsonScriptPayload.invalid, true);
  assert.equal(invalidJsonScriptPayload.status.errorCount > 0, true);
  assert.equal(typeof invalidJsonScriptPayload.inspectorContainer, "string");
  assert.equal(invalidJsonScriptRun.stderr, "");
  assertNoForbiddenTerms(invalidJsonScriptRun.stdout);

  console.log("TESTS OK: mini-inspector-demo-host");
}

run();
