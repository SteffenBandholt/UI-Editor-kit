#!/usr/bin/env node

/*
 * UI-Editor-Kit Layoutdaten-Extractor (K1.4)
 *
 * Liest fachneutral data-ui-* Metadaten aus einer vorhandenen DOM-/Mock-Struktur
 * und erzeugt daraus ein Layoutdaten-Objekt gemaess docs/LAYOUTDATEN_MODELL.md.
 * Keine Speicherung, keine DOM-Aenderung, keine Fachlogik.
 */

const { validateLayoutData } = require("./layout-data-validator.cjs");

function parseBooleanLike(value) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "true") {
      return true;
    }
    if (v === "false") {
      return false;
    }
  }
  return undefined;
}

function toFiniteNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) {
      return n;
    }
  }
  return undefined;
}

function readAttr(element, name) {
  if (!element) {
    return undefined;
  }

  if (typeof element.getAttribute === "function") {
    const value = element.getAttribute(name);
    return value === null ? undefined : value;
  }

  if (isPlainObject(element.attributes) && Object.prototype.hasOwnProperty.call(element.attributes, name)) {
    return element.attributes[name];
  }

  return undefined;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function collectElements(rootElement, selector) {
  if (!rootElement) {
    return [];
  }

  if (typeof rootElement.querySelectorAll === "function") {
    return Array.from(rootElement.querySelectorAll(selector));
  }

  // Fallback fuer einfache Mock-Baumstrukturen in Node-Tests.
  const out = [];
  const stack = [rootElement];

  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) {
      continue;
    }

    const id = readAttr(node, "data-ui-inspector-id");
    if (typeof id === "string" && id !== "") {
      out.push(node);
    }

    const children = Array.isArray(node.children) ? node.children : [];
    for (let i = children.length - 1; i >= 0; i -= 1) {
      stack.push(children[i]);
    }
  }

  return out;
}

function buildItemFromElement(element, index) {
  const item = {};

  const visibleRaw = readAttr(element, "data-ui-editor-editable");
  const visible = parseBooleanLike(visibleRaw);
  if (visible !== undefined) {
    item.visible = visible;
  }

  // K1.4: Da noch keine Layout-Anwendung vorhanden ist, werden neutrale Defaults gesetzt.
  item.x = 0;
  item.y = 0;
  item.width = 0;
  item.height = 0;
  item.order = index + 1;

  const opsRaw = readAttr(element, "data-ui-editor-ops");
  if (typeof opsRaw === "string" && opsRaw.trim() !== "") {
    item.layoutHint = opsRaw
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
      .join(",");
  }

  // Optional vorhandene numerische Metadaten koennen genutzt werden, ohne Pflicht zu werden.
  const x = toFiniteNumber(readAttr(element, "data-ui-layout-x"));
  const y = toFiniteNumber(readAttr(element, "data-ui-layout-y"));
  const width = toFiniteNumber(readAttr(element, "data-ui-layout-width"));
  const height = toFiniteNumber(readAttr(element, "data-ui-layout-height"));
  const order = toFiniteNumber(readAttr(element, "data-ui-layout-order"));

  if (x !== undefined) item.x = x;
  if (y !== undefined) item.y = y;
  if (width !== undefined) item.width = width;
  if (height !== undefined) item.height = height;
  if (order !== undefined) item.order = order;

  return item;
}

function extractLayoutDataFromDom(rootElement, options) {
  const opts = options || {};
  const scope = typeof opts.scope === "string" ? opts.scope : "app-or-screen-scope";
  const selector = "[data-ui-inspector-id]";

  const elements = collectElements(rootElement, selector);
  const items = {};

  elements.forEach((element, index) => {
    const idRaw = readAttr(element, "data-ui-inspector-id");
    const id = typeof idRaw === "string" ? idRaw.trim() : "";
    if (!id) {
      return;
    }
    items[id] = buildItemFromElement(element, index);
  });

  return {
    version: 1,
    scope,
    items,
  };
}

function extractAndValidateLayoutData(rootElement, options) {
  const layoutData = extractLayoutDataFromDom(rootElement, options);
  const validation = validateLayoutData(layoutData, options && options.validationOptions);
  return {
    layoutData,
    validation,
  };
}

module.exports = {
  extractLayoutDataFromDom,
  extractAndValidateLayoutData,
};
