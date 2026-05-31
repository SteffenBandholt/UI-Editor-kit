#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const REPO_ROOT = path.resolve(__dirname, "../..");
const EXAMPLE_DIR = path.join(REPO_ROOT, "examples", "host-app-basic");
const HTML_PATH = path.join(EXAMPLE_DIR, "index.html");
const JS_PATH = path.join(EXAMPLE_DIR, "host-app-basic.js");
const CSS_PATH = path.join(EXAMPLE_DIR, "host-app-basic.css");
const ADAPTER_PATH = path.join(REPO_ROOT, "browser", "mini-inspector-host-adapter.js");
const TOKEN_CSS_PATH = path.join(REPO_ROOT, "styles", "neutral-theme-tokens.css");
const FORBIDDEN_TERMS = ["Protokoll", "TOP", "Bauvorhaben", "Restarbeiten", "BBM"];
const STORAGE_TERMS = ["localStorage", "sessionStorage"];

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function assertNoTerms(text, terms, label) {
  terms.forEach((term) => {
    assert.equal(text.includes(term), false, `${label} enthaelt verbotenen Begriff: ${term}`);
  });
}

function loadExampleApi() {
  const listeners = {};
  const context = {
    window: {
      miniInspectorHostAdapter: {
        DEFAULT_SCOPE: "mini-inspector-demo.scope",
        updateMiniInspectorHostAdapter(rootElement, inspectorContainer, options) {
          return {
            ok: true,
            rootElement,
            inspectorContainer,
            options,
          };
        },
      },
    },
    document: {
      addEventListener(name, callback) {
        listeners[name] = callback;
      },
      getElementById(id) {
        if (id === "hostTargetRoot") {
          return { id };
        }
        if (id === "hostInspectorContainer") {
          return { id };
        }
        if (id === "hostInvalidToggle") {
          return { checked: false, addEventListener() {} };
        }
        return null;
      },
    },
  };

  vm.createContext(context);
  vm.runInContext(read(JS_PATH), context, { filename: JS_PATH });
  assert.equal(typeof listeners.DOMContentLoaded, "function");
  return context.window.hostAppBasic;
}

function run() {
  [HTML_PATH, JS_PATH, CSS_PATH, ADAPTER_PATH, TOKEN_CSS_PATH].forEach((filePath) => {
    assert.equal(fs.existsSync(filePath), true, `Datei fehlt: ${filePath}`);
  });

  const html = read(HTML_PATH);
  const js = read(JS_PATH);
  const css = read(CSS_PATH);
  const adapter = read(ADAPTER_PATH);
  const combined = [html, js, css, adapter].join("\n");

  assert.equal(html.includes('src="../../browser/mini-inspector-host-adapter.js"'), true);
  assert.equal(html.includes('href="../../styles/neutral-theme-tokens.css"'), true);
  assert.equal(html.includes('id="hostTargetRoot"'), true);
  assert.equal(html.includes('id="hostInspectorContainer"'), true);
  assert.equal(html.includes('data-ui-inspector-id'), true);
  assert.equal(html.includes('data-mini-inspector-container="true"'), true);
  assert.equal(js.includes("updateMiniInspectorHostAdapter"), true);
  assert.equal(js.includes("hostTargetRoot"), true);
  assert.equal(js.includes("hostInspectorContainer"), true);

  assertNoTerms(combined, FORBIDDEN_TERMS, "Host-App-Beispiel");
  assertNoTerms(combined, STORAGE_TERMS, "Host-App-Beispiel");
  assert.equal(js.includes("data-ui-layout-width"), false);
  assert.equal(js.includes(".style.width"), false);
  assert.equal(js.includes(".style.height"), false);
  assert.equal(js.includes(".style.left"), false);
  assert.equal(js.includes(".style.top"), false);

  const api = loadExampleApi();
  assert.equal(api.DEFAULT_SCOPE, "mini-inspector-demo.scope");
  assert.equal(typeof api.updateHostAppBasic, "function");

  console.log("TESTS OK: host-app-basic-example");
}

run();
