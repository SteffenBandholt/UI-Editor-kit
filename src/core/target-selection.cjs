"use strict";

const DEFAULT_TARGET_ATTRIBUTE_NAME = "data-ui-editor-id";
const SELECTED_TARGET_ATTRIBUTE_NAME = "data-ui-editor-selected";
const HOVERED_TARGET_ATTRIBUTE_NAME = "data-ui-editor-hovered";
const PANEL_COLLAPSED_ATTRIBUTE_NAME = "data-ui-editor-panel-collapsed";
const PANEL_HIDDEN_ATTRIBUTE_NAME = "data-ui-editor-panel-hidden";

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

function restoreHoverMarker(targetElement, previousStyle = null) {
  if (!targetElement?.setAttribute || !targetElement?.style) return;
  targetElement.setAttribute(HOVERED_TARGET_ATTRIBUTE_NAME, "false");
  targetElement.style.outline = previousStyle?.outline || "";
  targetElement.style.boxShadow = previousStyle?.boxShadow || "";
  targetElement.style.position = previousStyle?.position || "";
}

function applyHoverMarker(targetElement) {
  if (!targetElement?.setAttribute || !targetElement?.style) return null;
  const previousStyle = {
    outline: targetElement.style.outline || "",
    boxShadow: targetElement.style.boxShadow || "",
    position: targetElement.style.position || "",
  };
  targetElement.setAttribute(HOVERED_TARGET_ATTRIBUTE_NAME, "true");
  targetElement.style.outline = "1px dashed #0ea5e9";
  targetElement.style.boxShadow = "0 0 0 3px rgb(14 165 233 / 14%)";
  if (!targetElement.style.position) {
    targetElement.style.position = "relative";
  }
  return previousStyle;
}

function cloneSelection(activeScopeId, registryElement, targetElement) {
  return {
    activeScopeId,
    elementId: registryElement?.id || null,
    element: registryElement ? { ...registryElement } : null,
    targetElement: targetElement || null,
  };
}

function getViewportSize(viewport, fallbackElement) {
  const width = Number.isFinite(viewport?.innerWidth)
    ? viewport.innerWidth
    : Number.isFinite(fallbackElement?.clientWidth)
      ? fallbackElement.clientWidth
      : 1024;
  const height = Number.isFinite(viewport?.innerHeight)
    ? viewport.innerHeight
    : Number.isFinite(fallbackElement?.clientHeight)
      ? fallbackElement.clientHeight
      : 768;
  return { width, height };
}

function getPanelSize(panelElement) {
  const rect = typeof panelElement?.getBoundingClientRect === "function" ? panelElement.getBoundingClientRect() : null;
  return {
    width: Number.isFinite(rect?.width) && rect.width > 0
      ? rect.width
      : Number.isFinite(panelElement?.offsetWidth)
        ? panelElement.offsetWidth
        : 280,
    height: Number.isFinite(rect?.height) && rect.height > 0
      ? rect.height
      : Number.isFinite(panelElement?.offsetHeight)
        ? panelElement.offsetHeight
        : 160,
  };
}

function clampPanelPosition(position, panelElement, viewport, fallbackElement, edgeMargin) {
  const viewportSize = getViewportSize(viewport, fallbackElement);
  const panelSize = getPanelSize(panelElement);
  const margin = Number.isFinite(edgeMargin) ? Math.max(0, edgeMargin) : 8;
  const maxX = Math.max(margin, viewportSize.width - panelSize.width - margin);
  const maxY = Math.max(margin, viewportSize.height - panelSize.height - margin);
  return {
    x: Math.min(Math.max(Number(position?.x) || margin, margin), maxX),
    y: Math.min(Math.max(Number(position?.y) || margin, margin), maxY),
  };
}

function setPanelPosition(panelElement, position) {
  if (!panelElement?.style) return;
  panelElement.style.position = "fixed";
  panelElement.style.left = `${Math.round(position.x)}px`;
  panelElement.style.top = `${Math.round(position.y)}px`;
  panelElement.style.right = "auto";
  panelElement.style.bottom = "auto";
  panelElement.style.insetInlineEnd = "auto";
  panelElement.style.insetBlockStart = "auto";
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
  const onHoverChange = typeof normalizedOptions.onHoverChange === "function"
    ? normalizedOptions.onHoverChange
    : null;

  let selectedTargetElement = null;
  let selectedRegistryElement = null;
  let selectedElementId = null;
  let selectedPreviousStyle = null;
  let hoveredTargetElement = null;
  let hoveredRegistryElement = null;
  let hoveredElementId = null;
  let hoveredPreviousStyle = null;
  let installed = false;

  function getSelection() {
    return cloneSelection(activeScopeId, selectedRegistryElement, selectedTargetElement);
  }

  function getHover() {
    return cloneSelection(activeScopeId, hoveredRegistryElement, hoveredTargetElement);
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

  function notifyHoverChange() {
    if (onHoverChange) {
      onHoverChange(getHover());
    }
  }

  function clearHover(optionsForClear = {}) {
    const notify = optionsForClear.notify !== false;
    if (hoveredTargetElement !== selectedTargetElement) {
      restoreHoverMarker(hoveredTargetElement, hoveredPreviousStyle);
    }
    hoveredTargetElement = null;
    hoveredRegistryElement = null;
    hoveredElementId = null;
    hoveredPreviousStyle = null;
    if (notify) {
      notifyHoverChange();
    }
  }

  function setHoverTarget(targetElement, registryElement) {
    if (!targetElement || !registryElement) {
      clearHover();
      return false;
    }

    if (hoveredTargetElement === targetElement && hoveredElementId === registryElement.id) {
      return true;
    }

    clearHover({ notify: false });
    hoveredTargetElement = targetElement;
    hoveredRegistryElement = registryElement;
    hoveredElementId = registryElement.id;
    if (targetElement !== selectedTargetElement) {
      hoveredPreviousStyle = applyHoverMarker(targetElement);
    }
    notifyHoverChange();
    return true;
  }

  function selectResolvedTarget(targetElement, registryElement) {
    if (!targetElement || !registryElement) return false;

    clearHover({ notify: false });
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

  function handlePointerMove(event) {
    const resolvedTarget = resolveRegisteredTargetFromChain(event, registryIndex, targetAttributeName);
    if (!resolvedTarget) {
      clearHover();
      return false;
    }
    return setHoverTarget(resolvedTarget.targetElement, resolvedTarget.registryElement);
  }

  function handlePointerLeave() {
    clearHover();
  }

  function install() {
    if (installed || !root?.addEventListener) return false;
    root.addEventListener("click", handleClick, true);
    root.addEventListener("pointermove", handlePointerMove, true);
    root.addEventListener("pointerleave", handlePointerLeave, true);
    installed = true;
    return true;
  }

  function uninstall() {
    if (!installed || !root?.removeEventListener) return false;
    root.removeEventListener("click", handleClick, true);
    root.removeEventListener("pointermove", handlePointerMove, true);
    root.removeEventListener("pointerleave", handlePointerLeave, true);
    installed = false;
    clearHover({ notify: false });
    clearSelection();
    return true;
  }

  return {
    targetAttributeName,
    activeScopeId,
    install,
    uninstall,
    handleClick,
    handlePointerMove,
    handlePointerLeave,
    clearSelection,
    clearHover,
    getSelection,
    getHover,
    selectTargetElement,
  };
}

function createTargetSelectionPanelController(options = {}) {
  const normalizedOptions = isObject(options) ? options : {};
  const panelElement = normalizedOptions.panelElement || null;
  const headerElement = normalizedOptions.headerElement || panelElement;
  const contentElement = normalizedOptions.contentElement || null;
  const collapseButton = normalizedOptions.collapseButton || null;
  const hideButton = normalizedOptions.hideButton || null;
  const reopenButton = normalizedOptions.reopenButton || null;
  const doc = normalizedOptions.document || panelElement?.ownerDocument || null;
  const viewport = normalizedOptions.window || normalizedOptions.viewport || null;
  const edgeMargin = Number.isFinite(normalizedOptions.edgeMargin) ? normalizedOptions.edgeMargin : 8;

  let installed = false;
  let collapsed = false;
  let hidden = false;
  let dragging = false;
  let dragStart = null;
  let panelStart = null;

  function getFallbackViewportElement() {
    return doc?.documentElement || doc?.body || null;
  }

  function getPanelPosition() {
    const rect = typeof panelElement?.getBoundingClientRect === "function" ? panelElement.getBoundingClientRect() : null;
    return {
      x: Number.isFinite(rect?.left) ? rect.left : Number.parseFloat(panelElement?.style?.left) || edgeMargin,
      y: Number.isFinite(rect?.top) ? rect.top : Number.parseFloat(panelElement?.style?.top) || edgeMargin,
    };
  }

  function applyClampedPosition(position) {
    const clampedPosition = clampPanelPosition(
      position,
      panelElement,
      viewport,
      getFallbackViewportElement(),
      edgeMargin
    );
    setPanelPosition(panelElement, clampedPosition);
    return clampedPosition;
  }

  function clampCurrentPosition() {
    if (!panelElement) return null;
    return applyClampedPosition(getPanelPosition());
  }

  function setCollapsed(nextCollapsed) {
    collapsed = Boolean(nextCollapsed);
    panelElement?.setAttribute?.(PANEL_COLLAPSED_ATTRIBUTE_NAME, collapsed ? "true" : "false");
    if (contentElement?.style) {
      contentElement.style.display = collapsed ? "none" : "";
    }
    return collapsed;
  }

  function toggleCollapsed() {
    return setCollapsed(!collapsed);
  }

  function setHidden(nextHidden) {
    hidden = Boolean(nextHidden);
    panelElement?.setAttribute?.(PANEL_HIDDEN_ATTRIBUTE_NAME, hidden ? "true" : "false");
    if (panelElement?.style) {
      panelElement.style.display = hidden ? "none" : "";
    }
    if (reopenButton?.style) {
      reopenButton.style.display = hidden ? "" : "none";
    }
    return hidden;
  }

  function hide() {
    return setHidden(true);
  }

  function show() {
    return setHidden(false);
  }

  function handleDragStart(event) {
    if (!panelElement) return false;
    dragging = true;
    dragStart = {
      x: Number(event?.clientX) || 0,
      y: Number(event?.clientY) || 0,
    };
    panelStart = getPanelPosition();
    event?.preventDefault?.();
    return true;
  }

  function handleDragMove(event) {
    if (!dragging || !panelStart || !dragStart) return false;
    const nextPosition = {
      x: panelStart.x + ((Number(event?.clientX) || 0) - dragStart.x),
      y: panelStart.y + ((Number(event?.clientY) || 0) - dragStart.y),
    };
    applyClampedPosition(nextPosition);
    event?.preventDefault?.();
    return true;
  }

  function handleDragEnd() {
    if (!dragging) return false;
    dragging = false;
    dragStart = null;
    panelStart = null;
    clampCurrentPosition();
    return true;
  }

  function addListener(target, type, handler) {
    target?.addEventListener?.(type, handler);
  }

  function removeListener(target, type, handler) {
    target?.removeEventListener?.(type, handler);
  }

  function install() {
    if (installed || !panelElement) return false;
    applyClampedPosition(getPanelPosition());
    setCollapsed(collapsed);
    setHidden(hidden);
    addListener(headerElement, "pointerdown", handleDragStart);
    addListener(doc, "pointermove", handleDragMove);
    addListener(doc, "pointerup", handleDragEnd);
    addListener(collapseButton, "click", toggleCollapsed);
    addListener(hideButton, "click", hide);
    addListener(reopenButton, "click", show);
    addListener(viewport, "resize", clampCurrentPosition);
    installed = true;
    return true;
  }

  function uninstall() {
    if (!installed) return false;
    removeListener(headerElement, "pointerdown", handleDragStart);
    removeListener(doc, "pointermove", handleDragMove);
    removeListener(doc, "pointerup", handleDragEnd);
    removeListener(collapseButton, "click", toggleCollapsed);
    removeListener(hideButton, "click", hide);
    removeListener(reopenButton, "click", show);
    removeListener(viewport, "resize", clampCurrentPosition);
    installed = false;
    dragging = false;
    return true;
  }

  return {
    install,
    uninstall,
    clampCurrentPosition,
    getState() {
      return {
        collapsed,
        hidden,
        dragging,
        position: getPanelPosition(),
      };
    },
    hide,
    show,
    setCollapsed,
    setHidden,
    toggleCollapsed,
  };
}

module.exports = {
  DEFAULT_TARGET_ATTRIBUTE_NAME,
  HOVERED_TARGET_ATTRIBUTE_NAME,
  PANEL_COLLAPSED_ATTRIBUTE_NAME,
  PANEL_HIDDEN_ATTRIBUTE_NAME,
  SELECTED_TARGET_ATTRIBUTE_NAME,
  applyHoverMarker,
  applyTargetMarker,
  createTargetSelectionController,
  createTargetSelectionPanelController,
  findClosestTargetElement,
  collectTargetElementChain,
  getTargetElementId,
  normalizeRegistryElements,
  resolveRegisteredTargetFromChain,
  restoreHoverMarker,
  restoreTargetMarker,
};
