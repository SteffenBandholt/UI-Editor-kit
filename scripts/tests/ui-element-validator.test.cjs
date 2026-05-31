#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const VALIDATOR_PATH = path.join(REPO_ROOT, "src/core/ui-element-validator.cjs");

const {
  FORBIDDEN_UI_ELEMENT_OPERATIONS,
  validateUiElement,
  validateUiElementList,
} = require(VALIDATOR_PATH);

function findError(errors, code, field) {
  return errors.find((error) => error.code === code && (field === undefined || error.field === field));
}

function run() {
  assert.deepEqual(FORBIDDEN_UI_ELEMENT_OPERATIONS, [
    "save",
    "create",
    "delete",
    "remove",
    "upload",
    "import",
    "export",
    "autosave",
    "database",
    "execute",
    "submit",
  ]);

  const validElement = {
    id: "workspace.main.table",
    name: "Tabelle",
    type: "table",
    role: "content",
    parentId: "workspace.main.area",
    order: 20,
    visible: true,
    editable: true,
    allowedOps: ["inspect", "move"],
    lockedOps: ["rename"],
  };

  const validResult = validateUiElement(validElement);
  assert.equal(validResult.ok, true);
  assert.deepEqual(validResult.errors, []);

  const nonObjectResult = validateUiElement("not-an-object");
  assert.equal(nonObjectResult.ok, false);
  assert.ok(findError(nonObjectResult.errors, "invalid_element"));

  const arrayResult = validateUiElement([]);
  assert.equal(arrayResult.ok, false);
  assert.ok(findError(arrayResult.errors, "invalid_element"));

  const missingFieldResult = validateUiElement({
    id: "workspace.main.field",
    type: "field",
    role: "content",
    parentId: "workspace.main.group",
    order: 1,
    visible: true,
    editable: true,
    allowedOps: [],
    lockedOps: [],
  });
  assert.equal(missingFieldResult.ok, false);
  assert.ok(findError(missingFieldResult.errors, "missing_required_field", "name"));

  const rootElementResult = validateUiElement({
    id: "workspace.root",
    name: "Root",
    type: "root",
    role: "layout",
    parentId: null,
    order: 0,
    visible: true,
    editable: false,
    allowedOps: ["inspect"],
    lockedOps: [],
  });
  assert.equal(rootElementResult.ok, true);

  const nonRootWithNullParentResult = validateUiElement({
    id: "workspace.main.dialog",
    name: "Dialog",
    type: "dialog",
    role: "layout",
    parentId: null,
    order: 5,
    visible: true,
    editable: true,
    allowedOps: ["inspect"],
    lockedOps: [],
  });
  assert.equal(nonRootWithNullParentResult.ok, true);

  const invalidTypeResult = validateUiElement({
    id: "workspace.main.custom",
    name: "Custom",
    type: "customType",
    role: "content",
    parentId: "workspace.main",
    order: 1,
    visible: true,
    editable: true,
    allowedOps: [],
    lockedOps: [],
  });
  assert.equal(invalidTypeResult.ok, false);
  assert.ok(findError(invalidTypeResult.errors, "invalid_type", "type"));

  const invalidRoleResult = validateUiElement({
    id: "workspace.main.role",
    name: "Role",
    type: "field",
    role: "customRole",
    parentId: "workspace.main",
    order: 1,
    visible: true,
    editable: true,
    allowedOps: [],
    lockedOps: [],
  });
  assert.equal(invalidRoleResult.ok, false);
  assert.ok(findError(invalidRoleResult.errors, "invalid_role", "role"));

  const invalidAllowedOpsTypeResult = validateUiElement({
    id: "workspace.main.ops.allowed",
    name: "AllowedOps",
    type: "field",
    role: "content",
    parentId: "workspace.main",
    order: 1,
    visible: true,
    editable: true,
    allowedOps: "inspect",
    lockedOps: [],
  });
  assert.equal(invalidAllowedOpsTypeResult.ok, false);
  assert.ok(findError(invalidAllowedOpsTypeResult.errors, "invalid_operations_array", "allowedOps"));

  const invalidLockedOpsTypeResult = validateUiElement({
    id: "workspace.main.ops.locked",
    name: "LockedOps",
    type: "field",
    role: "content",
    parentId: "workspace.main",
    order: 1,
    visible: true,
    editable: true,
    allowedOps: [],
    lockedOps: "rename",
  });
  assert.equal(invalidLockedOpsTypeResult.ok, false);
  assert.ok(findError(invalidLockedOpsTypeResult.errors, "invalid_operations_array", "lockedOps"));

  const invalidOperationResult = validateUiElement({
    id: "workspace.main.ops.invalid",
    name: "InvalidOps",
    type: "field",
    role: "content",
    parentId: "workspace.main",
    order: 1,
    visible: true,
    editable: true,
    allowedOps: ["inspect", "dance"],
    lockedOps: [],
  });
  assert.equal(invalidOperationResult.ok, false);
  assert.ok(findError(invalidOperationResult.errors, "invalid_operation", "allowedOps"));

  const conflictingOperationResult = validateUiElement({
    id: "workspace.main.ops.conflict",
    name: "Konfliktfall",
    type: "field",
    role: "content",
    parentId: "workspace.main",
    order: 1,
    visible: true,
    editable: true,
    allowedOps: ["inspect", "move"],
    lockedOps: ["move"],
  });
  assert.equal(conflictingOperationResult.ok, false);
  assert.ok(findError(conflictingOperationResult.errors, "conflicting_operation", "allowedOps"));

  const forbiddenSaveResult = validateUiElement({
    id: "workspace.main.ops.save",
    name: "SaveOps",
    type: "button",
    role: "action",
    parentId: "workspace.main",
    order: 1,
    visible: true,
    editable: false,
    allowedOps: ["save"],
    lockedOps: [],
  });
  assert.equal(forbiddenSaveResult.ok, false);
  assert.ok(findError(forbiddenSaveResult.errors, "invalid_operation", "allowedOps"));
  assert.ok(findError(forbiddenSaveResult.errors, "forbidden_operation", "allowedOps"));

  const forbiddenDeleteResult = validateUiElement({
    id: "workspace.main.ops.delete",
    name: "DeleteOps",
    type: "button",
    role: "action",
    parentId: "workspace.main",
    order: 2,
    visible: true,
    editable: false,
    allowedOps: [],
    lockedOps: ["delete"],
  });
  assert.equal(forbiddenDeleteResult.ok, false);
  assert.ok(findError(forbiddenDeleteResult.errors, "invalid_operation", "lockedOps"));
  assert.ok(findError(forbiddenDeleteResult.errors, "forbidden_operation", "lockedOps"));

  const listInput = [
    validElement,
    {
      id: "workspace.invalid.one",
      name: "InvalidOne",
      type: "unknownType",
      role: "content",
      parentId: "workspace.main",
      order: 1,
      visible: true,
      editable: true,
      allowedOps: ["inspect", "save"],
      lockedOps: [],
    },
    {
      name: "MissingId",
      type: "field",
      role: "unknownRole",
      parentId: "workspace.main",
      order: 2,
      visible: true,
      editable: true,
      allowedOps: [],
      lockedOps: "rename",
    },
  ];

  const listResult = validateUiElementList(listInput);
  assert.equal(listResult.ok, false);
  assert.ok(listResult.errors.length >= 5);
  assert.ok(findError(listResult.errors, "invalid_type", "type"));
  assert.ok(findError(listResult.errors, "forbidden_operation", "allowedOps"));
  assert.ok(findError(listResult.errors, "missing_required_field", "id"));
  assert.ok(findError(listResult.errors, "invalid_role", "role"));
  assert.ok(findError(listResult.errors, "invalid_operations_array", "lockedOps"));

  const snapshotElement = {
    id: "workspace.snapshot",
    name: "Snapshot",
    type: "field",
    role: "content",
    parentId: "workspace.main",
    order: 1,
    visible: true,
    editable: true,
    allowedOps: ["inspect"],
    lockedOps: [],
  };
  const snapshotBefore = JSON.stringify(snapshotElement);
  validateUiElement(snapshotElement);
  validateUiElementList([snapshotElement]);
  assert.equal(JSON.stringify(snapshotElement), snapshotBefore);

  const sourceText = fs.readFileSync(VALIDATOR_PATH, "utf8");
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
      `ui-element-validator enthaelt verbotene Abhaengigkeitsspur: ${marker}`
    );
  });

  console.log("TESTS OK: ui-element-validator");
}

run();
