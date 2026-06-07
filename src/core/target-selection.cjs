"use strict";

const DEFAULT_TARGET_ATTRIBUTE_NAME = "data-ui-editor-id";
const SELECTED_TARGET_ATTRIBUTE_NAME = "data-ui-editor-selected";

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeAttributeName(value) {
  const attributeName = typeof value === "string" && value.trim() !== "" ? value.trim() : DEFAULT_TARGET_ATTRIBUTE_NAME;
  if (!/^[A-Za-z_][A-Za-z0-9_.:-]*$/u.test(attributeName)) {
    throw new TypeError("targetAttributeName muss ein gueltiger Attributname sein.");
  }
  return attributeName;
}

function normalizeElementId(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function normalizeRegistryElement(element) {
  if (!isObject(element)) return null;
  const id = normalizeElementId(element.id);
  if (!id) return null;
  return {
    id,
    name: typeof element.name === "string" ? element.name : "",
    label: typeof element.label === "string" ? element.label : "",
    type: typeof element.type === "string" ? element.type : "",
    role: typeof element.role === "string" ? element.role : "",
    parentId: element.parentId == null ? null : String(element.parentId),
  };
}

function normalizeRegistryElements(registry) {
  const elements = Array.isArray(registry)
    ? registry
    : Array.isArray(registry?.elements)
      ? registry.elements
      : [];
  return elements.map(normalizeRegistryElement).filter(Boolean);
}

function createRegistryIndex(elements) {
  const index = new Map();
  for (const element of elements) {
    if (!index.has(element.id)) index.set(element.id, element);
  }
  return index;
}

function resolveRegistry({ activeScopeId = null, registry = null, registryResolver = null } = {}) {
  if (typeof registryResolver === "function") {
    return registryResolver(activeScopeId);
  }
  return registry;
}

function getEventTarget(event) {
  return event?.target && typeof event.target === "object" ? event.target : null;
}

function findClosestTargetElement(event, targetAttributeName = DEFAULT_TARGET_ATTRIBUTE_NAME) {
  const target = getEventTarget(event);
  if (!target || typeof target.closest !== "function") return null;
  return target.closest(`[${normalizeAttributeName(targetAttributeName)}]`);
}

function getTargetElementId(targetElement, targetAttributeName = DEFAULT_TARGET_ATTRIBUTE_NAME) {
  if (!targetElement || typeof targetElement.getAttribute !== "function") return null;
  return normalizeElementId(targetElement.getAttribute(normalizeAttributeName(targetAttributeName)));
}

function restoreTargetMarker(targetElement, previousStyle = null) {
  if (!targetElement?.setAttribute || !targetElement?.style) return;
  targetElement.setAttribute(SELECTED_TARGET_ATTRIBUTE_NAME, "false");
  targetElement.style.outline = previousStyle?.outline || "";
  targetElement.style.boxShadow = previousStyle?.boxShadow || "";
}

function applyTargetMarker(targetElement) {
  if (!targetElement?.setAttribute || !targetElement?.style) return null;
  const previousStyle = {
    outline: targetElement.style.outline || "",
    boxShadow: targetElement.style.boxShadow || "",
  };
  targetElement.setAttribute(SELECTED_TARGET_ATTRIBUTE_NAME, "true");
  targetElement.style.outline = "2px solid #2563eb";
  targetElement.style.boxShadow = "0 0 0 4px rgb(37 99 235 / 18%)";
  return previousStyle;
}

function createTargetSelectionController(options = {}) {
  const normalizedOptions = isObject(options) ? options : {};
  const targetAttributeName = normalizeAttributeName(normalizedOptions.targetAttributeName);
  const doc = normalizedOptions.document || null;
  const root = normalizedOptions.root || doc || null;
  const activeScopeId = normalizeElementId(normalizedOptions.activeScopeId);
  const registry = resolveRegistry({
    activeScopeId,
    registry: normalizedOptions.registry,
    registryResolver: normalizedOptions.registryResolver,
  });
  const registryIndex = createRegistryIndex(normalizeRegistryElements(registry));
  const uiState = normalizedOptions.uiState && typeof normalizedOptions.uiState === "object"
    ? normalizedOptions.uiState
    : null;
  const onSelectionChange = typeof normalizedOptions.onSelectionChange === "function"
    ? normalizedOptions.onSelectionChange
    : null;

  let selectedTargetElement = null;
  let selectedRegistryElement = null;
  let selectedPreviousStyle = null;
  let installed = false;

  function getSelection() {
    return {
      activeScopeId,
      elementId: selectedRegistryElement?.id || null,
      element: selectedRegistryElement ? { ...selectedRegistryElement } : null,
      targetElement: selectedTargetElement,
    };
  }

  function notifySelectionChange() {
    if (typeof uiState?.selectElement === "function") {
      uiState.selectElement(selectedRegistryElement?.id || null);
    }
    if (onSelectionChange) {
      onSelectionChange(getSelection());
    }
  }

  function clearSelection() {
    restoreTargetMarker(selectedTargetElement, selectedPreviousStyle);
    selectedTargetElement = null;
    selectedRegistryElement = null;
    selectedPreviousStyle = null;
    if (typeof uiState?.clearSelection === "function") {
      uiState.clearSelection();
    }
  }

  function selectTargetElement(targetElement) {
    const elementId = getTargetElementId(targetElement, targetAttributeName);
    const registryElement = elementId ? registryIndex.get(elementId) : null;
    if (!targetElement || !registryElement) return false;

    clearSelection();
    selectedTargetElement = targetElement;
    selectedRegistryElement = registryElement;
    selectedPreviousStyle = applyTargetMarker(targetElement);
    notifySelectionChange();
    return true;
  }

  function handleClick(event) {
    const targetElement = findClosestTargetElement(event, targetAttributeName);
    if (!targetElement) return false;
    const selected = selectTargetElement(targetElement);
    if (selected) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
    }
    return selected;
  }

  function install() {
    if (installed || !root?.addEventListener) return false;
    root.addEventListener("click", handleClick, true);
    installed = true;
    return true;
  }

  function uninstall() {
    if (!installed || !root?.removeEventListener) return false;
    root.removeEventListener("click", handleClick, true);
    installed = false;
    clearSelection();
    return true;
  }

  return {
    targetAttributeName,
    activeScopeId,
    install,
    uninstall,
    handleClick,
    clearSelection,
    getSelection,
    selectTargetElement,
  };
}

module.exports = {
  DEFAULT_TARGET_ATTRIBUTE_NAME,
  SELECTED_TARGET_ATTRIBUTE_NAME,
  applyTargetMarker,
  createTargetSelectionController,
  findClosestTargetElement,
  getTargetElementId,
  normalizeRegistryElements,
  restoreTargetMarker,
};
