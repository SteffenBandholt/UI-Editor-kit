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

function collectTargetElementChain(event, targetAttributeName = DEFAULT_TARGET_ATTRIBUTE_NAME) {
  const attributeName = normalizeAttributeName(targetAttributeName);
  const chain = [];
  let current = getEventTarget(event);

  while (current && typeof current === "object") {
    if (typeof current.getAttribute === "function") {
      const elementId = normalizeElementId(current.getAttribute(attributeName));
      if (elementId) {
        chain.push({ element: current, elementId });
      }
    }
    current = current.parentElement || null;
  }

  return chain;
}

function resolveRegisteredTargetFromChain(event, registryIndex, targetAttributeName = DEFAULT_TARGET_ATTRIBUTE_NAME) {
  const chain = collectTargetElementChain(event, targetAttributeName)
    .filter((entry) => registryIndex.has(entry.elementId));
  if (chain.length === 0) return null;

  const wantsParent = Boolean(event?.shiftKey || event?.altKey);
  const selectedEntry = wantsParent && chain.length > 1 ? chain[1] : chain[0];
  return {
    targetElement: selectedEntry.element,
    registryElement: registryIndex.get(selectedEntry.elementId),
  };
}

function isEditableEventTarget(event) {
  const target = getEventTarget(event);
  if (!target) return false;
  const tagName = typeof target.tagName === "string" ? target.tagName.toLowerCase() : "";
  if (tagName === "input" || tagName === "textarea" || tagName === "select") return true;
  if (typeof target.getAttribute === "function" && target.getAttribute("contenteditable") === "true") return true;
  return false;
}

function restoreTargetMarker(targetElement, previousStyle = null) {
  if (!targetElement?.setAttribute || !targetElement?.style) return;
  targetElement.setAttribute(SELECTED_TARGET_ATTRIBUTE_NAME, "false");
  targetElement.style.outline = previousStyle?.outline || "";
  targetElement.style.boxShadow = previousStyle?.boxShadow || "";
  targetElement.style.position = previousStyle?.position || "";
}

function applyTargetMarker(targetElement) {
  if (!targetElement?.setAttribute || !targetElement?.style) return null;
  const previousStyle = {
    outline: targetElement.style.outline || "",
    boxShadow: targetElement.style.boxShadow || "",
    position: targetElement.style.position || "",
  };
  targetElement.setAttribute(SELECTED_TARGET_ATTRIBUTE_NAME, "true");
  targetElement.style.outline = "2px solid #2563eb";
  targetElement.style.boxShadow = "0 0 0 4px rgb(37 99 235 / 18%)";
  if (!targetElement.style.position) {
    targetElement.style.position = "relative";
  }
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
  let selectedElementId = null;
  let selectedPreviousStyle = null;
  let installed = false;

  function getSelection() {
    return {
      activeScopeId,
      elementId: selectedElementId,
      element: selectedRegistryElement ? { ...selectedRegistryElement } : null,
      targetElement: selectedTargetElement,
    };
  }

  function notifySelectionChange() {
    if (typeof uiState?.selectElement === "function") {
      uiState.selectElement(selectedElementId);
    }
    if (onSelectionChange) {
      onSelectionChange(getSelection());
    }
  }

  function clearSelection() {
    restoreTargetMarker(selectedTargetElement, selectedPreviousStyle);
    selectedTargetElement = null;
    selectedRegistryElement = null;
    selectedElementId = null;
    selectedPreviousStyle = null;
    if (typeof uiState?.clearSelection === "function") {
      uiState.clearSelection();
    }
  }

  function selectResolvedTarget(targetElement, registryElement) {
    if (!targetElement || !registryElement) return false;

    clearSelection();
    selectedTargetElement = targetElement;
    selectedRegistryElement = registryElement;
    selectedElementId = registryElement.id;
    selectedPreviousStyle = applyTargetMarker(targetElement);
    notifySelectionChange();
    return true;
  }

  function selectTargetElement(targetElement) {
    const elementId = getTargetElementId(targetElement, targetAttributeName);
    const registryElement = elementId ? registryIndex.get(elementId) : null;
    return selectResolvedTarget(targetElement, registryElement);
  }

  function handleClick(event) {
    const resolvedTarget = resolveRegisteredTargetFromChain(event, registryIndex, targetAttributeName);
    if (!resolvedTarget) return false;
    const selected = selectResolvedTarget(resolvedTarget.targetElement, resolvedTarget.registryElement);
    if (selected) {
      if (!isEditableEventTarget(event)) {
        event?.preventDefault?.();
      }
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
  collectTargetElementChain,
  getTargetElementId,
  normalizeRegistryElements,
  resolveRegisteredTargetFromChain,
  restoreTargetMarker,
};
