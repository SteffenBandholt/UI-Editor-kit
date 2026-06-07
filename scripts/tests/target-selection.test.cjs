#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const MODULE_PATH = path.join(REPO_ROOT, "src/core/target-selection.cjs");
const {
  DEFAULT_TARGET_ATTRIBUTE_NAME,
  SELECTED_TARGET_ATTRIBUTE_NAME,
  createTargetSelectionController,
} = require(MODULE_PATH);
const { createEditorUiState } = require(path.join(REPO_ROOT, "src/core/editor-ui-state.cjs"));

function createFakeDocument() {
  const createNode = (tag, doc) => {
    const listeners = {};
    const node = {
      tagName: String(tag || "").toUpperCase(),
      ownerDocument: doc,
      parentElement: null,
      parentNode: null,
      children: [],
      attributes: {},
      style: {},
      appendChild(child) {
        if (child) {
          child.parentElement = this;
          child.parentNode = this;
          this.children.push(child);
        }
        return child;
      },
      append(...children) {
        children.forEach((child) => this.appendChild(child));
      },
      setAttribute(name, value) {
        this.attributes[String(name)] = String(value);
      },
      getAttribute(name) {
        return Object.prototype.hasOwnProperty.call(this.attributes, String(name))
          ? this.attributes[String(name)]
          : null;
      },
      addEventListener(type, handler) {
        listeners[type] ||= [];
        listeners[type].push(handler);
      },
      removeEventListener(type, handler) {
        if (!listeners[type]) return;
        listeners[type] = listeners[type].filter((entry) => entry !== handler);
      },
      dispatchEvent(event = {}) {
        const normalizedEvent = event;
        const type = String(normalizedEvent.type || "");
        for (const handler of listeners[type] || []) handler.call(this, normalizedEvent);
        return !normalizedEvent.defaultPrevented;
      },
      closest(selector) {
        const attributeMatch = String(selector || "").match(/^\[([A-Za-z_][A-Za-z0-9_.:-]*)\]$/u);
        if (!attributeMatch) return null;
        let current = this;
        while (current) {
          if (current.getAttribute?.(attributeMatch[1]) !== null) return current;
          current = current.parentElement || current.parentNode || null;
        }
        return null;
      },
    };
    return node;
  };

  const doc = {
    createElement(tag) {
      return createNode(tag, doc);
    },
  };
  doc.body = createNode("body", doc);
  return doc;
}

function createEvent(target) {
  return {
    type: "click",
    target,
    preventDefault() {
      this.defaultPrevented = true;
    },
    stopPropagation() {
      this.stopped = true;
    },
  };
}

function createRegistry() {
  return {
    uiScope: "workspace.primary",
    elements: [
      { id: "workspace.root", name: "Workspace", type: "root", role: "layout", parentId: null },
      { id: "workspace.toolbar", name: "Toolbar", type: "toolbar", role: "layout", parentId: "workspace.root" },
      { id: "workspace.toolbar.action", name: "Action", type: "button", role: "action", parentId: "workspace.toolbar" },
      { id: "workspace.content.text", name: "Text", type: "field", role: "content", parentId: "workspace.root" },
    ],
  };
}

function assertNoForbiddenFragments(sourceText) {
  const forbiddenFragments = [
    "querySelectorAll",
    "localStorage",
    "sessionStorage",
    "ipc",
    "preload",
    "sqlite",
    "postgres",
    "mysql",
    ["B", "BM"].join(""),
    ["Rest", "arbeiten"].join(""),
    ["Proto", "koll"].join(""),
  ];

  forbiddenFragments.forEach((fragment) => {
    assert.equal(sourceText.includes(fragment), false, `target-selection enthaelt verbotenen Fragmenttext: ${fragment}`);
  });
}

function run() {
  assert.equal(DEFAULT_TARGET_ATTRIBUTE_NAME, "data-ui-editor-id");
  assert.equal(SELECTED_TARGET_ATTRIBUTE_NAME, "data-ui-editor-selected");

  {
    const doc = createFakeDocument();
    const uiState = createEditorUiState();
    const selections = [];
    const controller = createTargetSelectionController({
      document: doc,
      root: doc.body,
      activeScopeId: "workspace.primary",
      registryResolver: (scopeId) => {
        assert.equal(scopeId, "workspace.primary");
        return createRegistry();
      },
      uiState,
      onSelectionChange: (selection) => selections.push(selection),
    });
    const target = doc.createElement("button");
    target.setAttribute("data-ui-editor-id", "workspace.toolbar.action");
    doc.body.appendChild(target);

    assert.equal(controller.install(), true);
    doc.body.dispatchEvent(createEvent(target));

    assert.equal(uiState.getState().selectedElementId, "workspace.toolbar.action");
    assert.equal(controller.getSelection().element.name, "Action");
    assert.equal(target.getAttribute("data-ui-editor-selected"), "true");
    assert.equal(target.style.outline.includes("#2563eb"), true);
    assert.equal(selections.length, 1);
    assert.equal(selections[0].elementId, "workspace.toolbar.action");
  }

  {
    const doc = createFakeDocument();
    const controller = createTargetSelectionController({
      root: doc.body,
      activeScopeId: "workspace.primary",
      registry: createRegistry(),
    });
    const parent = doc.createElement("div");
    parent.setAttribute("data-ui-editor-id", "workspace.content.text");
    const child = doc.createElement("span");
    parent.appendChild(child);
    doc.body.appendChild(parent);

    controller.install();
    doc.body.dispatchEvent(createEvent(child));

    assert.equal(parent.getAttribute("data-ui-editor-selected"), "true");
    assert.equal(child.getAttribute("data-ui-editor-selected"), null);
    assert.equal(controller.getSelection().elementId, "workspace.content.text");
  }

  {
    const doc = createFakeDocument();
    const uiState = createEditorUiState();
    const controller = createTargetSelectionController({
      root: doc.body,
      activeScopeId: "workspace.primary",
      registry: createRegistry(),
      uiState,
    });
    const known = doc.createElement("div");
    known.setAttribute("data-ui-editor-id", "workspace.toolbar");
    known.style.outline = "1px solid red";
    known.style.boxShadow = "none";
    const next = doc.createElement("div");
    next.setAttribute("data-ui-editor-id", "workspace.content.text");
    const unknown = doc.createElement("div");
    unknown.setAttribute("data-ui-editor-id", "workspace.unknown");
    const withoutId = doc.createElement("div");
    doc.body.append(known, next, unknown, withoutId);

    controller.install();
    doc.body.dispatchEvent(createEvent(known));
    assert.equal(known.getAttribute("data-ui-editor-selected"), "true");
    assert.equal(uiState.getState().selectedElementId, "workspace.toolbar");

    doc.body.dispatchEvent(createEvent(unknown));
    doc.body.dispatchEvent(createEvent(withoutId));
    assert.equal(controller.getSelection().elementId, "workspace.toolbar");
    assert.equal(unknown.getAttribute("data-ui-editor-selected"), null);
    assert.equal(withoutId.getAttribute("data-ui-editor-selected"), null);

    doc.body.dispatchEvent(createEvent(next));
    assert.equal(known.getAttribute("data-ui-editor-selected"), "false");
    assert.equal(known.style.outline, "1px solid red");
    assert.equal(known.style.boxShadow, "none");
    assert.equal(next.getAttribute("data-ui-editor-selected"), "true");
    assert.equal(uiState.getState().selectedElementId, "workspace.content.text");
  }

  {
    const doc = createFakeDocument();
    const controller = createTargetSelectionController({
      root: doc.body,
      activeScopeId: "workspace.primary",
      registry: createRegistry(),
      targetAttributeName: "data-editor-target",
    });
    const target = doc.createElement("button");
    target.setAttribute("data-editor-target", "workspace.toolbar.action");
    doc.body.appendChild(target);

    controller.install();
    doc.body.dispatchEvent(createEvent(target));

    assert.equal(controller.targetAttributeName, "data-editor-target");
    assert.equal(controller.getSelection().elementId, "workspace.toolbar.action");
    assert.equal(target.getAttribute("data-ui-editor-selected"), "true");
  }

  {
    const doc = createFakeDocument();
    const controller = createTargetSelectionController({
      root: doc.body,
      activeScopeId: "workspace.primary",
      registry: createRegistry(),
    });
    const target = doc.createElement("div");
    target.setAttribute("data-ui-editor-id", "workspace.toolbar");
    doc.body.appendChild(target);

    controller.install();
    doc.body.dispatchEvent(createEvent(target));
    assert.equal(controller.getSelection().elementId, "workspace.toolbar");
    assert.equal(controller.uninstall(), true);
    assert.equal(controller.getSelection().elementId, null);
    assert.equal(target.getAttribute("data-ui-editor-selected"), "false");
  }

  const sourceText = fs.readFileSync(MODULE_PATH, "utf8");
  assertNoForbiddenFragments(sourceText);

  console.log("TESTS OK: target-selection");
}

run();
