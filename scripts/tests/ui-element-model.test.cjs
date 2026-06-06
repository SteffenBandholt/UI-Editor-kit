#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const MODEL_PATH = path.join(REPO_ROOT, "src/core/ui-element-model.cjs");

const model = require(MODEL_PATH);

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function run() {
  assert.deepEqual(model.UI_ELEMENT_REQUIRED_FIELDS, [
    "id",
    "name",
    "type",
    "role",
    "parentId",
    "order",
    "visible",
    "editable",
    "allowedOps",
    "lockedOps",
  ]);

  assert.deepEqual(model.UI_ELEMENT_TYPES, [
    "root",
    "area",
    "group",
    "subgroup",
    "component",
    "componentPart",
    "table",
    "tableColumn",
    "list",
    "card",
    "dialog",
    "toolbar",
    "button",
    "field",
    "label",
    "statusIndicator",
  ]);

  assert.deepEqual(model.UI_ELEMENT_ROLES, [
    "layout",
    "content",
    "meta",
    "structure",
    "status",
    "date",
    "responsible",
    "visibility",
    "action",
    "navigation",
    "editor-launcher",
    "system",
  ]);

  assert.deepEqual(model.UI_ELEMENT_OPERATIONS, [
    "inspect",
    "show",
    "hide",
    "move",
    "resize",
    "reorder",
    "rename",
    "changeWidth",
    "pin",
    "unpin",
    "reset",
    "applyPreset",
  ]);

  const exampleElement = {
    id: "workspace.main.table.column.status",
    name: "Status",
    type: "tableColumn",
    role: "status",
    columnRole: "statusColumn",
    parentId: "workspace.main.table",
    order: 5,
    visible: true,
    editable: true,
    allowedOps: ["inspect", "move", "changeWidth"],
    lockedOps: ["rename"],
    width: 220,
    layoutArea: "content",
    ignoredField: "not-part-of-model",
  };

  const normalized = model.normalizeUiElement(exampleElement);

  assert.deepEqual(normalized, {
    id: "workspace.main.table.column.status",
    name: "Status",
    type: "tableColumn",
    role: "status",
    parentId: "workspace.main.table",
    order: 5,
    visible: true,
    editable: true,
    allowedOps: ["inspect", "move", "changeWidth"],
    lockedOps: ["rename"],
    columnRole: "statusColumn",
    width: 220,
    layoutArea: "content",
  });
  assert.equal(hasOwn(normalized, "ignoredField"), false);
  assert.equal(normalized.allowedOps === exampleElement.allowedOps, false);
  assert.equal(normalized.lockedOps === exampleElement.lockedOps, false);

  const sparseElement = model.createUiElement({
    id: "workspace.main",
    allowedOps: [],
  });

  assert.deepEqual(sparseElement, {
    id: "workspace.main",
    allowedOps: [],
  });
  assert.equal(hasOwn(sparseElement, "name"), false);
  assert.equal(hasOwn(sparseElement, "type"), false);
  assert.equal(hasOwn(sparseElement, "role"), false);
  assert.equal(hasOwn(sparseElement, "parentId"), false);
  assert.equal(hasOwn(sparseElement, "order"), false);
  assert.equal(hasOwn(sparseElement, "visible"), false);
  assert.equal(hasOwn(sparseElement, "editable"), false);
  assert.equal(hasOwn(sparseElement, "lockedOps"), false);

  const separatedOps = model.normalizeUiElement({
    id: "workspace.main.toolbar.button.pin",
    allowedOps: ["pin"],
    lockedOps: ["unpin"],
  });

  assert.deepEqual(separatedOps.allowedOps, ["pin"]);
  assert.deepEqual(separatedOps.lockedOps, ["unpin"]);
  assert.equal(separatedOps.allowedOps.includes("unpin"), false);
  assert.equal(separatedOps.lockedOps.includes("pin"), false);

  const sourceText = fs.readFileSync(MODEL_PATH, "utf8");
  const forbiddenMarkers = [
    "document",
    "window",
    "querySelector",
    "DOMParser",
    "data-ui",
    "mini-inspector",
    ".html",
    "demo/",
    "demo\\",
  ];

  forbiddenMarkers.forEach((marker) => {
    assert.equal(
      sourceText.includes(marker),
      false,
      `ui-element-model enthaelt verbotene Abhaengigkeitsspur: ${marker}`
    );
  });

  console.log("TESTS OK: ui-element-model");
}

run();
