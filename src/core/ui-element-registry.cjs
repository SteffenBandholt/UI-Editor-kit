"use strict";

const { normalizeUiElement } = require("./ui-element-model.cjs");

function isRegistryElementObject(element) {
  return Boolean(element) && typeof element === "object" && !Array.isArray(element);
}

function cloneUiElement(element) {
  return normalizeUiElement(element);
}

function assertRegistrableElement(element) {
  if (!isRegistryElementObject(element)) {
    throw new TypeError("registerElement erwartet ein Element-Objekt.");
  }

  const normalizedElement = normalizeUiElement(element);

  if (typeof normalizedElement.id !== "string" || normalizedElement.id.trim() === "") {
    throw new TypeError("registerElement erfordert eine nicht leere string-id.");
  }

  return normalizedElement;
}

function createUiElementRegistry() {
  const elementsInOrder = [];
  const elementsById = new Map();

  function registerElement(element) {
    const normalizedElement = assertRegistrableElement(element);
    const elementId = normalizedElement.id;

    if (elementsById.has(elementId)) {
      throw new Error(`Element-ID bereits registriert: ${elementId}`);
    }

    const storedElement = cloneUiElement(normalizedElement);
    elementsInOrder.push(storedElement);
    elementsById.set(elementId, storedElement);

    return cloneUiElement(storedElement);
  }

  function getElementById(id) {
    if (!elementsById.has(id)) {
      return null;
    }

    return cloneUiElement(elementsById.get(id));
  }

  function listElements() {
    return elementsInOrder.map((element) => cloneUiElement(element));
  }

  function clear() {
    elementsInOrder.length = 0;
    elementsById.clear();
  }

  function size() {
    return elementsInOrder.length;
  }

  return {
    registerElement,
    getElementById,
    listElements,
    clear,
    size,
  };
}

module.exports = {
  createUiElementRegistry,
};
