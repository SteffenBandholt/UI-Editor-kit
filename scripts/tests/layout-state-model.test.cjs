#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const MODEL_PATH = path.join(REPO_ROOT, "src/core/layout-state-model.cjs");

function loadModelModule() {
  delete require.cache[MODEL_PATH];
  return require(MODEL_PATH);
}

function completeValues() {
  return {
    layoutProfileId: "layout-profile-default",
    targetAppId: "target-app-technical",
    uiScope: "workspace-main",
    elementId: "workspace.main.area",
    changeId: "change-001",
    operation: "resize",
    layoutValue: {
      width: 320,
      placement: { x: 4, y: 8 },
      flags: ["compact"],
    },
    version: 7,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:10:00.000Z",
    source: "contract-test",
    note: "neutral layout value",
    previousVersion: 6,
    appliedBy: "editor-test",
  };
}

function assertNoForbiddenFragments(text, label) {
  const forbiddenFragments = [
    "node:fs",
    "node:path",
    "writeFile",
    "readFile",
    "mkdir",
    "sqlite",
    "postgres",
    "mysql",
    "indexedDB",
    "document.",
    "window.",
    "querySelector",
    "createElement",
    "innerHTML",
    "Browser",
    "HTML",
    "DOM",
    "Mini-Inspector",
    "Host-App-Demo",
    "Layoutdiagnose",
    "data-ui",
    "Demo",
    ["B", "BM"].join(""),
    ["Proto", "koll"].join(""),
    ["Rest", "arbeiten"].join(""),
    ["T", "OP"].join(""),
    ["Bau", "vorhaben"].join(""),
  ];

  forbiddenFragments.forEach((fragment) => {
    assert.equal(text.includes(fragment), false, `${label} enthaelt verbotenen Fragmenttext: ${fragment}`);
  });
}

function run() {
  const {
    LAYOUT_STATE_REQUIRED_FIELDS,
    LAYOUT_STATE_OPTIONAL_FIELDS,
    LAYOUT_STATE_FIELDS,
    FORBIDDEN_LAYOUT_STATE_FIELDS,
    normalizeLayoutStateRecord,
    createLayoutStateRecord,
    getLayoutStateFields,
    getForbiddenLayoutStateFields,
  } = loadModelModule();

  assert.deepEqual(LAYOUT_STATE_REQUIRED_FIELDS, [
    "layoutProfileId",
    "targetAppId",
    "uiScope",
    "elementId",
    "changeId",
    "operation",
    "layoutValue",
    "version",
    "createdAt",
    "updatedAt",
  ]);
  assert.deepEqual(getLayoutStateFields().required, LAYOUT_STATE_REQUIRED_FIELDS);

  assert.deepEqual(LAYOUT_STATE_OPTIONAL_FIELDS, ["source", "note", "previousVersion", "appliedBy"]);
  assert.deepEqual(getLayoutStateFields().optional, LAYOUT_STATE_OPTIONAL_FIELDS);

  assert.deepEqual(FORBIDDEN_LAYOUT_STATE_FIELDS, [
    "fachDaten",
    "businessData",
    "database",
    "sql",
    "recordId",
    "entity",
    "tableName",
    "save",
    "delete",
    "submit",
    "upload",
    "customer",
    "project",
    "task",
    "statusText",
    "amount",
    "price",
  ]);
  assert.deepEqual(getForbiddenLayoutStateFields(), FORBIDDEN_LAYOUT_STATE_FIELDS);

  const fieldResult = getLayoutStateFields();
  fieldResult.required.push("mutated");
  fieldResult.optional.push("mutated");
  assert.equal(getLayoutStateFields().required.includes("mutated"), false);
  assert.equal(getLayoutStateFields().optional.includes("mutated"), false);

  const forbiddenResult = getForbiddenLayoutStateFields();
  forbiddenResult.push("mutated");
  assert.equal(getForbiddenLayoutStateFields().includes("mutated"), false);

  assert.deepEqual(LAYOUT_STATE_FIELDS, [...LAYOUT_STATE_REQUIRED_FIELDS, ...LAYOUT_STATE_OPTIONAL_FIELDS]);

  const values = completeValues();
  assert.deepEqual(createLayoutStateRecord(values), values);

  const withUnknown = {
    ...completeValues(),
    unknown: "removed",
    anotherUnknown: true,
  };
  const normalized = normalizeLayoutStateRecord(withUnknown);
  assert.equal(Object.prototype.hasOwnProperty.call(normalized, "unknown"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(normalized, "anotherUnknown"), false);
  assert.deepEqual(Object.keys(normalized), LAYOUT_STATE_FIELDS);

  const partial = normalizeLayoutStateRecord({ elementId: "workspace.only", layoutValue: { width: 10 } });
  assert.deepEqual(partial, { elementId: "workspace.only", layoutValue: { width: 10 } });
  assert.equal(Object.prototype.hasOwnProperty.call(partial, "layoutProfileId"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(partial, "version"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(partial, "createdAt"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(partial, "updatedAt"), false);

  const input = completeValues();
  const record = createLayoutStateRecord(input);
  assert.notEqual(record.layoutValue, input.layoutValue);
  assert.notEqual(record.layoutValue.placement, input.layoutValue.placement);
  assert.notEqual(record.layoutValue.flags, input.layoutValue.flags);
  input.layoutValue.placement.x = 99;
  input.layoutValue.flags.push("mutated");
  assert.deepEqual(record.layoutValue, {
    width: 320,
    placement: { x: 4, y: 8 },
    flags: ["compact"],
  });

  const fachNeutral = createLayoutStateRecord({
    ...completeValues(),
    recordId: "not-copied",
    tableName: "not-copied",
    database: "not-copied",
    project: "not-copied",
    task: "not-copied",
    layoutValue: {
      width: 10,
      recordId: "not-copied",
      nested: { tableName: "not-copied", height: 12 },
    },
  });
  ["recordId", "tableName", "database", "project", "task"].forEach((fieldName) => {
    assert.equal(Object.prototype.hasOwnProperty.call(fachNeutral, fieldName), false);
  });
  assert.deepEqual(fachNeutral.layoutValue, { width: 10, nested: { height: 12 } });

  assert.equal(Object.prototype.hasOwnProperty.call(normalizeLayoutStateRecord({ elementId: "only" }), "version"), false);
  assert.deepEqual(normalizeLayoutStateRecord({ layoutValue: { width: 10 } }), { layoutValue: { width: 10 } });
  assert.equal(Object.prototype.hasOwnProperty.call(normalizeLayoutStateRecord({ elementId: "only" }), "createdAt"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(normalizeLayoutStateRecord({ elementId: "only" }), "updatedAt"), false);

  let sideEffectExecuted = false;
  const operationOnlyValue = createLayoutStateRecord({
    ...completeValues(),
    writeFile() {
      sideEffectExecuted = true;
    },
  });
  assert.equal(operationOnlyValue.operation, "resize");
  assert.equal(sideEffectExecuted, false);
  assert.equal(Object.prototype.hasOwnProperty.call(operationOnlyValue, "writeFile"), false);

  const moduleText = fs.readFileSync(MODEL_PATH, "utf8");
  assertNoForbiddenFragments(moduleText, "layout-state-model");

  console.log("TESTS OK: layout-state-model");
}

run();
