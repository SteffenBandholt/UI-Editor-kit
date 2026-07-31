"use strict";

const {
  CHANGE_REQUEST_REQUIRED_FIELDS,
  getForbiddenChangeRequestFields,
} = require("./change-request-model.cjs");
const { SPACING_OPERATIONS, SPACING_TARGETS, validateSpacingIntent } = require("./spacing-contract.cjs");
const { TABLE_LAYOUT_OPERATIONS, validateTableLayoutIntent } = require("./table-layout-contract.cjs");

const ALLOWED_LAYOUT_PAYLOAD_FIELDS = Object.freeze([
  "x",
  "y",
  "width",
  "height",
  "text",
  "spacing",
  "table",
  "order",
  "visibility",
  "visible",
  "label",
]);

const CONDITIONAL_LAYOUT_PAYLOAD_FIELDS = Object.freeze(["visibility", "label"]);

const OPERATION_PAYLOAD_FIELDS = Object.freeze({
  setVisibility: Object.freeze(["visible"]),
  spacingIncrease: Object.freeze(["spacing"]),
  spacingDecrease: Object.freeze(["spacing"]),
  spacingSet: Object.freeze(["spacing"]),
  spacingReset: Object.freeze(["spacing"]),
  fitTableToViewport: Object.freeze(["table"]),
  resizeColumnsProportionally: Object.freeze(["table"]),
  setHorizontalOverflowMode: Object.freeze(["table"]),
  setColumnWidthMode: Object.freeze(["table"]),
  setColumnWrapMode: Object.freeze(["table"]),
  setColumnOverflowMode: Object.freeze(["table"]),
  setRowHeightMode: Object.freeze(["table"]),
  resetTableColumn: Object.freeze(["table"]),
  resetTable: Object.freeze(["table"]),
});

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
      const explicitlyAllowed = (Array.isArray(changeRequest.allowedPayloadFields) && changeRequest.allowedPayloadFields.includes(fieldName)) ||
        (fieldName === "visible" && changeRequest.operation === "setVisibility");
      if (!explicitlyAllowed) {
        errors.push(createError(changeRequest, "forbidden_field", `payload.${fieldName} braucht eine ausdrueckliche Ziel-App-Freigabe.`, {
          field: `payload.${fieldName}`,
        }));
      }
    }
  });

  const operationFields = OPERATION_PAYLOAD_FIELDS[changeRequest.operation];
  if (operationFields) {
    Object.keys(changeRequest.payload).forEach((fieldName) => {
      if (!operationFields.includes(fieldName)) {
        errors.push(createError(changeRequest, "invalid_payload", `payload.${fieldName} ist fuer ${changeRequest.operation} nicht erlaubt.`, {
          field: `payload.${fieldName}`,
        }));
      }
    });
  }

  if (changeRequest.operation === "setVisibility" && typeof changeRequest.payload.visible !== "boolean") {
    errors.push(createError(changeRequest, "invalid_payload", "setVisibility erwartet payload.visible als Boolean.", {
      field: "payload.visible",
    }));
  }

  if (SPACING_OPERATIONS.includes(changeRequest.operation)) {
    const spacingResult = validateSpacingIntent(changeRequest.operation, changeRequest.payload, SPACING_TARGETS);
    spacingResult.errors.forEach((error) => errors.push(createError(changeRequest, error.code, "Layoutabstand ist ungueltig oder nicht freigegeben.", { field: error.field })));
  }

  if (TABLE_LAYOUT_OPERATIONS.includes(changeRequest.operation)) {
    const tableResult = validateTableLayoutIntent(changeRequest.operation, changeRequest.payload);
    tableResult.errors.forEach((entry) => errors.push(createError(changeRequest, entry.code, entry.message, { field: entry.field })));
  }

  if (hasOwn(changeRequest.payload, "text")) {
    const text = changeRequest.payload.text;
    if (!isPlainRequestObject(text)) {
      errors.push(createError(changeRequest, "invalid_payload", "payload.text muss ein Objekt sein.", {
        field: "payload.text",
      }));
      return;
    }

    const allowedTextFields = changeRequest.operation === "textResize"
      ? ["fontSize", "unit", "expectedCurrentFontSize"]
      : ["offsetX", "offsetY", "fontSize"];
    Object.keys(text).forEach((fieldName) => {
      if (!allowedTextFields.includes(fieldName)) {
        errors.push(createError(changeRequest, "invalid_payload", `payload.text enthaelt keinen neutralen Textlayoutwert: ${fieldName}`, {
          field: `payload.text.${fieldName}`,
        }));
      }
    });
    if (changeRequest.operation === "textResize") {
      const fontSize = Number(text.fontSize);
      const expected = text.expectedCurrentFontSize === undefined ? null : Number(text.expectedCurrentFontSize);
      if (!Number.isFinite(fontSize) || fontSize <= 0 || text.unit !== undefined && text.unit !== "dip" ||
          expected !== null && (!Number.isFinite(expected) || expected <= 0)) {
        errors.push(createError(changeRequest, "invalid_payload", "textResize erwartet einen positiven DIP-Wert und optional einen positiven erwarteten Istwert.", {
          field: "payload.text",
        }));
      }
    }
  }
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
  OPERATION_PAYLOAD_FIELDS,
  validateChangeRequest,
  validateChangeRequestShape,
};
