#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const MODULE_PATH = path.join(REPO_ROOT, "src/core/target-selection.cjs");
const {
  DEFAULT_TARGET_ATTRIBUTE_NAME,
  HOVERED_TARGET_ATTRIBUTE_NAME,
  PANEL_COLLAPSED_ATTRIBUTE_NAME,
  PANEL_HIDDEN_ATTRIBUTE_NAME,
  SELECTED_TARGET_ATTRIBUTE_NAME,
  createTargetSelectionController,
  createTargetSelectionPanelController,
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
      clientWidth: 640,
      clientHeight: 480,
      offsetWidth: 120,
      offsetHeight: 40,
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
        normalizedEvent.target ||= this;
        const type = String(normalizedEvent.type || "");
        for (const handler of listeners[type] || []) handler.call(this, normalizedEvent);
        return !normalizedEvent.defaultPrevented;
      },
      getBoundingClientRect() {
        return {
          left: Number.parseFloat(this.style.left) || 0,
          top: Number.parseFloat(this.style.top) || 0,
          width: this.offsetWidth,
          height: this.offsetHeight,
        };
      },
      querySelector(selector) {
        const attributeMatch = String(selector || "").match(/^\[([A-Za-z_][A-Za-z0-9_.:-]*)="((?:\\.|[^"])*)"\]$/u);
        if (!attributeMatch) return null;
        const attributeName = attributeMatch[1];
        const attributeValue = attributeMatch[2].replace(/\\"/gu, '"').replace(/\\\\/gu, "\\");
        const pending = [this];
        while (pending.length > 0) {
          const current = pending.shift();
          if (current?.getAttribute?.(attributeName) === attributeValue) return current;
          pending.push(...(current?.children || []));
        }
        return null;
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
    _listeners: {},
    createElement(tag) {
      return createNode(tag, doc);
    },
    addEventListener(type, handler) {
      this._listeners[type] ||= [];
      this._listeners[type].push(handler);
    },
    removeEventListener(type, handler) {
      if (!this._listeners[type]) return;
      this._listeners[type] = this._listeners[type].filter((entry) => entry !== handler);
    },
    dispatchEvent(event = {}) {
      const normalizedEvent = event;
      const type = String(normalizedEvent.type || "");
      for (const handler of this._listeners[type] || []) handler.call(this, normalizedEvent);
      return !normalizedEvent.defaultPrevented;
    },
  };
  doc.documentElement = createNode("html", doc);
  doc.documentElement.clientWidth = 640;
  doc.documentElement.clientHeight = 480;
  doc.body = createNode("body", doc);
  doc.querySelector = (...args) => doc.body.querySelector(...args);
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

function createClickEvent(target, overrides = {}) {
  return {
    ...createEvent(target),
    ...overrides,
  };
}

function createPointerEvent(type, target, overrides = {}) {
  return {
    type,
    target,
    clientX: 0,
    clientY: 0,
    preventDefault() {
      this.defaultPrevented = true;
    },
    stopPropagation() {
      this.stopped = true;
    },
    ...overrides,
  };
}

function createRegistry() {
  return {
    uiScope: "workspace.primary",
    elements: [
      { id: "workspace.root", name: "Workspace", type: "root", role: "layout", parentId: null },
      { id: "workspace.toolbar", name: "Toolbar", type: "toolbar", role: "layout", parentId: "workspace.root" },
      { id: "workspace.toolbar.group", name: "Toolbar Group", type: "group", role: "layout", parentId: "workspace.toolbar" },
      { id: "workspace.toolbar.action", name: "Action", type: "button", role: "action", parentId: "workspace.toolbar.group" },
      { id: "workspace.content.text", name: "Text", type: "field", role: "content", parentId: "workspace.root" },
      { id: "workspace.content.longText", name: "Long Text", type: "field", role: "content", parentId: "workspace.content.text" },
      { id: "workspace.content.title", name: "Title", type: "field", role: "content", parentId: "workspace.content.text" },
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
  assert.equal(HOVERED_TARGET_ATTRIBUTE_NAME, "data-ui-editor-hovered");
  assert.equal(PANEL_COLLAPSED_ATTRIBUTE_NAME, "data-ui-editor-panel-collapsed");
  assert.equal(PANEL_HIDDEN_ATTRIBUTE_NAME, "data-ui-editor-panel-hidden");
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
    const hovers = [];
    const controller = createTargetSelectionController({
      root: doc.body,
      activeScopeId: "workspace.primary",
      registry: createRegistry(),
      onHoverChange: (selection) => hovers.push(selection),
    });
    const target = doc.createElement("button");
    target.setAttribute("data-ui-editor-id", "workspace.toolbar.action");
    doc.body.appendChild(target);

    controller.install();
    const pointerEvent = createPointerEvent("pointermove", target);
    doc.body.dispatchEvent(pointerEvent);

    assert.equal(controller.getHover().elementId, "workspace.toolbar.action");
    assert.equal(hovers.length, 1);
    assert.equal(hovers[0].elementId, "workspace.toolbar.action");
    assert.equal(target.getAttribute("data-ui-editor-hovered"), "true");
    assert.equal(target.style.outline.includes("dashed"), true);
    assert.equal(pointerEvent.defaultPrevented, undefined);

    doc.body.dispatchEvent(createClickEvent(target));
    assert.equal(controller.getSelection().elementId, "workspace.toolbar.action");
    assert.equal(target.getAttribute("data-ui-editor-selected"), "true");
    assert.equal(target.getAttribute("data-ui-editor-hovered"), "false");
    assert.equal(target.style.outline.includes("#2563eb"), true);
  }

  {
    const doc = createFakeDocument();
    const controller = createTargetSelectionController({
      root: doc.body,
      activeScopeId: "workspace.primary",
      registry: createRegistry(),
    });
    const group = doc.createElement("div");
    group.setAttribute("data-ui-editor-id", "workspace.toolbar.group");
    const child = doc.createElement("button");
    child.setAttribute("data-ui-editor-id", "workspace.toolbar.action");
    group.appendChild(child);
    doc.body.appendChild(group);

    controller.install();
    doc.body.dispatchEvent(createPointerEvent("pointermove", child));
    assert.equal(controller.getHover().elementId, "workspace.toolbar.action");
    assert.equal(child.getAttribute("data-ui-editor-hovered"), "true");

    doc.body.dispatchEvent(createPointerEvent("pointermove", child, { shiftKey: true }));
    assert.equal(controller.getHover().elementId, "workspace.toolbar.group");
    assert.equal(child.getAttribute("data-ui-editor-hovered"), "false");
    assert.equal(group.getAttribute("data-ui-editor-hovered"), "true");

    doc.body.dispatchEvent(createPointerEvent("pointermove", child, { altKey: true }));
    assert.equal(controller.getHover().elementId, "workspace.toolbar.group");
  }

  {
    const doc = createFakeDocument();
    const controller = createTargetSelectionController({
      root: doc.body,
      activeScopeId: "workspace.primary",
      registry: createRegistry(),
    });
    const first = doc.createElement("div");
    first.setAttribute("data-ui-editor-id", "workspace.toolbar");
    first.style.outline = "1px solid green";
    first.style.boxShadow = "none";
    first.style.position = "absolute";
    const second = doc.createElement("div");
    second.setAttribute("data-ui-editor-id", "workspace.content.text");
    const empty = doc.createElement("div");
    doc.body.append(first, second, empty);

    controller.install();
    doc.body.dispatchEvent(createPointerEvent("pointermove", first));
    assert.equal(first.getAttribute("data-ui-editor-hovered"), "true");

    doc.body.dispatchEvent(createPointerEvent("pointermove", second));
    assert.equal(first.getAttribute("data-ui-editor-hovered"), "false");
    assert.equal(first.style.outline, "1px solid green");
    assert.equal(first.style.boxShadow, "none");
    assert.equal(first.style.position, "absolute");
    assert.equal(second.getAttribute("data-ui-editor-hovered"), "true");

    doc.body.dispatchEvent(createPointerEvent("pointerleave", empty));
    assert.equal(controller.getHover().elementId, null);
    assert.equal(second.getAttribute("data-ui-editor-hovered"), "false");
  }

  {
    const doc = createFakeDocument();
    const controller = createTargetSelectionController({
      root: doc.body,
      activeScopeId: "workspace.primary",
      registry: createRegistry(),
    });
    const target = doc.createElement("button");
    target.setAttribute("data-ui-editor-id", "workspace.toolbar.action");
    doc.body.appendChild(target);

    controller.install();
    doc.body.dispatchEvent(createClickEvent(target));
    assert.equal(target.getAttribute("data-ui-editor-selected"), "true");

    doc.body.dispatchEvent(createPointerEvent("pointermove", target));
    doc.body.dispatchEvent(createPointerEvent("pointerleave", target));
    assert.equal(target.getAttribute("data-ui-editor-selected"), "true");
    assert.equal(target.style.outline.includes("#2563eb"), true);
  }

  {
    const doc = createFakeDocument();
    const controller = createTargetSelectionController({
      root: doc.body,
      activeScopeId: "workspace.primary",
      registry: createRegistry(),
    });
    const wrapper = doc.createElement("div");
    wrapper.setAttribute("data-ui-editor-id", "workspace.content.longText");
    const textarea = doc.createElement("textarea");
    wrapper.appendChild(textarea);
    doc.body.appendChild(wrapper);

    controller.install();
    const clickEvent = createClickEvent(textarea);
    doc.body.dispatchEvent(clickEvent);

    assert.equal(controller.getSelection().elementId, "workspace.content.longText");
    assert.equal(wrapper.getAttribute("data-ui-editor-selected"), "true");
    assert.equal(textarea.getAttribute("data-ui-editor-selected"), null);
    assert.equal(clickEvent.defaultPrevented, undefined);
    assert.equal(clickEvent.stopped, true);
  }

  {
    const doc = createFakeDocument();
    const controller = createTargetSelectionController({
      root: doc.body,
      activeScopeId: "workspace.primary",
      registry: createRegistry(),
    });
    const wrapper = doc.createElement("label");
    wrapper.setAttribute("data-ui-editor-id", "workspace.content.title");
    const input = doc.createElement("input");
    wrapper.appendChild(input);
    doc.body.appendChild(wrapper);

    controller.install();
    const clickEvent = createClickEvent(input);
    doc.body.dispatchEvent(clickEvent);

    assert.equal(controller.getSelection().elementId, "workspace.content.title");
    assert.equal(wrapper.getAttribute("data-ui-editor-selected"), "true");
    assert.equal(input.getAttribute("data-ui-editor-selected"), null);
    assert.equal(clickEvent.defaultPrevented, undefined);
    assert.equal(clickEvent.stopped, true);
  }

  {
    const doc = createFakeDocument();
    const controller = createTargetSelectionController({
      root: doc.body,
      activeScopeId: "workspace.primary",
      registry: createRegistry(),
    });
    const group = doc.createElement("div");
    group.setAttribute("data-ui-editor-id", "workspace.toolbar.group");
    const child = doc.createElement("button");
    child.setAttribute("data-ui-editor-id", "workspace.toolbar.action");
    group.appendChild(child);
    doc.body.appendChild(group);

    controller.install();
    doc.body.dispatchEvent(createClickEvent(child));
    assert.equal(controller.getSelection().elementId, "workspace.toolbar.action");
    assert.equal(child.getAttribute("data-ui-editor-selected"), "true");

    doc.body.dispatchEvent(createClickEvent(child, { shiftKey: true }));
    assert.equal(controller.getSelection().elementId, "workspace.toolbar.group");
    assert.equal(child.getAttribute("data-ui-editor-selected"), "false");
    assert.equal(group.getAttribute("data-ui-editor-selected"), "true");
  }

  {
    const doc = createFakeDocument();
    const controller = createTargetSelectionController({
      root: doc.body,
      activeScopeId: "workspace.primary",
      registry: createRegistry(),
    });
    const group = doc.createElement("div");
    group.setAttribute("data-ui-editor-id", "workspace.toolbar.group");
    const child = doc.createElement("button");
    child.setAttribute("data-ui-editor-id", "workspace.toolbar.action");
    group.appendChild(child);
    doc.body.appendChild(group);

    controller.install();
    doc.body.dispatchEvent(createClickEvent(child, { altKey: true }));

    assert.equal(controller.getSelection().elementId, "workspace.toolbar.group");
    assert.equal(group.getAttribute("data-ui-editor-selected"), "true");
    assert.equal(child.getAttribute("data-ui-editor-selected"), null);
  }

  {
    const doc = createFakeDocument();
    const controller = createTargetSelectionController({
      root: doc.body,
      activeScopeId: "workspace.primary",
      registry: createRegistry(),
    });
    const parent = doc.createElement("div");
    parent.setAttribute("data-ui-editor-id", "workspace.toolbar.group");
    const unknownChild = doc.createElement("button");
    unknownChild.setAttribute("data-ui-editor-id", "workspace.toolbar.unknown");
    parent.appendChild(unknownChild);
    doc.body.appendChild(parent);

    controller.install();
    doc.body.dispatchEvent(createClickEvent(unknownChild));

    assert.equal(controller.getSelection().elementId, "workspace.toolbar.group");
    assert.equal(parent.getAttribute("data-ui-editor-selected"), "true");
    assert.equal(unknownChild.getAttribute("data-ui-editor-selected"), null);
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
    const detachedDomParent = doc.createElement("div");
    detachedDomParent.setAttribute("data-ui-editor-id", "workspace.toolbar.group");
    const childHost = doc.createElement("div");
    const child = doc.createElement("button");
    child.setAttribute("data-ui-editor-id", "workspace.toolbar.action");
    childHost.appendChild(child);
    doc.body.append(detachedDomParent, childHost);

    controller.install();
    doc.body.dispatchEvent(createClickEvent(child, { shiftKey: true }));

    assert.equal(controller.getSelection().elementId, "workspace.toolbar.group");
    assert.equal(controller.getSelection().hasTargetElement, true);
    assert.equal(detachedDomParent.getAttribute("data-ui-editor-selected"), "true");
    assert.equal(uiState.getState().selectedElementId, "workspace.toolbar.group");
  }

  {
    const doc = createFakeDocument();
    const uiState = createEditorUiState();
    const selections = [];
    const controller = createTargetSelectionController({
      root: doc.body,
      activeScopeId: "workspace.primary",
      registry: createRegistry(),
      uiState,
      onSelectionChange: (selection) => selections.push(selection),
    });
    const childHost = doc.createElement("div");
    const child = doc.createElement("button");
    child.setAttribute("data-ui-editor-id", "workspace.toolbar.action");
    childHost.appendChild(child);
    doc.body.appendChild(childHost);

    controller.install();
    doc.body.dispatchEvent(createClickEvent(child, { altKey: true }));

    assert.equal(controller.getSelection().elementId, "workspace.toolbar.group");
    assert.equal(controller.getSelection().hasTargetElement, false);
    assert.equal(controller.getSelection().targetElement, null);
    assert.equal(controller.getSelection().message, "Registry-Gruppe gewaehlt, kein DOM-Wrapper gefunden.");
    assert.equal(child.getAttribute("data-ui-editor-selected"), null);
    assert.equal(uiState.getState().selectedElementId, "workspace.toolbar.group");
    assert.equal(selections[0].elementId, "workspace.toolbar.group");
    assert.equal(selections[0].hasTargetElement, false);
  }

  {
    const doc = createFakeDocument();
    const hovers = [];
    const controller = createTargetSelectionController({
      root: doc.body,
      activeScopeId: "workspace.primary",
      registry: createRegistry(),
      onHoverChange: (selection) => hovers.push(selection),
    });
    const childHost = doc.createElement("div");
    const child = doc.createElement("button");
    child.setAttribute("data-ui-editor-id", "workspace.toolbar.action");
    childHost.appendChild(child);
    doc.body.appendChild(childHost);

    controller.install();
    doc.body.dispatchEvent(createPointerEvent("pointermove", child, { shiftKey: true }));

    assert.equal(controller.getHover().elementId, "workspace.toolbar.group");
    assert.equal(controller.getHover().hasTargetElement, false);
    assert.equal(controller.getHover().message, "Registry-Gruppe gewaehlt, kein DOM-Wrapper gefunden.");
    assert.equal(hovers[0].elementId, "workspace.toolbar.group");
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
    known.style.position = "absolute";
    const next = doc.createElement("div");
    next.setAttribute("data-ui-editor-id", "workspace.content.text");
    next.style.position = "static";
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
    assert.equal(known.style.position, "absolute");
    assert.equal(next.getAttribute("data-ui-editor-selected"), "true");
    assert.equal(next.style.position, "static");
    assert.equal(uiState.getState().selectedElementId, "workspace.content.text");
  }

  {
    const doc = createFakeDocument();
    const controller = createTargetSelectionController({
      root: doc.body,
      activeScopeId: "workspace.primary",
      registry: createRegistry(),
    });
    const first = doc.createElement("div");
    first.setAttribute("data-ui-editor-id", "workspace.toolbar");
    const second = doc.createElement("div");
    second.setAttribute("data-ui-editor-id", "workspace.content.text");
    doc.body.append(first, second);

    controller.install();
    doc.body.dispatchEvent(createClickEvent(first));
    assert.equal(first.style.position, "relative");

    doc.body.dispatchEvent(createClickEvent(second));
    assert.equal(first.getAttribute("data-ui-editor-selected"), "false");
    assert.equal(first.style.outline, "");
    assert.equal(first.style.boxShadow, "");
    assert.equal(first.style.position, "");
    assert.equal(second.getAttribute("data-ui-editor-selected"), "true");
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

  {
    const doc = createFakeDocument();
    const panel = doc.createElement("aside");
    const header = doc.createElement("div");
    const content = doc.createElement("section");
    const collapseButton = doc.createElement("button");
    const hideButton = doc.createElement("button");
    const reopenButton = doc.createElement("button");
    panel.offsetWidth = 200;
    panel.offsetHeight = 100;
    panel.append(header, content, collapseButton, hideButton);
    doc.body.append(panel, reopenButton);
    const viewport = {
      innerWidth: 320,
      innerHeight: 220,
      _listeners: {},
      addEventListener(type, handler) {
        this._listeners[type] ||= [];
        this._listeners[type].push(handler);
      },
      removeEventListener(type, handler) {
        if (!this._listeners[type]) return;
        this._listeners[type] = this._listeners[type].filter((entry) => entry !== handler);
      },
      dispatchEvent(event = {}) {
        for (const handler of this._listeners[event.type] || []) handler.call(this, event);
      },
    };
    const controller = createTargetSelectionPanelController({
      document: doc,
      viewport,
      panelElement: panel,
      headerElement: header,
      contentElement: content,
      collapseButton,
      hideButton,
      reopenButton,
      edgeMargin: 8,
    });

    assert.equal(controller.install(), true);
    header.dispatchEvent(createPointerEvent("pointerdown", header, { clientX: 20, clientY: 30 }));
    doc.dispatchEvent(createPointerEvent("pointermove", header, { clientX: 1000, clientY: 1000 }));
    doc.dispatchEvent(createPointerEvent("pointerup", header));

    assert.equal(panel.style.position, "fixed");
    assert.equal(panel.style.left, "112px");
    assert.equal(panel.style.top, "112px");
    assert.equal(controller.getState().dragging, false);

    collapseButton.dispatchEvent(createClickEvent(collapseButton));
    assert.equal(panel.getAttribute("data-ui-editor-panel-collapsed"), "true");
    assert.equal(content.style.display, "none");
    collapseButton.dispatchEvent(createClickEvent(collapseButton));
    assert.equal(panel.getAttribute("data-ui-editor-panel-collapsed"), "false");
    assert.equal(content.style.display, "");

    hideButton.dispatchEvent(createClickEvent(hideButton));
    assert.equal(panel.getAttribute("data-ui-editor-panel-hidden"), "true");
    assert.equal(panel.style.display, "none");
    assert.equal(reopenButton.style.display, "");
    reopenButton.dispatchEvent(createClickEvent(reopenButton));
    assert.equal(panel.getAttribute("data-ui-editor-panel-hidden"), "false");
    assert.equal(panel.style.display, "");
    assert.equal(reopenButton.style.display, "none");

    viewport.innerWidth = 260;
    viewport.innerHeight = 180;
    viewport.dispatchEvent({ type: "resize" });
    assert.equal(panel.style.left, "52px");
    assert.equal(panel.style.top, "72px");
    assert.equal(controller.uninstall(), true);
  }

  const sourceText = fs.readFileSync(MODULE_PATH, "utf8");
  assertNoForbiddenFragments(sourceText);

  console.log("TESTS OK: target-selection");
}

run();
