"use strict";

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

function hasFunction(source, name) {
  return isObject(source) && typeof source[name] === "function";
}

function hasOwn(source, key) {
  return Object.prototype.hasOwnProperty.call(source, key);
}

function assertEditorCore(editorCore) {
  if (!isObject(editorCore) || !hasFunction(editorCore, "getElementDetails")) {
    throw new TypeError("createEditorDetailsViewModel erwartet einen Editor-Core mit getElementDetails().");
  }
}

function normalizeOptions(options) {
  if (options === undefined || options === null) {
    return { includeElementRaw: true };
  }

  if (!isObject(options)) {
    throw new TypeError("Editor-Details-ViewModel-Optionen muessen ein Objekt sein.");
  }

  return {
    includeElementRaw: options.includeElementRaw !== false,
  };
}

function createDetailFields(element) {
  return Object.keys(element).map((field) => ({
    field,
    value: cloneNeutralValue(element[field]),
  }));
}

function normalizeOperationList(operations, fieldName) {
  if (!Array.isArray(operations[fieldName])) {
    return [];
  }

  return operations[fieldName].map((operation) => cloneNeutralValue(operation));
}

function pushOperationRow(operationRows, seenOperations, operation, state) {
  if (seenOperations.has(operation)) {
    return;
  }

  seenOperations.add(operation);
  operationRows.push({ operation: cloneNeutralValue(operation), state });
}

function createOperationRows(allowedOps, lockedOps, availableOps) {
  const lockedSet = new Set(lockedOps);
  const allowedSet = new Set(allowedOps);
  const seenOperations = new Set();
  const operationRows = [];

  availableOps.forEach((operation) => {
    if (allowedSet.has(operation) && !lockedSet.has(operation)) {
      pushOperationRow(operationRows, seenOperations, operation, "available");
    }
  });

  lockedOps.forEach((operation) => {
    pushOperationRow(operationRows, seenOperations, operation, "locked");
  });

  return operationRows;
}

function createOperationsViewModel(editorCore, elementId) {
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
    elementId: hasOwn(operations, "elementId") ? cloneNeutralValue(operations.elementId) : elementId,
    allowedOps,
    lockedOps,
    availableOps,
    operationRows: createOperationRows(allowedOps, lockedOps, availableOps),
  };
}

function createEditorDetailsViewModel(editorCore, elementId, options) {
  assertEditorCore(editorCore);
  const normalizedOptions = normalizeOptions(options);
  const element = editorCore.getElementDetails(elementId);

  if (element === null) {
    return null;
  }

  if (!isObject(element)) {
    throw new TypeError("Editor-Core lieferte keine gueltigen Elementdetails.");
  }

  const detailFields = createDetailFields(element);
  const viewModel = {
    elementId: element.id,
    label: hasOwn(element, "name") ? element.name : null,
    type: element.type,
    role: element.role,
    parentId: element.parentId,
    order: element.order,
    visible: element.visible,
    editable: element.editable,
    detailFields,
    operations: createOperationsViewModel(editorCore, elementId),
  };

  if (normalizedOptions.includeElementRaw) {
    viewModel.element = cloneNeutralValue(element);
  }

  return cloneNeutralValue(viewModel);
}

module.exports = {
  createEditorDetailsViewModel,
};
