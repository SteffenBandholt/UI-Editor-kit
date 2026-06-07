"use strict";

const DEFAULT_TARGET_ATTRIBUTE_NAME = "data-ui-editor-id";

const ERROR_CODES = Object.freeze({
  INVALID_ELEMENTS: "INVALID_ELEMENTS",
  INVALID_ROOT: "INVALID_ROOT",
  INVALID_TARGET_ATTRIBUTE_NAME: "INVALID_TARGET_ATTRIBUTE_NAME",
  INVALID_REGISTRY_ELEMENT: "INVALID_REGISTRY_ELEMENT",
  DUPLICATE_REGISTRY_ID: "DUPLICATE_REGISTRY_ID",
  DOM_TARGET_MISSING: "DOM_TARGET_MISSING",
  PARENT_ID_UNKNOWN: "PARENT_ID_UNKNOWN",
  DOM_PARENT_MISMATCH: "DOM_PARENT_MISMATCH",
  GROUP_WITHOUT_DOM_WRAPPER: "GROUP_WITHOUT_DOM_WRAPPER",
  FIELD_NOT_INSIDE_GROUP: "FIELD_NOT_INSIDE_GROUP",
});

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeAttributeName(value) {
  const attributeName = typeof value === "string" && value.trim() !== "" ? value.trim() : DEFAULT_TARGET_ATTRIBUTE_NAME;
  if (!/^[A-Za-z_][A-Za-z0-9_.:-]*$/u.test(attributeName)) return null;
  return attributeName;
}

function normalizeElementId(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function isVirtualElement(element) {
  return Boolean(
    element?.virtual === true ||
      element?.isVirtual === true ||
      element?.domVirtual === true ||
      element?.targetVirtual === true
  );
}

function createError(code, message, details = {}) {
  return {
    code,
    message,
    ...details,
  };
}

function normalizeRegistryElement(element) {
  if (!isObject(element)) return null;
  const id = normalizeElementId(element.id);
  if (!id) return null;
  return {
    ...element,
    id,
    type: typeof element.type === "string" ? element.type.trim() : "",
    role: typeof element.role === "string" ? element.role.trim() : "",
    parentId: element.parentId == null ? null : normalizeElementId(element.parentId),
    virtual: isVirtualElement(element),
  };
}

function escapeAttributeValue(value) {
  return String(value).replace(/\\/gu, "\\\\").replace(/"/gu, '\\"');
}

function findTargetElement(root, elementId, targetAttributeName) {
  if (!root || !elementId) return null;
  if (typeof root.getAttribute === "function" && root.getAttribute(targetAttributeName) === elementId) {
    return root;
  }
  if (typeof root.querySelector !== "function") return null;
  return root.querySelector(`[${targetAttributeName}="${escapeAttributeValue(elementId)}"]`);
}

function collectTargetNodes(elements, root, targetAttributeName) {
  const nodesById = new Map();
  for (const element of elements) {
    if (element.virtual) continue;
    nodesById.set(element.id, findTargetElement(root, element.id, targetAttributeName));
  }
  return nodesById;
}

function findNearestRegisteredAncestorId(node, registeredIds, targetAttributeName) {
  let current = node?.parentElement || null;
  while (current) {
    if (typeof current.getAttribute === "function") {
      const id = normalizeElementId(current.getAttribute(targetAttributeName));
      if (id && registeredIds.has(id)) return id;
    }
    current = current.parentElement || null;
  }
  return null;
}

function isGroupElement(element) {
  return element?.type === "group";
}

function isLeafTargetElement(element) {
  return ["field", "button", "switch", "toggle"].includes(element?.type);
}

function validateTargetContract(options = {}) {
  const normalizedOptions = isObject(options) ? options : {};
  const elementsInput = Array.isArray(normalizedOptions.elements)
    ? normalizedOptions.elements
    : Array.isArray(normalizedOptions.registry?.elements)
      ? normalizedOptions.registry.elements
      : null;
  const root = normalizedOptions.root || null;
  const targetAttributeName = normalizeAttributeName(normalizedOptions.targetAttributeName);
  const allowVirtualElements = normalizedOptions.allowVirtualElements !== false;
  const errors = [];

  if (!Array.isArray(elementsInput)) {
    errors.push(createError(ERROR_CODES.INVALID_ELEMENTS, "elements muss ein Array von Registry-Elementen sein."));
    return { ok: false, errors };
  }

  if (!root || (typeof root.querySelector !== "function" && typeof root.getAttribute !== "function")) {
    errors.push(createError(ERROR_CODES.INVALID_ROOT, "root muss ein DOM-Root mit getAttribute oder querySelector sein."));
    return { ok: false, errors };
  }

  if (!targetAttributeName) {
    errors.push(createError(ERROR_CODES.INVALID_TARGET_ATTRIBUTE_NAME, "targetAttributeName ist ungueltig."));
    return { ok: false, errors };
  }

  const elements = [];
  const byId = new Map();

  for (const rawElement of elementsInput) {
    const element = normalizeRegistryElement(rawElement);
    if (!element) {
      errors.push(createError(ERROR_CODES.INVALID_REGISTRY_ELEMENT, "Registry-Element braucht eine nicht-leere id."));
      continue;
    }
    if (byId.has(element.id)) {
      errors.push(createError(ERROR_CODES.DUPLICATE_REGISTRY_ID, `Registry-ID ist doppelt vorhanden: ${element.id}`, { elementId: element.id }));
      continue;
    }
    byId.set(element.id, element);
    elements.push(element);
  }

  const registeredIds = new Set(byId.keys());
  const nodesById = collectTargetNodes(elements, root, targetAttributeName);

  for (const element of elements) {
    if (element.virtual && !allowVirtualElements) {
      errors.push(createError(ERROR_CODES.DOM_TARGET_MISSING, `Virtuelles Element ist nicht erlaubt: ${element.id}`, { elementId: element.id }));
      continue;
    }

    const node = nodesById.get(element.id) || null;
    if (!element.virtual && !node) {
      errors.push(createError(ERROR_CODES.DOM_TARGET_MISSING, `DOM-Ziel fehlt fuer Registry-ID: ${element.id}`, { elementId: element.id }));
    }

    if (isGroupElement(element) && !element.virtual && !node) {
      errors.push(createError(ERROR_CODES.GROUP_WITHOUT_DOM_WRAPPER, `Gruppe braucht einen echten DOM-Wrapper: ${element.id}`, { elementId: element.id }));
    }

    if (element.parentId && !byId.has(element.parentId)) {
      errors.push(createError(ERROR_CODES.PARENT_ID_UNKNOWN, `parentId verweist auf keine Registry-ID: ${element.parentId}`, {
        elementId: element.id,
        parentId: element.parentId,
      }));
      continue;
    }

    const parent = element.parentId ? byId.get(element.parentId) : null;
    const parentNode = parent && !parent.virtual ? nodesById.get(parent.id) || null : null;
    if (!element.virtual && node && parent && !parent.virtual && parentNode) {
      const nearestRegisteredAncestorId = findNearestRegisteredAncestorId(node, registeredIds, targetAttributeName);
      if (nearestRegisteredAncestorId !== parent.id) {
        const code = isLeafTargetElement(element) ? ERROR_CODES.FIELD_NOT_INSIDE_GROUP : ERROR_CODES.DOM_PARENT_MISMATCH;
        errors.push(createError(code, `DOM-Parent passt nicht zur Registry: ${element.id} erwartet ${parent.id}`, {
          elementId: element.id,
          expectedParentId: parent.id,
          actualParentId: nearestRegisteredAncestorId,
        }));
        if (code !== ERROR_CODES.DOM_PARENT_MISMATCH) {
          errors.push(createError(ERROR_CODES.DOM_PARENT_MISMATCH, `DOM-Parent passt nicht zur Registry: ${element.id} erwartet ${parent.id}`, {
            elementId: element.id,
            expectedParentId: parent.id,
            actualParentId: nearestRegisteredAncestorId,
          }));
        }
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

module.exports = {
  DEFAULT_TARGET_ATTRIBUTE_NAME,
  ERROR_CODES,
  validateTargetContract,
  isVirtualElement,
};
