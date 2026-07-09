"use strict";

const {
  CHANGE_REQUEST_REQUIRED_FIELDS,
  getForbiddenChangeRequestFields,
} = require("./change-request-model.cjs");

const ALLOWED_LAYOUT_PAYLOAD_FIELDS = Object.freeze([
  "x",
  "y",
  "width",
  "height",
  "spacing",
  "order",
  "visibility",
  "visible",
  "label",
]);

const CONDITIONAL_LAYOUT_PAYLOAD_FIELDS = Object.freeze(["visibility", "visible", "label"]);

function isPlainRequestObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(source, key) {
  return Boolean(source) && Object.prototype.hasOwnProperty.call(source, key);
}

function createResult(errors) {
  return {
    ok: errors.length === 0,
    errors,
  };
}

function createError(changeRequest, code, message, details) {
  const error = {
    code,
    message,
    ...(details || {}),
  };

  if (isPlainRequestObject(changeRequest)) {
    if (hasOwn(changeRequest, "changeId") && !hasOwn(error, "changeId")) {
      error.changeId = changeRequest.changeId;
    }

    if (hasOwn(changeRequest, "elementId") && !hasOwn(error, "elementId")) {
      error.elementId = changeRequest.elementId;
    }
  }

  return error;
}


function findForbiddenFields(value, pathPrefix) {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => findForbiddenFields(entry, `${pathPrefix}[${index}]`));
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  const forbiddenFields = getForbiddenChangeRequestFields();
  return Object.keys(value).flatMap((key) => {
    const fieldPath = pathPrefix ? `${pathPrefix}.${key}` : key;
    const nested = findForbiddenFields(value[key], fieldPath);

    if (forbiddenFields.includes(key)) {
      return [fieldPath, ...nested];
    }

    return nested;
  });
}

function validatePayloadFields(changeRequest, errors) {
  if (!hasOwn(changeRequest, "payload") || !isPlainRequestObject(changeRequest.payload)) {
    return;
  }

  Object.keys(changeRequest.payload).forEach((fieldName) => {
    if (!ALLOWED_LAYOUT_PAYLOAD_FIELDS.includes(fieldName)) {
      errors.push(createError(changeRequest, "invalid_payload", `payload enthaelt keinen neutralen Layoutwert: ${fieldName}`, {
        field: `payload.${fieldName}`,
      }));
      return;
    }

    if (CONDITIONAL_LAYOUT_PAYLOAD_FIELDS.includes(fieldName)) {
      const allowedPayloadFields = Array.isArray(changeRequest.allowedPayloadFields)
        ? changeRequest.allowedPayloadFields
        : [];
      if (!allowedPayloadFields.includes(fieldName)) {
        errors.push(createError(changeRequest, "forbidden_field", `payload.${fieldName} braucht eine ausdrueckliche Ziel-App-Freigabe.`, {
          field: `payload.${fieldName}`,
        }));
      }
    }
  });
}

function validateChangeRequestShape(changeRequest) {
  const errors = [];

  if (!isPlainRequestObject(changeRequest)) {
    errors.push({
      code: "invalid_change_request",
      message: "Aenderungsauftrag muss ein Objekt sein.",
    });
    return createResult(errors);
  }

  CHANGE_REQUEST_REQUIRED_FIELDS.forEach((fieldName) => {
    if (!hasOwn(changeRequest, fieldName)) {
      errors.push(createError(changeRequest, "missing_required_field", `Pflichtfeld fehlt: ${fieldName}`, {
        field: fieldName,
      }));
    }
  });

  if (hasOwn(changeRequest, "payload")) {
    const payload = changeRequest.payload;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      errors.push(createError(changeRequest, "invalid_payload", "payload muss ein Objekt sein.", {
        field: "payload",
      }));
    }
  }

  findForbiddenFields(changeRequest, "").forEach((fieldName) => {
    errors.push(createError(changeRequest, "forbidden_field", `Verbotenes Feld vorhanden: ${fieldName}`, {
      field: fieldName,
    }));
  });

  validatePayloadFields(changeRequest, errors);

  return createResult(errors);
}

function validateEditorCore(editorCore) {
  const errors = [];

  if (!editorCore || typeof editorCore !== "object") {
    errors.push({
      code: "invalid_editor_core",
      message: "Editor-Core muss vorhanden sein.",
    });
    return createResult(errors);
  }

  ["hasElement", "canElementPerformOperation", "getElementDetails"].forEach((methodName) => {
    if (typeof editorCore[methodName] !== "function") {
      errors.push({
        code: "invalid_editor_core",
        field: methodName,
        message: `Editor-Core muss ${methodName}() bereitstellen.`,
      });
    }
  });

  return createResult(errors);
}

function isOperationLocked(elementDetails, operation) {
  return Boolean(
    elementDetails &&
      Array.isArray(elementDetails.lockedOps) &&
      elementDetails.lockedOps.includes(operation)
  );
}

function validateChangeRequest(changeRequest, editorCore) {
  const errors = [];
  const shapeResult = validateChangeRequestShape(changeRequest);
  errors.push(...shapeResult.errors);

  const editorCoreResult = validateEditorCore(editorCore);
  errors.push(...editorCoreResult.errors);

  if (!shapeResult.ok || !editorCoreResult.ok) {
    return createResult(errors);
  }

  const elementId = changeRequest.elementId;
  const operation = changeRequest.operation;
  const elementExists = editorCore.hasElement(elementId);

  if (!elementExists) {
    errors.push(createError(changeRequest, "unknown_element", `Unbekanntes Element: ${elementId}`));
    return createResult(errors);
  }

  const elementDetails = editorCore.getElementDetails(elementId);
  const operationAllowed = editorCore.canElementPerformOperation(elementId, operation);

  if (!operationAllowed) {
    const locked = isOperationLocked(elementDetails, operation);
    errors.push(createError(
      changeRequest,
      locked ? "operation_locked" : "operation_not_allowed",
      locked
        ? `Operation ist fuer dieses Element gesperrt: ${operation}`
        : `Operation ist fuer dieses Element nicht erlaubt: ${operation}`,
      { field: "operation" }
    ));
  }

  return createResult(errors);
}

module.exports = {
  ALLOWED_LAYOUT_PAYLOAD_FIELDS,
  CONDITIONAL_LAYOUT_PAYLOAD_FIELDS,
  validateChangeRequest,
  validateChangeRequestShape,
};
