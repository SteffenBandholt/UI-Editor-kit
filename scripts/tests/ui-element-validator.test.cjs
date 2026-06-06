#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const VALIDATOR_PATH = path.join(REPO_ROOT, "src/core/ui-element-validator.cjs");

const {
  FORBIDDEN_UI_ELEMENT_OPERATIONS,
  UI_TABLE_COLUMN_ROLES,
  validateUiElement,
  validateUiElementList,
} = require(VALIDATOR_PATH);

function findError(errors, code, field) {
  return errors.find((error) => error.code === code && (field === undefined || error.field === field));
}

function root(overrides = {}) {
  return {
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
    ...overrides,
  };
}

function element(overrides = {}) {
  return {
    id: "workspace.main.area",
    name: "Bereich",
    type: "area",
    role: "layout",
    parentId: "workspace.root",
    order: 1,
    visible: true,
    editable: true,
    allowedOps: ["inspect"],
    lockedOps: [],
    ...overrides,
  };
}

function validTableWithColumn(columnRole, overrides = {}) {
  return [
    root(),
    element({ id: "workspace.main.area", name: "Bereich", type: "area", parentId: "workspace.root" }),
    element({
      id: "workspace.main.table",
      name: "Tabelle",
      type: "table",
      role: "content",
      parentId: "workspace.main.area",
      order: 2,
      allowedOps: ["inspect", "move"],
      lockedOps: ["rename"],
    }),
    element({
      id: `workspace.main.table.column.${columnRole}`,
      name: columnRole,
      type: "tableColumn",
      role: "content",
      columnRole,
      parentId: "workspace.main.table",
      order: 3,
      allowedOps: ["inspect", "changeWidth"],
      lockedOps: [],
      ...overrides,
    }),
  ];
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

  assert.deepEqual(UI_TABLE_COLUMN_ROLES, [
    "contentColumn",
    "metaColumn",
    "structureColumn",
    "statusColumn",
    "dateColumn",
    "responsibleColumn",
    "visibilityColumn",
    "actionColumn",
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

  const rootElementResult = validateUiElement(root());
  assert.equal(rootElementResult.ok, true);

  const nonRootWithNullParentResult = validateUiElement(element({
    id: "workspace.main.dialog",
    name: "Dialog",
    type: "dialog",
    parentId: null,
  }));
  assert.equal(nonRootWithNullParentResult.ok, true);

  const invalidTypeResult = validateUiElement(element({ id: "workspace.main.custom", type: "customType" }));
  assert.equal(invalidTypeResult.ok, false);
  assert.ok(findError(invalidTypeResult.errors, "invalid_type", "type"));

  const invalidRoleResult = validateUiElement(element({ id: "workspace.main.role", role: "customRole" }));
  assert.equal(invalidRoleResult.ok, false);
  assert.ok(findError(invalidRoleResult.errors, "invalid_role", "role"));

  const invalidAllowedOpsTypeResult = validateUiElement(element({
    id: "workspace.main.ops.allowed",
    allowedOps: "inspect",
  }));
  assert.equal(invalidAllowedOpsTypeResult.ok, false);
  assert.ok(findError(invalidAllowedOpsTypeResult.errors, "invalid_operations_array", "allowedOps"));

  const invalidLockedOpsTypeResult = validateUiElement(element({
    id: "workspace.main.ops.locked",
    lockedOps: "rename",
  }));
  assert.equal(invalidLockedOpsTypeResult.ok, false);
  assert.ok(findError(invalidLockedOpsTypeResult.errors, "invalid_operations_array", "lockedOps"));

  const invalidOperationResult = validateUiElement(element({
    id: "workspace.main.ops.invalid",
    allowedOps: ["inspect", "dance"],
  }));
  assert.equal(invalidOperationResult.ok, false);
  assert.ok(findError(invalidOperationResult.errors, "invalid_operation", "allowedOps"));

  const conflictingOperationResult = validateUiElement(element({
    id: "workspace.main.ops.conflict",
    allowedOps: ["inspect", "move"],
    lockedOps: ["move"],
  }));
  assert.equal(conflictingOperationResult.ok, false);
  assert.ok(findError(conflictingOperationResult.errors, "conflicting_operation", "allowedOps"));

  const forbiddenSaveResult = validateUiElement(element({
    id: "workspace.main.ops.save",
    type: "button",
    role: "action",
    editable: false,
    allowedOps: ["save"],
  }));
  assert.equal(forbiddenSaveResult.ok, false);
  assert.ok(findError(forbiddenSaveResult.errors, "invalid_operation", "allowedOps"));
  assert.ok(findError(forbiddenSaveResult.errors, "forbidden_operation", "allowedOps"));

  const lockedDeleteResult = validateUiElement(element({
    id: "workspace.main.ops.delete",
    type: "button",
    role: "action",
    editable: false,
    lockedOps: ["delete"],
  }));
  assert.equal(lockedDeleteResult.ok, true);
  assert.deepEqual(lockedDeleteResult.errors, []);

  const invalidListTypeResult = validateUiElementList("not-a-list");
  assert.equal(invalidListTypeResult.ok, false);
  assert.ok(findError(invalidListTypeResult.errors, "invalid_element_list"));

  const listInput = [
    validElement,
    element({
      id: "workspace.invalid.one",
      type: "unknownType",
      parentId: "workspace.main",
      allowedOps: ["inspect", "save"],
    }),
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

  const noRootResult = validateUiElementList([element()]);
  assert.equal(noRootResult.ok, false);
  assert.ok(findError(noRootResult.errors, "missing_root", "type"));

  const twoRootsResult = validateUiElementList([root(), root({ id: "workspace.secondRoot" })]);
  assert.equal(twoRootsResult.ok, false);
  assert.ok(findError(twoRootsResult.errors, "multiple_roots", "type"));

  const invalidRootParentResult = validateUiElementList([root({ parentId: "workspace.main" })]);
  assert.equal(invalidRootParentResult.ok, false);
  assert.ok(findError(invalidRootParentResult.errors, "invalid_root_parent", "parentId"));

  const missingParentResult = validateUiElementList([root(), element({ parentId: "" })]);
  assert.equal(missingParentResult.ok, false);
  assert.ok(findError(missingParentResult.errors, "missing_parent", "parentId"));

  const absentParentElement = element();
  delete absentParentElement.parentId;
  const absentParentResult = validateUiElementList([root(), absentParentElement]);
  assert.equal(absentParentResult.ok, false);
  assert.ok(findError(absentParentResult.errors, "missing_parent", "parentId"));

  const unknownParentResult = validateUiElementList([root(), element({ parentId: "workspace.unknown" })]);
  assert.equal(unknownParentResult.ok, false);
  assert.ok(findError(unknownParentResult.errors, "unknown_parent", "parentId"));

  const orphanedElementResult = validateUiElementList([
    root(),
    element({ id: "workspace.orphan", parentId: "workspace.missing.parent" }),
  ]);
  assert.equal(orphanedElementResult.ok, false);
  assert.ok(findError(orphanedElementResult.errors, "unknown_parent", "parentId"));

  const parentCycleResult = validateUiElementList([
    root(),
    element({ id: "workspace.cycle.a", parentId: "workspace.cycle.b" }),
    element({ id: "workspace.cycle.b", parentId: "workspace.cycle.a" }),
  ]);
  assert.equal(parentCycleResult.ok, false);
  assert.ok(findError(parentCycleResult.errors, "parent_cycle", "parentId"));

  const validParentStructureResult = validateUiElementList([
    root(),
    element({ id: "workspace.main.area", parentId: "workspace.root" }),
    element({ id: "workspace.main.group", type: "group", parentId: "workspace.main.area" }),
    element({ id: "workspace.main.field", type: "field", parentId: "workspace.main.group" }),
  ]);
  assert.equal(validParentStructureResult.ok, true);
  assert.deepEqual(validParentStructureResult.errors, []);

  const tableColumnWithoutColumnRole = validTableWithColumn("contentColumn");
  delete tableColumnWithoutColumnRole[3].columnRole;
  const absentColumnRoleResult = validateUiElementList(tableColumnWithoutColumnRole);
  assert.equal(absentColumnRoleResult.ok, false);
  assert.ok(findError(absentColumnRoleResult.errors, "missing_column_role", "columnRole"));

  const missingColumnRoleResult = validateUiElementList(validTableWithColumn("contentColumn", { columnRole: "" }));
  assert.equal(missingColumnRoleResult.ok, false);
  assert.ok(findError(missingColumnRoleResult.errors, "missing_column_role", "columnRole"));

  const unknownColumnRoleResult = validateUiElementList(validTableWithColumn("customColumn", { columnRole: "customColumn" }));
  assert.equal(unknownColumnRoleResult.ok, false);
  assert.ok(findError(unknownColumnRoleResult.errors, "invalid_column_role", "columnRole"));

  const invalidTableColumnParentResult = validateUiElementList([
    root(),
    element({ id: "workspace.main.area", parentId: "workspace.root" }),
    element({
      id: "workspace.main.table.column.status",
      name: "Status",
      type: "tableColumn",
      columnRole: "statusColumn",
      parentId: "workspace.main.area",
    }),
  ]);
  assert.equal(invalidTableColumnParentResult.ok, false);
  assert.ok(findError(invalidTableColumnParentResult.errors, "invalid_table_column_parent", "parentId"));

  UI_TABLE_COLUMN_ROLES.forEach((columnRole) => {
    const result = validateUiElementList(validTableWithColumn(columnRole));
    assert.equal(result.ok, true, `${columnRole} muss akzeptiert werden.`);
    assert.deepEqual(result.errors, []);
  });

  const actionColumnWithTechnicalOpsResult = validateUiElementList(validTableWithColumn("actionColumn", {
    allowedOps: ["inspect", "show"],
    lockedOps: ["rename"],
  }));
  assert.equal(actionColumnWithTechnicalOpsResult.ok, true);
  assert.deepEqual(actionColumnWithTechnicalOpsResult.errors, []);

  const actionColumnWithBusinessOperationResult = validateUiElementList(validTableWithColumn("actionColumn", {
    allowedOps: ["inspect", "save"],
  }));
  assert.equal(actionColumnWithBusinessOperationResult.ok, false);
  assert.ok(findError(actionColumnWithBusinessOperationResult.errors, "forbidden_action_column_operation", "allowedOps"));

  const noGuessedColumnRoleResult = validateUiElementList(validTableWithColumn("metaColumn", {
    id: "workspace.main.table.column.metaGuessed",
    name: "Meta-Spalte",
    role: "meta",
    columnRole: undefined,
  }));
  assert.equal(noGuessedColumnRoleResult.ok, false);
  assert.ok(findError(noGuessedColumnRoleResult.errors, "missing_column_role", "columnRole"));

  const snapshotElements = validTableWithColumn("metaColumn");
  const snapshotBefore = JSON.stringify(snapshotElements);
  validateUiElement(snapshotElements[3]);
  validateUiElementList(snapshotElements);
  assert.equal(JSON.stringify(snapshotElements), snapshotBefore);

  const sourceText = fs.readFileSync(VALIDATOR_PATH, "utf8");
  const forbiddenMarkers = [
    "document",
    "window",
    "querySelector",
    "DOMParser",
    "Browser",
    "HTML",
    "data-ui",
    "Mini-Inspector",
    "mini-inspector",
    "Host-App-Demo",
    "Layoutdiagnose",
    "demo/",
    "demo\\",
    "BBM",
    "Protokoll",
    "Restarbeiten",
    "TOP",
    "Bauvorhaben",
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
