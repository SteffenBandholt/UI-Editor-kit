"use strict";

const DEFAULTS = Object.freeze({ zIndex: 2147483000, borderWidth: 2, borderRadius: 4, showLabel: true, autoUpdate: true });

function defaultLabel(prefix, target) {
  const label = target && target.label ? target.label : "Element";
  const id = target && target.elementId ? target.elementId : "";
  return prefix ? `${prefix}: ${label} · ${id}` : `${label} · ${id}`;
}

function createSelectionOverlayBase(defaultOptions = {}) {
  const options = Object.assign({}, DEFAULTS, defaultOptions);
  let doc = null;
  let frame = null;
  let labelNode = null;
  let currentRef = null;
  let currentTarget = null;
  const viewportListeners = [];

  function ensure(documentRef) {
    if (frame) return;
    doc = documentRef || (currentRef && currentRef.ownerDocument);
    if (!doc || !doc.createElement || !doc.body || !doc.body.appendChild) throw new Error("SelectionOverlay benoetigt ein Document mit body.");
    frame = doc.createElement("div");
    frame.setAttribute("data-selection-overlay", options.role || "selection");
    Object.assign(frame.style, {
      position: "fixed", pointerEvents: "none", boxSizing: "border-box", zIndex: String(options.zIndex),
      borderStyle: "solid", borderColor: options.borderColor, backgroundColor: options.backgroundColor,
      borderWidth: `${options.borderWidth}px`, borderRadius: `${options.borderRadius}px`, display: "none"
    });
    labelNode = doc.createElement("div");
    Object.assign(labelNode.style, { position: "absolute", left: "0", top: "-1.6em", font: "12px sans-serif", color: options.borderColor, background: "rgba(255,255,255,0.92)", padding: "1px 4px", borderRadius: "3px" });
    frame.appendChild(labelNode);
    doc.body.appendChild(frame);
  }

  function addViewportListener(target, type, listener, capture) {
    if (!target || typeof target.addEventListener !== "function") return;
    target.addEventListener(type, listener, capture);
    viewportListeners.push([target, type, listener, capture]);
  }

  function removeViewportListeners() {
    while (viewportListeners.length) {
      const [target, type, listener, capture] = viewportListeners.pop();
      if (target && typeof target.removeEventListener === "function") target.removeEventListener(type, listener, capture);
    }
  }

  function handleViewportChange() {
    try {
      update();
    } catch (_error) {
      clear();
    }
  }

  function ensureViewportListeners() {
    if (options.autoUpdate === false || viewportListeners.length > 0 || !doc) return;
    addViewportListener(doc, "scroll", handleViewportChange, true);
    const win = options.window || doc.defaultView;
    addViewportListener(win, "resize", handleViewportChange, false);
  }

  function update() {
    if (!frame || !currentRef) return;
    const rect = currentRef.getBoundingClientRect();
    frame.style.left = `${rect.left}px`;
    frame.style.top = `${rect.top}px`;
    frame.style.width = `${rect.width}px`;
    frame.style.height = `${rect.height}px`;
    frame.style.display = "block";
  }

  function show({ ref, target, document: documentRef, window: windowRef } = {}) {
    if (!ref || typeof ref.getBoundingClientRect !== "function") throw new Error("SelectionOverlay benoetigt eine gueltige Element-Referenz.");
    currentRef = ref;
    currentTarget = target || null;
    if (windowRef && options.window !== windowRef) options.window = windowRef;
    ensure(documentRef || ref.ownerDocument);
    if (labelNode) {
      const text = typeof options.labelFormatter === "function" ? options.labelFormatter(currentTarget) : defaultLabel(options.labelPrefix, currentTarget);
      labelNode.textContent = text;
      labelNode.style.display = options.showLabel === false ? "none" : "block";
    }
    ensureViewportListeners();
    update();
  }

  function clear() {
    currentRef = null; currentTarget = null;
    removeViewportListeners();
    if (frame) frame.style.display = "none";
  }

  function destroy() {
    clear();
    if (frame && frame.parentNode && frame.parentNode.removeChild) frame.parentNode.removeChild(frame);
    frame = null; labelNode = null; doc = null;
  }

  return { show, update, clear, destroy, isVisible: () => Boolean(frame && frame.style.display !== "none"), getElement: () => frame, getTarget: () => currentTarget };
}

module.exports = { createSelectionOverlayBase };
