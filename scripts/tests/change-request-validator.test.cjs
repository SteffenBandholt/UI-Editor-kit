#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const VALIDATOR_PATH = path.join(REPO_ROOT, "src/core/change-request-validator.cjs");
const { createUiElementRegistry } = require(path.join(REPO_ROOT, "src/core/ui-element-registry.cjs"));
const { createEditorCore } = require(path.join(REPO_ROOT, "src/core/editor-core.cjs"));

function loadValidatorModule() {
  delete require.cache[VALIDATOR_PATH];
  return require(VALIDATOR_PATH);
}

function validChangeRequest(overrides) {
  return {
    changeId: "change-001",
    elementId: "workspace.main.area",
    operation: "move",
    payload: { width: 24 },
    createdAt: "2026-06-01T00:00:00.000Z",
    source: "contract-test",
    ...(overrides || {}),
  };
}

function validElements() {
  return [
    {
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
    },
    {
      id: "workspace.main.area",
      name: "Bereich",
      type: "area",
      role: "layout",
      parentId: "workspace.root",
      order: 1,
      visible: true,
      editable: true,
      allowedOps: ["inspect", "move", "resize"],
      lockedOps: [],
    },
  ];
}

function createRealCore() {
  const registry = createUiElementRegistry();
  validElements().forEach((element) => registry.registerElement(element));
  return createEditorCore(registry);
}

function createStubCore(options) {
  const settings = {
    exists: true,
    canPerform: true,
    lockedOps: [],
    ...(options || {}),
  };
  const calls = [];
  const core = {
    calls,
    hasElement(elementId) {
      calls.push(["hasElement", elementId]);
      return settings.exists;
    },
    canElementPerformOperation(elementId, operation) {
      calls.push(["canElementPerformOperation", elementId, operation]);
      return settings.canPerform;
    },
    getElementDetails(elementId) {
      calls.push(["getElementDetails", elementId]);
      return {
        id: elementId,
        allowedOps: ["inspect", "move", "resize"],
        lockedOps: settings.lockedOps.slice(),
      };
    },
  };
  return core;
}

function findError(result, code, field) {
  return result.errors.find((error) => error.code === code && (field === undefined || error.field === field));
}

function assertRejectedWith(result, code, field) {
  assert.equal(result.ok, false);
  assert.ok(findError(result, code, field), `Fehlercode nicht gefunden: ${code}`);
}

function assertNoForbiddenFragments(text, label) {
  const forbiddenFragments = [
    "host-adapter",
    "target-app",
    "layout-store",
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
  const { ALLOWED_LAYOUT_PAYLOAD_FIELDS, validateChangeRequest, validateChangeRequestShape } = loadValidatorModule();
  assert.deepEqual(Array.from(ALLOWED_LAYOUT_PAYLOAD_FIELDS), ["x", "y", "width", "height", "spacing", "order", "visibility", "visible", "label"]);

  const realCore = createRealCore();
  assert.deepEqual(validateChangeRequest(validChangeRequest(), realCore), { ok: true, errors: [] });

  assertRejectedWith(validateChangeRequest(null, realCore), "invalid_change_request");
  assertRejectedWith(validateChangeRequest("change", realCore), "invalid_change_request");
  assertRejectedWith(validateChangeRequest([], realCore), "invalid_change_request");


  const withoutElementId = validChangeRequest();
  delete withoutElementId.elementId;
  const missingField = validateChangeRequest(withoutElementId, realCore);
  assertRejectedWith(missingField, "missing_required_field", "elementId");
  assert.equal(findError(missingField, "missing_required_field", "elementId").message, "Pflichtfeld fehlt: elementId");

  assertRejectedWith(validateChangeRequest(validChangeRequest({ payload: "wide" }), realCore), "invalid_payload", "payload");
  assertRejectedWith(validateChangeRequest(validChangeRequest({ payload: [] }), realCore), "invalid_payload", "payload");
  assertRejectedWith(validateChangeRequest(validChangeRequest({ payload: { status: "open" } }), realCore), "invalid_payload", "payload.status");
  assertRejectedWith(validateChangeRequest(validChangeRequest({ payload: { label: "Neutral" } }), realCore), "forbidden_field", "payload.label");
  assert.equal(validateChangeRequest(validChangeRequest({ payload: { label: "Neutral" }, allowedPayloadFields: ["label"] }), realCore).ok, true);

  assertRejectedWith(validateChangeRequest(validChangeRequest({ recordId: "rec-001" }), realCore), "forbidden_field", "recordId");
  assertRejectedWith(validateChangeRequest(validChangeRequest({ database: "not-allowed" }), realCore), "forbidden_field", "database");
  assertRejectedWith(
    validateChangeRequest(validChangeRequest({ payload: { width: 10, recordId: "rec-001" } }), realCore),
    "forbidden_field",
    "payload.recordId"
  );

  assertRejectedWith(validateChangeRequest(validChangeRequest(), null), "invalid_editor_core");
  assertRejectedWith(validateChangeRequest(validChangeRequest(), {}), "invalid_editor_core", "hasElement");
  assertRejectedWith(
    validateChangeRequest(validChangeRequest(), {
      canElementPerformOperation() {
        return true;
      },
      getElementDetails() {
        return {};
      },
    }),
    "invalid_editor_core",
    "hasElement"
  );
  assertRejectedWith(
    validateChangeRequest(validChangeRequest(), {
      hasElement() {
        return true;
      },
      getElementDetails() {
        return {};
      },
    }),
    "invalid_editor_core",
    "canElementPerformOperation"
  );
  assertRejectedWith(
    validateChangeRequest(validChangeRequest(), {
      hasElement() {
        return true;
      },
      canElementPerformOperation() {
        return true;
      },
    }),
    "invalid_editor_core",
    "getElementDetails"
  );

  const unknownElementCore = createStubCore({ exists: false });
  const unknownElement = validateChangeRequest(validChangeRequest({ elementId: "workspace.unknown" }), unknownElementCore);
  assertRejectedWith(unknownElement, "unknown_element");
  assert.deepEqual(unknownElementCore.calls, [["hasElement", "workspace.unknown"]]);

  const deniedCore = createStubCore({ canPerform: false });
  assertRejectedWith(validateChangeRequest(validChangeRequest({ operation: "hide" }), deniedCore), "operation_not_allowed", "operation");

  const lockedCore = createStubCore({ canPerform: false, lockedOps: ["move"] });
  const lockedResult = validateChangeRequest(validChangeRequest({ operation: "move" }), lockedCore);
  assertRejectedWith(lockedResult, "operation_locked", "operation");
  assert.match(findError(lockedResult, "operation_locked", "operation").message, /gesperrt/);

  assert.deepEqual(validateChangeRequest(validChangeRequest({ operation: "inspect" }), createStubCore()), {
    ok: true,
    errors: [],
  });

  const coreBeforeValidation = realCore.listElements();
  assert.equal(validateChangeRequest(validChangeRequest({ operation: "resize" }), realCore).ok, true);
  assert.deepEqual(realCore.listElements(), coreBeforeValidation);

  const unknownOperationResult = validateChangeRequest(validChangeRequest({ operation: "unknownOperation" }), createStubCore({ canPerform: false }));
  assertRejectedWith(unknownOperationResult, "operation_not_allowed", "operation");

  const requestBeforeValidation = validChangeRequest({ payload: { width: 10 } });
  const requestSnapshot = JSON.stringify(requestBeforeValidation);
  const immutableCore = createStubCore();
  const coreKeysBefore = Object.keys(immutableCore).sort();
  const coreCallsReference = immutableCore.calls;
  assert.equal(validateChangeRequest(requestBeforeValidation, immutableCore).ok, true);
  assert.equal(JSON.stringify(requestBeforeValidation), requestSnapshot);
  assert.deepEqual(Object.keys(immutableCore).sort(), coreKeysBefore);
  assert.equal(immutableCore.calls, coreCallsReference);

  let executed = false;
  const requestWithCallablePayload = validChangeRequest({
    payload: {
      run() {
        executed = true;
      },
    },
  });
  assertRejectedWith(validateChangeRequest(requestWithCallablePayload, createStubCore()), "invalid_payload", "payload.run");
  assert.equal(executed, false);

  assert.deepEqual(validateChangeRequestShape(validChangeRequest()), { ok: true, errors: [] });
  assertRejectedWith(validateChangeRequestShape(validChangeRequest({ database: "not-allowed" })), "forbidden_field", "database");

  const validatorSource = fs.readFileSync(VALIDATOR_PATH, "utf8");
  assertNoForbiddenFragments(validatorSource, "change-request-validator");
  assert.equal(validatorSource.includes("fs"), false);
  assert.equal(validatorSource.includes("child_process"), false);

  const forbiddenPaths = ["browser", "demo", "examples"];
  forbiddenPaths.forEach((relativePath) => {
    assert.equal(fs.existsSync(path.join(REPO_ROOT, relativePath)), false, `Nebenpfad vorhanden: ${relativePath}`);
  });

  console.log("TESTS OK: change-request-validator");
}

run();
