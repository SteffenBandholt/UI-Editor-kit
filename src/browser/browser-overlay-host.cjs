"use strict";

const { BROWSER_ERROR_CODES, ok, blocked, isElementRef } = require("./browser-result.cjs");

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function createBrowserOverlayHost(options) {
  const cfg = options || {};
  const mount = cfg.overlayMountTarget;
  const clock = cfg.clock || (() => Date.now());
  const rectReader = cfg.rectReader || ((element) => element.getBoundingClientRect());
  const windowAdapter = cfg.windowAdapter;
  const documentAdapter = cfg.documentAdapter || (mount && mount.ownerDocument);
  const theme = { color: "#f59e0b", width: "2px", zIndex: "2147483647", ...(cfg.theme || {}) };

  let overlayElement = null;
  let currentRef = null;
  let state = { visible: false, elementId: null, rect: null, lastUpdatedAt: null };
  const listeners = [];

  function createOverlayElement() {
    if (overlayElement) return overlayElement;
    if (!mount || typeof mount.appendChild !== "function") return null;
    overlayElement = documentAdapter && typeof documentAdapter.createElement === "function"
      ? documentAdapter.createElement("div")
      : { style: {}, remove() {} };
    overlayElement.className = "ui-editor-browser-overlay";
    Object.assign(overlayElement.style, {
      position: "absolute",
      pointerEvents: "none",
      boxSizing: "border-box",
      border: `${theme.width} solid ${theme.color}`,
      zIndex: String(theme.zIndex),
      display: "none",
    });
    mount.appendChild(overlayElement);
    return overlayElement;
  }

  function measure(elementRef) {
    try {
      const elementRect = rectReader(elementRef);
      const mountRect = mount && typeof mount.getBoundingClientRect === "function"
        ? mount.getBoundingClientRect()
        : { left: 0, top: 0 };
      const width = elementRect && elementRect.width;
      const height = elementRect && elementRect.height;
      if (!finiteNumber(width) || !finiteNumber(height) || width < 0 || height < 0) return null;
      return {
        left: (elementRect.left || 0) - (mountRect.left || 0) + (mount.scrollLeft || 0),
        top: (elementRect.top || 0) - (mountRect.top || 0) + (mount.scrollTop || 0),
        width,
        height,
      };
    } catch (_error) {
      return null;
    }
  }

  function applyRect(rect) {
    const node = createOverlayElement();
    if (!node) return blocked(BROWSER_ERROR_CODES.OVERLAY_MOUNT_MISSING, "overlay mount target is missing.");
    Object.assign(node.style, {
      display: "block",
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
    return ok();
  }

  function hide() {
    if (overlayElement) overlayElement.style.display = "none";
    state = { visible: false, elementId: null, rect: null, lastUpdatedAt: clock() };
    currentRef = null;
    return ok(state);
  }

  function update() {
    if (!state.visible || !currentRef) return ok(state);
    const rect = measure(currentRef);
    if (!rect) {
      hide();
      return blocked(BROWSER_ERROR_CODES.OVERLAY_MEASURE_FAILED, "overlay measure failed.");
    }
    const applied = applyRect(rect);
    if (!applied.ok) return applied;
    state = { visible: true, elementId: state.elementId, rect, lastUpdatedAt: clock() };
    return ok(state);
  }

  if (windowAdapter && typeof windowAdapter.addEventListener === "function") {
    ["resize", "scroll"].forEach((type) => {
      const listener = () => update();
      try {
        windowAdapter.addEventListener(type, listener);
        listeners.push([type, listener]);
      } catch (_error) {}
    });
  }

  return {
    show(elementId, elementRef) {
      if (!mount) return blocked(BROWSER_ERROR_CODES.OVERLAY_MOUNT_MISSING, "overlay mount target is missing.");
      if (!isElementRef(elementRef)) {
        hide();
        return blocked(BROWSER_ERROR_CODES.INVALID_ELEMENT_REF, "invalid elementRef");
      }
      currentRef = elementRef;
      state = { visible: true, elementId, rect: null, lastUpdatedAt: null };
      return update();
    },
    update,
    hide,
    getState() {
      return JSON.parse(JSON.stringify(state));
    },
    destroy() {
      listeners.splice(0).forEach(([type, listener]) => {
        try {
          if (windowAdapter && typeof windowAdapter.removeEventListener === "function") {
            windowAdapter.removeEventListener(type, listener);
          }
        } catch (_error) {}
      });
      if (overlayElement && typeof overlayElement.remove === "function") overlayElement.remove();
      overlayElement = null;
      currentRef = null;
      state = { visible: false, elementId: null, rect: null, lastUpdatedAt: clock() };
    },
  };
}

module.exports = { createBrowserOverlayHost };
