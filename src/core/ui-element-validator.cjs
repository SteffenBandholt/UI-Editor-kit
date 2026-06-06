"use strict";

const {
  UI_ELEMENT_TYPES,
  UI_ELEMENT_ROLES,
  UI_ELEMENT_OPERATIONS,
  UI_ELEMENT_REQUIRED_FIELDS,
} = require("./ui-element-model.cjs");

const UI_TABLE_COLUMN_ROLES = Object.freeze([
  "contentColumn",
  "metaColumn",
  "structureColumn",
  "statusColumn",
  "dateColumn",
  "responsibleColumn",
  "visibilityColumn",
  "actionColumn",
]);

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
const ALLOWED_TABLE_COLUMN_ROLE_SET = new Set(UI_TABLE_COLUMN_ROLES);
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

    if (fieldName === "allowedOps" && FORBIDDEN_OPERATION_SET.has(operation)) {
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

function isBlankParentId(parentId) {
  return parentId === null || parentId === "";
}

function collectElementsById(elements) {
  const elementsById = new Map();

  elements.forEach((element) => {
    const elementId = getElementId(element);
    if (elementId !== undefined && !elementsById.has(elementId)) {
      elementsById.set(elementId, element);
    }
  });

  return elementsById;
}

function validateRootCount(elements, errors) {
  const rootElements = elements.filter((element) => isObjectElement(element) && element.type === "root");

  if (rootElements.length === 0) {
    errors.push(createError("missing_root", "Elementliste muss genau ein root-Element enthalten.", "type"));
    return null;
  }

  if (rootElements.length > 1) {
    rootElements.forEach((rootElement) => {
      errors.push(
        createError(
          "multiple_roots",
          "Elementliste darf nur ein root-Element enthalten.",
          "type",
          getElementId(rootElement)
        )
      );
    });
  }

  return rootElements[0];
}

function validateParentReferences(elements, elementsById, errors) {
  elements.forEach((element) => {
    if (!isObjectElement(element)) {
      return;
    }

    const elementId = getElementId(element);

    if (element.type === "root") {
      if (hasOwn(element, "parentId") && !isBlankParentId(element.parentId)) {
        errors.push(
          createError("invalid_root_parent", "root-Element darf keinen Parent haben.", "parentId", elementId)
        );
      }
      return;
    }

    if (!hasOwn(element, "parentId") || isBlankParentId(element.parentId)) {
      errors.push(
        createError("missing_parent", "Nicht-root-Element braucht einen parentId.", "parentId", elementId)
      );
      return;
    }

    if (!elementsById.has(element.parentId)) {
      errors.push(
        createError(
          "unknown_parent",
          `parentId verweist auf kein Element: ${String(element.parentId)}.`,
          "parentId",
          elementId
        )
      );
    }
  });
}

function validateParentCycles(elements, elementsById, errors) {
  const checkedElementIds = new Set();

  elements.forEach((element) => {
    const startId = getElementId(element);
    if (startId === undefined || checkedElementIds.has(startId)) {
      return;
    }

    const pathIds = new Set();
    let currentElement = element;

    while (isObjectElement(currentElement)) {
      const currentId = getElementId(currentElement);
      if (currentId === undefined) {
        return;
      }

      if (pathIds.has(currentId)) {
        errors.push(createError("parent_cycle", "Parent-Struktur enthaelt einen Zyklus.", "parentId", currentId));
        return;
      }

      if (checkedElementIds.has(currentId)) {
        return;
      }

      pathIds.add(currentId);

      if (currentElement.type === "root" || !hasOwn(currentElement, "parentId") || isBlankParentId(currentElement.parentId)) {
        pathIds.forEach((pathId) => checkedElementIds.add(pathId));
        return;
      }

      currentElement = elementsById.get(currentElement.parentId);
      if (!currentElement) {
        pathIds.forEach((pathId) => checkedElementIds.add(pathId));
        return;
      }
    }
  });
}

function validateParentStructure(elements, errors) {
  const elementsById = collectElementsById(elements);
  validateRootCount(elements, errors);
  validateParentReferences(elements, elementsById, errors);
  validateParentCycles(elements, elementsById, errors);
  return elementsById;
}

function validateActionColumnOperations(element, errors, elementId) {
  if (!Array.isArray(element.allowedOps)) {
    return;
  }

  element.allowedOps.forEach((operation) => {
    if (FORBIDDEN_OPERATION_SET.has(operation)) {
      errors.push(
        createError(
          "forbidden_action_column_operation",
          `Aktionsspalte darf keine fachliche Editoroperation fuehren: ${String(operation)}.`,
          "allowedOps",
          elementId
        )
      );
    }
  });
}

function validateTableColumns(elements, elementsById, errors) {
  elements.forEach((element) => {
    if (!isObjectElement(element) || element.type !== "tableColumn") {
      return;
    }

    const elementId = getElementId(element);

    if (
      !hasOwn(element, "columnRole") ||
      element.columnRole === undefined ||
      element.columnRole === null ||
      element.columnRole === ""
    ) {
      errors.push(
        createError("missing_column_role", "tableColumn braucht eine columnRole.", "columnRole", elementId)
      );
    } else if (!ALLOWED_TABLE_COLUMN_ROLE_SET.has(element.columnRole)) {
      errors.push(
        createError(
          "invalid_column_role",
          `Ungueltige columnRole: ${String(element.columnRole)}.`,
          "columnRole",
          elementId
        )
      );
    }

    const parentElement = elementsById.get(element.parentId);
    if (parentElement && parentElement.type !== "table") {
      errors.push(
        createError(
          "invalid_table_column_parent",
          "tableColumn braucht ein table-Element als Parent.",
          "parentId",
          elementId
        )
      );
    }

    if (element.columnRole === "actionColumn") {
      validateActionColumnOperations(element, errors, elementId);
    }
  });
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

  const elementsById = validateParentStructure(elements, errors);
  validateTableColumns(elements, elementsById, errors);

  return {
    ok: errors.length === 0,
    errors,
  };
}

module.exports = {
  FORBIDDEN_UI_ELEMENT_OPERATIONS,
  UI_TABLE_COLUMN_ROLES,
  validateUiElement,
  validateUiElementList,
};
