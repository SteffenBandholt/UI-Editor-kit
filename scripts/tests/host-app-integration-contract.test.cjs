#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const HOST_APP_INTEGRATION_PATH = path.join(REPO_ROOT, "docs", "HOST_APP_INTEGRATION.md");
const HTML_PATH = path.join(REPO_ROOT, "demo", "mini-inspector", "index.html");
const JS_PATH = path.join(REPO_ROOT, "demo", "mini-inspector", "mini-inspector-demo.js");
const ADAPTER_PATH = path.join(REPO_ROOT, "browser", "mini-inspector-host-adapter.js");
const CSS_PATH = path.join(REPO_ROOT, "demo", "mini-inspector", "mini-inspector-demo.css");
const TOKEN_CSS_PATH = path.join(REPO_ROOT, "styles", "neutral-theme-tokens.css");
const LAYOUT_API_PATH = path.join(REPO_ROOT, "scripts", "layout-data-api.cjs");
const LAYOUT_READ_PATH = path.join(REPO_ROOT, "scripts", "mini-inspector-layout-read.cjs");
const DEMO_HOST_PATH = path.join(REPO_ROOT, "scripts", "mini-inspector-demo-host.cjs");
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

function run() {
  [
    HOST_APP_INTEGRATION_PATH,
    HTML_PATH,
    JS_PATH,
    ADAPTER_PATH,
    CSS_PATH,
    TOKEN_CSS_PATH,
    LAYOUT_API_PATH,
    LAYOUT_READ_PATH,
    DEMO_HOST_PATH,
  ].forEach((filePath) => {
    assert.equal(fs.existsSync(filePath), true, `Datei fehlt: ${filePath}`);
  });

  const integrationDoc = read(HOST_APP_INTEGRATION_PATH);
  const html = read(HTML_PATH);
  const js = read(JS_PATH);
  const css = read(CSS_PATH);
  const adapter = read(ADAPTER_PATH);
  const combinedDemo = [html, js, adapter, css].join("\n");

  assert.equal(integrationDoc.includes("Ziel-UI gehoert der Host-App."), true);
  assert.equal(integrationDoc.includes("Inspector-Container gehoert dem Editor oder Inspector."), true);
  assert.equal(integrationDoc.includes("Der Editor rendert Status nur in den Inspector-Container."), true);
  assert.equal(integrationDoc.includes("Der Editor darf keine Ziel-UI veraendern."), true);
  assert.equal(integrationDoc.includes("K7.1"), true);
  assert.equal(integrationDoc.includes("browser/mini-inspector-host-adapter.js"), true);
  assert.equal(integrationDoc.includes("createMiniInspectorHostStatus(rootElement, options)"), true);
  assert.equal(integrationDoc.includes("renderMiniInspectorHostStatus(inspectorContainer, status)"), true);
  assert.equal(integrationDoc.includes("updateMiniInspectorHostAdapter(rootElement, inspectorContainer, options)"), true);

  assert.equal(html.includes('id="miniInspectorDemoTarget"'), true);
  assert.equal(html.includes('aria-label="Neutrale Beispiel-UI"'), true);
  assert.equal(html.includes('id="miniInspectorStatus"'), true);
  assert.equal(html.includes('data-mini-inspector-container="true"'), true);
  assert.equal(html.includes("data-ui-"), true);
  assert.equal(html.includes("data-ui-inspector-id"), true);
  assert.equal(html.includes('src="../../browser/mini-inspector-host-adapter.js"'), true);
  assert.equal(js.includes("window.miniInspectorHostAdapter"), true);

  assertNoTerms(integrationDoc, FORBIDDEN_TERMS, "HOST_APP_INTEGRATION");
  assertNoTerms(combinedDemo, STORAGE_TERMS, "Demo/Integration");
  assertNoTerms(combinedDemo, FILE_WRITE_PATTERNS, "Browser-Demo");

  assert.equal(adapter.includes("data-ui-layout-width"), true);
  [js, adapter].forEach((source) => {
    assert.equal(source.includes(".style.left"), false);
    assert.equal(source.includes(".style.top"), false);
    assert.equal(source.includes(".style.width"), false);
    assert.equal(source.includes(".style.height"), false);
    assert.equal(source.includes(".style.transform"), false);
  });

  console.log("TESTS OK: host-app-integration-contract");
}

run();
