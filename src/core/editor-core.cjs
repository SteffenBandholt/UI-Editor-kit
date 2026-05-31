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

  return {
    listElements() {
      return cloneElements(storedElements);
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
