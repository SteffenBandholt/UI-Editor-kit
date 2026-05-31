#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const vm = require("node:vm");

const {
  DEMO_PATH,
  formatMiniInspectorBrowserDemoInfo,
} = require("../mini-inspector-browser-demo-info.cjs");
const {
  DEFAULT_SCOPE: HOST_DEFAULT_SCOPE,
  formatMiniInspectorDemoHostJson,
  runMiniInspectorDemoHost,
} = require("../mini-inspector-demo-host.cjs");

const REPO_ROOT = path.resolve(__dirname, "../..");
const DEMO_DIR = path.join(REPO_ROOT, "demo", "mini-inspector");
const HTML_PATH = path.join(DEMO_DIR, "index.html");
const JS_PATH = path.join(DEMO_DIR, "mini-inspector-demo.js");
const ADAPTER_PATH = path.join(REPO_ROOT, "browser", "mini-inspector-host-adapter.js");
const CSS_PATH = path.join(DEMO_DIR, "mini-inspector-demo.css");
const TOKEN_CSS_PATH = path.join(REPO_ROOT, "styles", "neutral-theme-tokens.css");
const FORBIDDEN_TERMS = ["Protokoll", "TOP", "Bauvorhaben", "Restarbeiten"];
const STORAGE_TERMS = ["localStorage", "sessionStorage"];
const FILE_WRITE_PATTERNS = ["writeFile", "writeFileSync", "createWriteStream"];

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function assertNoTerms(text, terms, label) {
  terms.forEach((term) => {
    assert.equal(text.includes(term), false, `${label} enthaelt verbotenen Begriff: ${term}`);
  });
}

function createElement(attributes) {
  return {
    attributes: Object.assign({}, attributes),
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
    },
    hasAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attributes, name);
    },
  };
}

function createRoot(elements) {
  return {
    querySelectorAll(selector) {
      assert.equal(selector, "[data-ui-inspector-id]");
      return elements;
    },
  };
}

function loadBrowserDemoApi() {
  const listeners = {};
  const context = {
    window: {},
    document: {
      addEventListener(name, callback) {
        listeners[name] = callback;
      },
      getElementById() {
        throw new Error("getElementById wird im Funktionstest nicht benoetigt");
      },
    },
    Number,
    Array,
    String,
  };

  vm.createContext(context);
  vm.runInContext(read(ADAPTER_PATH), context, { filename: ADAPTER_PATH });
  vm.runInContext(read(JS_PATH), context, { filename: JS_PATH });
  assert.equal(typeof listeners.DOMContentLoaded, "function");
  return context.window.miniInspectorBrowserDemo;
}

function assertStatusShape(status, scope) {
  assert.deepEqual(Object.keys(status), [
    "ok",
    "itemCount",
    "errorCount",
    "scope",
    "version",
    "errors",
  ]);
  assert.equal(typeof status.ok, "boolean");
  assert.equal(typeof status.itemCount, "number");
  assert.equal(typeof status.errorCount, "number");
  assert.equal(status.scope, scope);
  assert.equal(status.version, 1);
  assert.equal(Array.isArray(status.errors), true);
}

function run() {
  // 1) Demo-Dateien existieren.
  [HTML_PATH, JS_PATH, ADAPTER_PATH, CSS_PATH, TOKEN_CSS_PATH].forEach((filePath) => {
    assert.equal(fs.existsSync(filePath), true, `Datei fehlt: ${filePath}`);
  });

  const html = read(HTML_PATH);
  const js = read(JS_PATH);
  const css = read(CSS_PATH);
  const adapter = read(ADAPTER_PATH);
  const tokenCss = read(TOKEN_CSS_PATH);
  const combined = [html, js, adapter, css, tokenCss].join("\n");

  // 2) HTML enthaelt getrennte Beispiel-UI und getrennten Inspector-Bereich.
  assert.equal(html.includes('id="miniInspectorDemoTarget"'), true);
  assert.equal(html.includes('id="miniInspectorStatus"'), true);
  assert.equal(html.includes('data-mini-inspector-container="true"'), true);
  assert.equal(html.includes('data-ui-inspector-id="demo.kopfbereich"'), true);
  assert.equal(html.includes('data-ui-inspector-id="demo.bereich-a"'), true);
  assert.equal(html.includes('data-ui-inspector-id="demo.bereich-b"'), true);
  assert.equal(html.includes('src="../../browser/mini-inspector-host-adapter.js"'), true);

  // 3) HTML/JS/CSS bleiben frei von verbotenen Fachbegriffen.
  assertNoTerms(combined, FORBIDDEN_TERMS, "Browser-Demo");

  // 4) Demo dokumentiert die Browser-Schicht und der Info-Befehl verweist auf den Pfad.
  assert.equal(html.includes("Fachneutrale HTML-Demo"), true);
  assert.equal(html.includes("Status ausschliesslich in den separaten Inspector-Bereich"), true);
  assert.equal(DEMO_PATH, path.join("demo", "mini-inspector", "index.html"));
  assert.equal(formatMiniInspectorBrowserDemoInfo().includes(DEMO_PATH), true);

  // 5) Keine Speicherung: keine Storage- oder Datei-Schreiblogik in der statischen Demo.
  assertNoTerms(combined, STORAGE_TERMS, "Browser-Demo");
  assertNoTerms(combined, FILE_WRITE_PATTERNS, "Browser-Demo");

  // 6) CSS-Referenz enthaelt die erwarteten neutralen Tokens und Werte.
  [
    "--ui-neutral-bg",
    "--ui-neutral-panel",
    "--ui-neutral-line",
    "--ui-neutral-text",
    "--ui-neutral-muted",
    "--ui-neutral-ok",
    "--ui-neutral-error",
    "--ui-neutral-soft",
    "--ui-neutral-surface-soft",
    "--ui-neutral-border-muted",
    "--ui-neutral-shadow-soft",
    "--ui-neutral-ok-border-soft",
    "--ui-neutral-error-border-soft",
  ].forEach((tokenName) => {
    assert.equal(tokenCss.includes(tokenName), true, `Token fehlt: ${tokenName}`);
  });
  [
    "#f6f8fc",
    "#ffffff",
    "#d8deea",
    "#1f2937",
    "#5f6b7a",
    "#0f766e",
    "#b42318",
    "#eef6ff",
    "#fbfdff",
    "#9aa8bd",
    "rgba(31, 41, 55, 0.06)",
    "rgba(15, 118, 110, 0.45)",
    "rgba(180, 35, 24, 0.45)",
  ].forEach((tokenValue) => {
    assert.equal(tokenCss.includes(tokenValue), true, `Token-Wert fehlt: ${tokenValue}`);
  });
  assert.equal(css.includes('@import "../../styles/neutral-theme-tokens.css";'), true);
  assert.equal(css.includes("var(--ui-neutral-bg)"), true);
  assert.equal(css.includes("var(--ui-neutral-shadow-soft)"), true);

  // 7) Keine Layout-Anwendung auf die Ziel-UI.
  assert.equal(adapter.includes("data-ui-layout-width"), true, "Metadaten duerfen lesend ausgewertet werden");
  [js, adapter].forEach((source, index) => {
    const label = index === 0 ? "Browser-Demo" : "Browser-Host-Adapter";
    assert.equal(source.includes(".style"), false, `${label}: Keine dynamische Style-Anwendung`);
    assert.equal(source.includes("setAttribute(\"data-ui-"), false, `${label}: Keine Mutation von data-ui-* Metadaten`);
    assert.equal(source.includes("appendChild"), false, `${label}: Keine Ziel-UI-Erweiterung`);
    assert.equal(source.includes("removeChild"), false, `${label}: Keine Ziel-UI-Entfernung`);
    assert.equal(source.includes("insertBefore"), false, `${label}: Keine Ziel-UI-Umsortierung`);
  });

  // 8) Browserseitige Funktion erzeugt gueltigen Status.
  const api = loadBrowserDemoApi();
  assert.equal(api.DEFAULT_SCOPE, HOST_DEFAULT_SCOPE);
  assert.equal(typeof api.createBrowserDemoStatus, "function");
  assert.equal(typeof api.renderStatus, "function");
  assert.equal(adapter.includes("createMiniInspectorHostStatus"), true);
  assert.equal(adapter.includes("renderMiniInspectorHostStatus"), true);
  assert.equal(adapter.includes("updateMiniInspectorHostAdapter"), true);
  const root = createRoot([
    createElement({ "data-ui-inspector-id": "demo.kopfbereich", "data-ui-layout-order": "1" }),
    createElement({ "data-ui-inspector-id": "demo.bereich-a", "data-ui-layout-order": "2" }),
    createElement({ "data-ui-inspector-id": "demo.bereich-b", "data-ui-layout-order": "3" }),
  ]);
  const validStatus = api.createBrowserDemoStatus(root, { scope: "test.scope" });
  assertStatusShape(validStatus, "test.scope");
  assert.equal(validStatus.ok, true);
  assert.equal(validStatus.itemCount, 3);
  assert.equal(validStatus.errorCount, 0);
  assert.equal(validStatus.scope, "test.scope");

  // 9) Ungueltiger Demo-Zustand erzeugt neutralen Fehlerstatus.
  const invalidRoot = createRoot([
    createElement({ "data-ui-inspector-id": "demo.kopfbereich" }),
    createElement({ "data-ui-inspector-id": "demo.bereich-b", "data-demo-invalid-width": "-1" }),
  ]);
  const invalidStatus = api.createBrowserDemoStatus(invalidRoot, { invalid: true });
  assertStatusShape(invalidStatus, HOST_DEFAULT_SCOPE);
  assert.equal(invalidStatus.ok, false);
  assert.equal(invalidStatus.itemCount, 2);
  assert.equal(invalidStatus.errorCount, 1);
  assert.equal(invalidStatus.errors[0].code, "NEGATIVE_DIMENSION");

  // 10) Inspector-Ausgabe bleibt fachneutral und wird nur in den Container geschrieben.
  const inspectorContainer = {
    innerHTML: "",
    attributes: {},
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
  };
  api.renderStatus(inspectorContainer, invalidStatus);
  assert.equal(inspectorContainer.innerHTML.includes("Layoutdaten Status: ungueltig"), true);
  assert.equal(inspectorContainer.innerHTML.includes("Fehlerdetails"), true);
  assert.equal(inspectorContainer.attributes["data-status"], "error");
  assertNoTerms(inspectorContainer.innerHTML, FORBIDDEN_TERMS, "Inspector-Ausgabe");

  // 11) Browser-Demo und Node-Referenz sichern denselben neutralen Statusumfang ab.
  const nodeStatus = formatMiniInspectorDemoHostJson(runMiniInspectorDemoHost()).status;
  assertStatusShape(nodeStatus, HOST_DEFAULT_SCOPE);
  assert.deepEqual(Object.keys(nodeStatus), Object.keys(invalidStatus));
  assert.equal(js.includes('DEFAULT_SCOPE: DEFAULT_SCOPE'), true);
  assert.equal(adapter.includes('scope = typeof opts.scope === "string" ? opts.scope : DEFAULT_SCOPE'), true);

  // 12) Optionaler npm-Befehl gibt nur neutrale Pfadinformation aus.
  const packageJson = JSON.parse(read(path.join(REPO_ROOT, "package.json")));
  assert.equal(
    packageJson.scripts["mini-inspector:demo:browser"],
    "node scripts/mini-inspector-browser-demo-info.cjs"
  );
  const infoRun = spawnSync(process.execPath, [path.join(REPO_ROOT, "scripts", "mini-inspector-browser-demo-info.cjs")], {
    encoding: "utf8",
  });
  assert.equal(infoRun.status, 0);
  assert.equal(infoRun.stdout.includes(DEMO_PATH), true);
  assert.equal(infoRun.stderr, "");
  assertNoTerms(infoRun.stdout, FORBIDDEN_TERMS, "Info-Befehl");

  console.log("TESTS OK: mini-inspector-browser-demo");
}

run();
