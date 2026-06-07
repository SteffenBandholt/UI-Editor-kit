#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const MODULE_PATH = path.join(REPO_ROOT, "src/core/target-contract.cjs");
const {
  ERROR_CODES,
  validateTargetContract,
  isVirtualElement,
} = require(MODULE_PATH);

function createFakeDocument() {
  const createNode = (tag, doc) => ({
    tagName: String(tag || "").toUpperCase(),
    ownerDocument: doc,
    parentElement: null,
    children: [],
    attributes: {},
    appendChild(child) {
      if (child && typeof child === "object") {
        child.parentElement = this;
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
  });

  const doc = {
    createElement(tag) {
      return createNode(tag, doc);
    },
  };
  doc.body = createNode("body", doc);
  doc.querySelector = (...args) => doc.body.querySelector(...args);
  return doc;
}

function setTarget(node, id, attributeName = "data-ui-editor-id") {
  node.setAttribute(attributeName, id);
  return node;
}

function element(id, type, parentId = null, extra = {}) {
  return {
    id,
    name: id,
    type,
    role: "layout",
    parentId,
    ...extra,
  };
}

function findError(result, code, elementId = null) {
  return result.errors.find((error) => error.code === code && (!elementId || error.elementId === elementId));
}

function createValidAreaGroupField() {
  const doc = createFakeDocument();
  const area = setTarget(doc.createElement("section"), "workspace.area");
  const group = setTarget(doc.createElement("div"), "workspace.group");
  const field = setTarget(doc.createElement("input"), "workspace.group.field");
  group.appendChild(field);
  area.appendChild(group);
  doc.body.appendChild(area);
  return {
    doc,
    elements: [
      element("workspace.area", "area"),
      element("workspace.group", "group", "workspace.area"),
      element("workspace.group.field", "field", "workspace.group"),
    ],
  };
}

function assertNoForbiddenFragments() {
  const source = fs.readFileSync(MODULE_PATH, "utf8");
  for (const fragment of [
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
  ]) {
    assert.equal(source.includes(fragment), false, `target-contract enthaelt verbotenen Fragmenttext: ${fragment}`);
  }
}

function run() {
  assert.equal(typeof validateTargetContract, "function");
  assert.equal(isVirtualElement({ virtual: true }), true);
  assert.equal(isVirtualElement({ isVirtual: true }), true);
  assert.equal(isVirtualElement({ domVirtual: true }), true);
  assert.equal(isVirtualElement({ targetVirtual: true }), true);

  {
    const { doc, elements } = createValidAreaGroupField();
    assert.deepEqual(validateTargetContract({ elements, root: doc.body }), { ok: true, errors: [] });
  }

  {
    const { doc, elements } = createValidAreaGroupField();
    elements.push(element("workspace.group.missing", "field", "workspace.group"));
    const result = validateTargetContract({ elements, root: doc.body });
    assert.equal(result.ok, false);
    assert.equal(Boolean(findError(result, ERROR_CODES.DOM_TARGET_MISSING, "workspace.group.missing")), true);
  }

  {
    const { doc, elements } = createValidAreaGroupField();
    elements[2] = element("workspace.group.field", "field", "workspace.unknown");
    const result = validateTargetContract({ elements, root: doc.body });
    assert.equal(result.ok, false);
    assert.equal(Boolean(findError(result, ERROR_CODES.PARENT_ID_UNKNOWN, "workspace.group.field")), true);
  }

  {
    const doc = createFakeDocument();
    const area = setTarget(doc.createElement("section"), "workspace.area");
    const group = setTarget(doc.createElement("div"), "workspace.group");
    const field = setTarget(doc.createElement("input"), "workspace.group.field");
    area.append(group, field);
    doc.body.appendChild(area);
    const result = validateTargetContract({
      root: doc.body,
      elements: [
        element("workspace.area", "area"),
        element("workspace.group", "group", "workspace.area"),
        element("workspace.group.field", "field", "workspace.group"),
      ],
    });
    assert.equal(result.ok, false);
    assert.equal(Boolean(findError(result, ERROR_CODES.FIELD_NOT_INSIDE_GROUP, "workspace.group.field")), true);
    assert.equal(Boolean(findError(result, ERROR_CODES.DOM_PARENT_MISMATCH, "workspace.group.field")), true);
  }

  {
    const doc = createFakeDocument();
    const area = setTarget(doc.createElement("section"), "workspace.area");
    const field = setTarget(doc.createElement("input"), "workspace.group.field");
    area.appendChild(field);
    doc.body.appendChild(area);
    const result = validateTargetContract({
      root: doc.body,
      elements: [
        element("workspace.area", "area"),
        element("workspace.group", "group", "workspace.area"),
        element("workspace.group.field", "field", "workspace.group"),
      ],
    });
    assert.equal(result.ok, false);
    assert.equal(Boolean(findError(result, ERROR_CODES.GROUP_WITHOUT_DOM_WRAPPER, "workspace.group")), true);
  }

  {
    const doc = createFakeDocument();
    const area = setTarget(doc.createElement("section"), "workspace.area");
    const field = setTarget(doc.createElement("input"), "workspace.group.field");
    area.appendChild(field);
    doc.body.appendChild(area);
    const result = validateTargetContract({
      root: doc.body,
      allowVirtualElements: true,
      elements: [
        element("workspace.area", "area"),
        element("workspace.virtualGroup", "group", "workspace.area", { virtual: true }),
        element("workspace.group.field", "field", "workspace.virtualGroup"),
      ],
    });
    assert.deepEqual(result, { ok: true, errors: [] });
  }

  {
    const doc = createFakeDocument();
    const toolbar = setTarget(doc.createElement("section"), "workspace.toolbar");
    const actions = setTarget(doc.createElement("div"), "workspace.toolbar.actions");
    const button = setTarget(doc.createElement("button"), "workspace.toolbar.actions.close");
    actions.appendChild(button);
    toolbar.appendChild(actions);
    doc.body.appendChild(toolbar);
    const result = validateTargetContract({
      root: doc.body,
      elements: [
        element("workspace.toolbar", "toolbar"),
        element("workspace.toolbar.actions", "group", "workspace.toolbar"),
        element("workspace.toolbar.actions.close", "button", "workspace.toolbar.actions"),
      ],
    });
    assert.deepEqual(result, { ok: true, errors: [] });
  }

  {
    const doc = createFakeDocument();
    const editor = setTarget(doc.createElement("section"), "workspace.editor");
    const textBlock = setTarget(doc.createElement("div"), "workspace.editor.text.long");
    const input = setTarget(doc.createElement("textarea"), "workspace.editor.text.long.input");
    textBlock.appendChild(input);
    editor.appendChild(textBlock);
    doc.body.appendChild(editor);
    const result = validateTargetContract({
      root: doc.body,
      elements: [
        element("workspace.editor", "area"),
        element("workspace.editor.text.long", "group", "workspace.editor"),
        element("workspace.editor.text.long.input", "field", "workspace.editor.text.long"),
      ],
    });
    assert.deepEqual(result, { ok: true, errors: [] });
  }

  assertNoForbiddenFragments();

  console.log("TESTS OK: target-contract");
}

run();
