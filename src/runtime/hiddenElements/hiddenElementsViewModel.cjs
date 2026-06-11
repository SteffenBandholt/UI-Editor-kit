"use strict";

function normalizeString(value = "") {
  return String(value == null ? "" : value).trim();
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  return fallback;
}

function normalizeHiddenElement(element = {}) {
  const source = element && typeof element === "object" ? element : {};
  const elementId = normalizeString(source.elementId || source.id);
  const label = normalizeString(source.label || source.name || elementId);
  const visible = normalizeBoolean(source.visible, true);
  const hidden = visible === false || source.hidden === true;
  const canShow = source.canShow == null ? true : source.canShow === true;

  if (!elementId) return null;

  return {
    elementId,
    label,
    visible: hidden ? false : true,
    hidden,
    canShow,
    action: "show",
    enabled: hidden && canShow,
  };
}

function getHiddenElements(elements = []) {
  if (!Array.isArray(elements)) return [];
  return elements
    .map((element) => normalizeHiddenElement(element))
    .filter((element) => element && element.hidden);
}

function buildHiddenElementsButtonViewModel(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const hiddenElements = getHiddenElements(source.elements);
  const hiddenCount = hiddenElements.length;
  const showWhenEmpty = source.showWhenEmpty === true;

  return {
    visible: hiddenCount > 0 || showWhenEmpty,
    enabled: hiddenCount > 0,
    label: hiddenCount > 0 ? `Ausgeblendete: ${hiddenCount}` : "Ausgeblendete: 0",
    hiddenCount,
  };
}

function buildHiddenElementsPopoverViewModel(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const hiddenElements = getHiddenElements(source.elements);

  return {
    title: normalizeString(source.title) || "Ausgeblendete Elemente",
    items: hiddenElements.map((element) => ({
      elementId: element.elementId,
      label: element.label,
      action: "show",
      enabled: element.canShow === true,
    })),
  };
}

function buildHiddenElementsViewModel(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const hiddenElements = getHiddenElements(source.elements);
  const button = buildHiddenElementsButtonViewModel(source);
  const popover = buildHiddenElementsPopoverViewModel(source);

  return {
    hiddenCount: hiddenElements.length,
    button,
    popover,
  };
}

module.exports = {
  normalizeHiddenElement,
  getHiddenElements,
  buildHiddenElementsButtonViewModel,
  buildHiddenElementsPopoverViewModel,
  buildHiddenElementsViewModel,
};
