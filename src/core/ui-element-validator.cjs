"use strict";

const {
  UI_ELEMENT_TYPES,
  UI_ELEMENT_ROLES,
  UI_ELEMENT_OPERATIONS,
  UI_ELEMENT_REQUIRED_FIELDS,
} = require("./ui-element-model.cjs");

const FORBIDDEN_UI_ELEMENT_OPERATIONS = Object.freeze([
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

const ALLOWED_TYPE_SET = new Set(UI_ELEMENT_TYPES);
const ALLOWED_ROLE_SET = new Set(UI_ELEMENT_ROLES);
const ALLOWED_OPERATION_SET = new Set(UI_ELEMENT_OPERATIONS);
const FORBIDDEN_OPERATION_SET = new Set(FORBIDDEN_UI_ELEMENT_OPERATIONS);

function hasOwn(source, key) {
  return Boolean(source) && Object.prototype.hasOwnProperty.call(source, key);
}

function isObjectElement(element) {
  return Boolean(element) && typeof element === "object" && !Array.isArray(element);
}

function getElementId(element) {
  if (!isObjectElement(element) || typeof element.id !== "string" || element.id.trim() === "") {
    return undefined;
  }

  return element.id;
}

function createError(code, message, field, elementId) {
  const error = { code, message };

  if (field !== undefined) {
    error.field = field;
  }

  if (elementId !== undefined) {
    error.elementId = elementId;
  }

  return error;
}

function validateRequiredFields(element, errors, elementId) {
  UI_ELEMENT_REQUIRED_FIELDS.forEach((fieldName) => {
    if (!hasOwn(element, fieldName)) {
      errors.push(
        createError("missing_required_field", `Pflichtfeld fehlt: ${fieldName}`, fieldName, elementId)
      );
    }
  });
}

function validateTypeAndRole(element, errors, elementId) {
  if (hasOwn(element, "type") && !ALLOWED_TYPE_SET.has(element.type)) {
    errors.push(
      createError(
        "invalid_type",
        `Ungueltiger type-Wert: ${String(element.type)}.`,
        "type",
        elementId
      )
    );
  }

  if (hasOwn(element, "role") && !ALLOWED_ROLE_SET.has(element.role)) {
    errors.push(
      createError(
        "invalid_role",
        `Ungueltiger role-Wert: ${String(element.role)}.`,
        "role",
        elementId
      )
    );
  }
}

function validateOperationsField(fieldName, element, errors, elementId) {
  if (!hasOwn(element, fieldName)) {
    return;
  }

  const operations = element[fieldName];
  if (!Array.isArray(operations)) {
    errors.push(
      createError("invalid_operations_array", `${fieldName} muss ein Array sein.`, fieldName, elementId)
    );
    return;
  }

  operations.forEach((operation) => {
    if (!ALLOWED_OPERATION_SET.has(operation)) {
      errors.push(
        createError(
          "invalid_operation",
          `Ungueltige Operation in ${fieldName}: ${String(operation)}.`,
          fieldName,
          elementId
        )
      );
    }

    if (FORBIDDEN_OPERATION_SET.has(operation)) {
      errors.push(
        createError(
          "forbidden_operation",
          `Fachliche Operation ist nicht erlaubt: ${String(operation)}.`,
          fieldName,
          elementId
        )
      );
    }
  });
}

function validateOperationConflicts(element, errors, elementId) {
  if (!Array.isArray(element.allowedOps) || !Array.isArray(element.lockedOps)) {
    return;
  }

  const lockedOpsSet = new Set(element.lockedOps);
  element.allowedOps.forEach((operation) => {
    if (lockedOpsSet.has(operation)) {
      errors.push(
        createError(
          "conflicting_operation",
          `Operation gleichzeitig erlaubt und gesperrt: ${String(operation)}.`,
          "allowedOps",
          elementId
        )
      );
    }
  });
}

function validateUiElement(element) {
  const errors = [];

  if (!element || typeof element !== "object") {
    return {
      ok: false,
      errors: [createError("invalid_element", "Element muss ein Objekt sein.")],
    };
  }

  if (Array.isArray(element)) {
    return {
      ok: false,
      errors: [createError("invalid_element", "Arrays sind keine gueltigen UI-Elemente.")],
    };
  }

  const elementId = getElementId(element);

  validateRequiredFields(element, errors, elementId);
  validateTypeAndRole(element, errors, elementId);
  validateOperationsField("allowedOps", element, errors, elementId);
  validateOperationsField("lockedOps", element, errors, elementId);
  validateOperationConflicts(element, errors, elementId);

  return {
    ok: errors.length === 0,
    errors,
  };
}

function validateUiElementList(elements) {
  if (!Array.isArray(elements)) {
    return {
      ok: false,
      errors: [createError("invalid_element_list", "Elementliste muss ein Array sein.")],
    };
  }

  const errors = [];
  elements.forEach((element) => {
    const result = validateUiElement(element);
    errors.push(...result.errors);
  });

  return {
    ok: errors.length === 0,
    errors,
  };
}

module.exports = {
  FORBIDDEN_UI_ELEMENT_OPERATIONS,
  validateUiElement,
  validateUiElementList,
};
