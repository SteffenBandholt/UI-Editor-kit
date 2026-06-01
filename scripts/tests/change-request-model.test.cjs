#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const MODEL_PATH = path.join(REPO_ROOT, "src/core/change-request-model.cjs");

function loadModelModule() {
  delete require.cache[MODEL_PATH];
  return require(MODEL_PATH);
}

function completeValues() {
  return {
    changeId: "change-001",
    elementId: "workspace.main.area",
    operation: "move",
    payload: {
      layout: {
        x: 4,
        y: 8,
      },
      flags: ["compact"],
    },
    createdAt: "2026-06-01T00:00:00.000Z",
    source: "contract-test",
    note: "Layoutwunsch",
    reason: "Freigegebene Anpassung",
    scope: "element",
    requestedBy: "tester",
  };
}

function assertNoForbiddenFragments(text, label) {
  const forbiddenFragments = [
    "editor-ui",
    "host-adapter",
    "target-app",
    "document.",
    "window.",
    "querySelector",
    "createElement",
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
    CHANGE_REQUEST_REQUIRED_FIELDS,
    CHANGE_REQUEST_OPTIONAL_FIELDS,
    CHANGE_REQUEST_FIELDS,
    FORBIDDEN_CHANGE_REQUEST_FIELDS,
    normalizeChangeRequest,
    createChangeRequest,
    getChangeRequestFields,
    getForbiddenChangeRequestFields,
  } = loadModelModule();

  assert.deepEqual(CHANGE_REQUEST_REQUIRED_FIELDS, [
    "changeId",
    "elementId",
    "operation",
    "payload",
    "createdAt",
    "source",
  ]);

  assert.deepEqual(getChangeRequestFields().required, [
    "changeId",
    "elementId",
    "operation",
    "payload",
    "createdAt",
    "source",
  ]);

  assert.deepEqual(CHANGE_REQUEST_OPTIONAL_FIELDS, ["note", "reason", "scope", "requestedBy"]);
  assert.deepEqual(getChangeRequestFields().optional, ["note", "reason", "scope", "requestedBy"]);

  assert.deepEqual(FORBIDDEN_CHANGE_REQUEST_FIELDS, [
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
  ]);
  assert.deepEqual(getForbiddenChangeRequestFields(), FORBIDDEN_CHANGE_REQUEST_FIELDS);

  const fieldResult = getChangeRequestFields();
  fieldResult.required.push("mutated");
  fieldResult.optional.push("mutated");
  assert.equal(getChangeRequestFields().required.includes("mutated"), false);
  assert.equal(getChangeRequestFields().optional.includes("mutated"), false);

  const forbiddenResult = getForbiddenChangeRequestFields();
  forbiddenResult.push("mutated");
  assert.equal(getForbiddenChangeRequestFields().includes("mutated"), false);

  assert.deepEqual(CHANGE_REQUEST_FIELDS, [
    "changeId",
    "elementId",
    "operation",
    "payload",
    "createdAt",
    "source",
    "note",
    "reason",
    "scope",
    "requestedBy",
  ]);

  const values = completeValues();
  assert.deepEqual(createChangeRequest(values), values);

  const withUnknown = {
    ...completeValues(),
    unknown: "removed",
    anotherUnknown: true,
  };
  const normalized = normalizeChangeRequest(withUnknown);
  assert.equal(Object.prototype.hasOwnProperty.call(normalized, "unknown"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(normalized, "anotherUnknown"), false);
  assert.deepEqual(Object.keys(normalized), CHANGE_REQUEST_FIELDS);

  const partial = normalizeChangeRequest({ elementId: "workspace.only", payload: { width: 10 } });
  assert.deepEqual(partial, { elementId: "workspace.only", payload: { width: 10 } });
  assert.equal(Object.prototype.hasOwnProperty.call(partial, "changeId"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(partial, "operation"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(partial, "createdAt"), false);

  const input = completeValues();
  const request = createChangeRequest(input);
  assert.notEqual(request.payload, input.payload);
  assert.notEqual(request.payload.layout, input.payload.layout);
  assert.notEqual(request.payload.flags, input.payload.flags);
  input.payload.layout.x = 99;
  input.payload.flags.push("mutated");
  assert.deepEqual(request.payload, {
    layout: {
      x: 4,
      y: 8,
    },
    flags: ["compact"],
  });

  const payloadWithForbiddenFields = createChangeRequest({
    ...completeValues(),
    payload: {
      width: 10,
      recordId: "not-copied",
      nested: { tableName: "not-copied", height: 12 },
    },
  });
  assert.deepEqual(payloadWithForbiddenFields.payload, {
    width: 10,
    nested: { height: 12 },
  });

  const fachNeutral = normalizeChangeRequest({
    ...completeValues(),
    recordId: "not-copied",
    tableName: "not-copied",
    database: "not-copied",
  });
  assert.equal(Object.prototype.hasOwnProperty.call(fachNeutral, "recordId"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(fachNeutral, "tableName"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(fachNeutral, "database"), false);

  let operationExecuted = false;
  const operationOnlyValue = createChangeRequest({
    changeId: "change-002",
    elementId: "workspace.main.area",
    operation: "move",
    payload: { width: 12 },
    createdAt: "2026-06-01T00:00:00.000Z",
    source: "contract-test",
    execute() {
      operationExecuted = true;
    },
  });
  assert.equal(operationOnlyValue.operation, "move");
  assert.equal(operationExecuted, false);
  assert.equal(Object.prototype.hasOwnProperty.call(operationOnlyValue, "execute"), false);

  const unknownElementRequest = createChangeRequest({
    elementId: "workspace.not-checked",
  });
  assert.deepEqual(unknownElementRequest, { elementId: "workspace.not-checked" });

  assert.deepEqual(createChangeRequest({ changeId: "change-003" }), { changeId: "change-003" });
  assert.equal(Object.prototype.hasOwnProperty.call(createChangeRequest({}), "createdAt"), false);

  const source = fs.readFileSync(MODEL_PATH, "utf8");
  assertNoForbiddenFragments(source, "change-request-model");
  assert.equal(source.includes("require("), false);

  console.log("TESTS OK: change-request-model");
}

run();
