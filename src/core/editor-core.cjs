"use strict";

const { validateUiElementList } = require("./ui-element-validator.cjs");

function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneValue(entry));
  }

  if (value && typeof value === "object") {
    const clone = {};
    Object.keys(value).forEach((key) => {
      clone[key] = cloneValue(value[key]);
    });
    return clone;
  }

  return value;
}

function cloneElements(elements) {
  return elements.map((element) => cloneValue(element));
}

function cloneValidationResult(result) {
  return {
    ok: Boolean(result && result.ok),
    errors: Array.isArray(result && result.errors) ? result.errors.map((error) => cloneValue(error)) : [],
  };
}

function cloneElementTreeNode(node) {
  return {
    element: cloneValue(node.element),
    children: node.children.map((childNode) => cloneElementTreeNode(childNode)),
  };
}

function getAvailableOperations(element) {
  const lockedOpsSet = new Set(element.lockedOps);
  return element.allowedOps.filter((operation) => !lockedOpsSet.has(operation));
}

function cloneElementOperations(element) {
  return {
    elementId: element.id,
    allowedOps: element.allowedOps.slice(),
    lockedOps: element.lockedOps.slice(),
    availableOps: getAvailableOperations(element),
  };
}

function createEditorCoreError(message, validationResult) {
  const error = new Error(message);
  error.validationResult = cloneValidationResult(validationResult);
  return error;
}

function validateRegistryInterface(registry) {
  if (!registry || typeof registry !== "object") {
    return {
      ok: false,
      errors: [
        {
          code: "invalid_registry",
          message: "Editor-Core erwartet eine vorhandene Registry.",
        },
      ],
    };
  }

  if (typeof registry.listElements !== "function") {
    return {
      ok: false,
      errors: [
        {
          code: "invalid_registry_interface",
          message: "Registry muss eine listElements()-Funktion bereitstellen.",
        },
      ],
    };
  }

  return {
    ok: true,
    errors: [],
  };
}

function compareElementsByOrder(leftElement, rightElement) {
  return leftElement.order - rightElement.order;
}

function buildElementTree(elements) {
  const nodesById = new Map();

  elements.forEach((element) => {
    nodesById.set(element.id, {
      element,
      children: [],
    });
  });

  let rootNode = null;

  elements.forEach((element) => {
    const node = nodesById.get(element.id);

    if (element.type === "root") {
      rootNode = node;
      return;
    }

    const parentNode = nodesById.get(element.parentId);
    if (parentNode) {
      parentNode.children.push(node);
    }
  });

  nodesById.forEach((node) => {
    node.children.sort((leftNode, rightNode) => compareElementsByOrder(leftNode.element, rightNode.element));
  });

  return rootNode;
}

function createEditorCore(registry) {
  const registryValidationResult = validateRegistryInterface(registry);
  if (!registryValidationResult.ok) {
    throw createEditorCoreError("Ungueltige Registry fuer Editor-Core.", registryValidationResult);
  }

  const listedElements = registry.listElements();
  const validationResult = validateUiElementList(listedElements);
  if (!validationResult.ok) {
    throw createEditorCoreError("Registry enthaelt ungueltige UI-Elemente.", validationResult);
  }

  const storedElements = cloneElements(listedElements);
  const storedValidationResult = cloneValidationResult(validationResult);
  const storedElementTree = buildElementTree(storedElements);
  const storedElementsById = new Map();

  storedElements.forEach((element) => {
    storedElementsById.set(element.id, element);
  });

  return {
    hasElement(elementId) {
      return storedElementsById.has(elementId);
    },
    getElementOperations(elementId) {
      if (!storedElementsById.has(elementId)) {
        return null;
      }

      return cloneElementOperations(storedElementsById.get(elementId));
    },
    canElementPerformOperation(elementId, operation) {
      if (!storedElementsById.has(elementId)) {
        return false;
      }

      const element = storedElementsById.get(elementId);
      if (!element.allowedOps.includes(operation)) {
        return false;
      }

      return !element.lockedOps.includes(operation);
    },
    getElementDetails(elementId) {
      if (!storedElementsById.has(elementId)) {
        return null;
      }

      return cloneValue(storedElementsById.get(elementId));
    },
    listElements() {
      return cloneElements(storedElements);
    },
    getElementTree() {
      return storedElementTree ? cloneElementTreeNode(storedElementTree) : null;
    },
    getValidationResult() {
      return cloneValidationResult(storedValidationResult);
    },
    size() {
      return storedElements.length;
    },
  };
}

module.exports = {
  createEditorCore,
};
