"use strict";

const { normalizeChangeRequest } = require("./change-request-model.cjs");
const { validateChangeRequest } = require("./change-request-validator.cjs");

function cloneNeutralValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneNeutralValue(entry));
  }

  if (value && typeof value === "object") {
    const clone = {};
    Object.keys(value).forEach((key) => {
      clone[key] = cloneNeutralValue(value[key]);
    });
    return clone;
  }

  return value;
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(source, key) {
  return Object.prototype.hasOwnProperty.call(source, key);
}

function hasFunction(source, name) {
  return isObject(source) && typeof source[name] === "function";
}

function assertEditorCore(editorCore) {
  const requiredMethods = ["hasElement", "canElementPerformOperation", "getElementDetails"];

  if (!isObject(editorCore)) {
    throw new TypeError("createEditorChangeDraftViewModel erwartet einen Editor-Core.");
  }

  requiredMethods.forEach((methodName) => {
    if (typeof editorCore[methodName] !== "function") {
      throw new TypeError(`createEditorChangeDraftViewModel erwartet einen Editor-Core mit ${methodName}().`);
    }
  });
}

function normalizeOptions(options) {
  if (options === undefined || options === null) {
    return { includeRawChangeRequest: false };
  }

  if (!isObject(options)) {
    throw new TypeError("Editor-Change-Draft-ViewModel-Optionen muessen ein Objekt sein.");
  }

  return {
    includeRawChangeRequest: options.includeRawChangeRequest === true,
  };
}

function createPayloadRows(payload) {
  if (!isObject(payload)) {
    return [];
  }

  return Object.keys(payload).map((field) => ({
    field,
    value: cloneNeutralValue(payload[field]),
  }));
}

function createElementSummary(editorCore, elementId) {
  if (!hasFunction(editorCore, "getElementDetails")) {
    return null;
  }

  const element = editorCore.getElementDetails(elementId);
  if (element === null) {
    return null;
  }

  if (!isObject(element)) {
    throw new TypeError("Editor-Core lieferte keine gueltigen Elementdetails.");
  }

  return {
    id: hasOwn(element, "id") ? cloneNeutralValue(element.id) : elementId,
    label: hasOwn(element, "name") ? cloneNeutralValue(element.name) : null,
    type: hasOwn(element, "type") ? cloneNeutralValue(element.type) : null,
    role: hasOwn(element, "role") ? cloneNeutralValue(element.role) : null,
    visible: hasOwn(element, "visible") ? cloneNeutralValue(element.visible) : null,
    editable: hasOwn(element, "editable") ? cloneNeutralValue(element.editable) : null,
  };
}

function normalizeOperationList(operations, fieldName) {
  if (!Array.isArray(operations[fieldName])) {
    return [];
  }

  return operations[fieldName].map((operation) => cloneNeutralValue(operation));
}

function createOperationSummary(editorCore, elementId, operation) {
  if (!hasFunction(editorCore, "getElementOperations")) {
    return null;
  }

  const operations = editorCore.getElementOperations(elementId);
  if (operations === null) {
    return null;
  }

  if (!isObject(operations)) {
    throw new TypeError("Editor-Core lieferte keine gueltigen Elementoperationen.");
  }

  const allowedOps = normalizeOperationList(operations, "allowedOps");
  const lockedOps = normalizeOperationList(operations, "lockedOps");
  const availableOps = normalizeOperationList(operations, "availableOps");

  return {
    operation: cloneNeutralValue(operation),
    isAllowed: allowedOps.includes(operation),
    isLocked: lockedOps.includes(operation),
    isAvailable: availableOps.includes(operation),
    allowedOps,
    lockedOps,
    availableOps,
  };
}

function normalizeValidationResult(result) {
  return {
    ok: Boolean(result && result.ok),
    errors: Array.isArray(result && result.errors) ? result.errors.map((error) => cloneNeutralValue(error)) : [],
  };
}

function createEditorChangeDraftViewModel(editorCore, changeRequest, options) {
  assertEditorCore(editorCore);
  const normalizedOptions = normalizeOptions(options);
  const normalizedChangeRequest = normalizeChangeRequest(changeRequest);
  const validation = normalizeValidationResult(validateChangeRequest(changeRequest, editorCore));

  const viewModel = {
    changeId: hasOwn(normalizedChangeRequest, "changeId") ? cloneNeutralValue(normalizedChangeRequest.changeId) : undefined,
    elementId: hasOwn(normalizedChangeRequest, "elementId") ? cloneNeutralValue(normalizedChangeRequest.elementId) : undefined,
    operation: hasOwn(normalizedChangeRequest, "operation") ? cloneNeutralValue(normalizedChangeRequest.operation) : undefined,
    source: hasOwn(normalizedChangeRequest, "source") ? cloneNeutralValue(normalizedChangeRequest.source) : undefined,
    createdAt: hasOwn(normalizedChangeRequest, "createdAt") ? cloneNeutralValue(normalizedChangeRequest.createdAt) : undefined,
    payloadRows: createPayloadRows(normalizedChangeRequest.payload),
    elementSummary: createElementSummary(editorCore, normalizedChangeRequest.elementId),
    operationSummary: createOperationSummary(editorCore, normalizedChangeRequest.elementId, normalizedChangeRequest.operation),
    validation,
    canSubmit: validation.ok === true,
  };

  if (normalizedOptions.includeRawChangeRequest) {
    viewModel.rawChangeRequest = cloneNeutralValue(normalizedChangeRequest);
  }

  return cloneNeutralValue(viewModel);
}

module.exports = {
  createEditorChangeDraftViewModel,
};
