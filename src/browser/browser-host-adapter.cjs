"use strict";

const {
  BROWSER_ERROR_CODES,
  ok,
  blocked,
  isValidElementId,
  isElementRef,
} = require("./browser-result.cjs");

const EDITOR_X = "--ui-editor-x";
const EDITOR_Y = "--ui-editor-y";
const EDITOR_WIDTH = "--ui-editor-width";
const EDITOR_HEIGHT = "--ui-editor-height";
const EDITOR_VISIBLE = "--ui-editor-visible";
const TARGET_TRANSFORM = "--ui-editor-target-transform";
const TEXT_OFFSET_X = "--ui-editor-text-offset-x";
const TEXT_OFFSET_Y = "--ui-editor-text-offset-y";
const TEXT_FONT_SIZE = "--ui-editor-text-font-size";
const TEXT_TRANSFORM = "--ui-editor-text-transform";
const EDITOR_FIELDS = [EDITOR_X, EDITOR_Y, EDITOR_WIDTH, EDITOR_HEIGHT, EDITOR_VISIBLE, TARGET_TRANSFORM, TEXT_OFFSET_X, TEXT_OFFSET_Y, TEXT_FONT_SIZE, TEXT_TRANSFORM];
const OUTER_INLINE_FIELDS = ["transform", "width", "height"];
const TEXT_INLINE_FIELDS = ["textIndent", "paddingTop", "fontSize", "transform"];
const NONE_TRANSFORM = "none";

function px(value) {
  return `${Number(value) || 0}px`;
}

function toNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  const match = String(value || "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : undefined;
}

function getStyleValue(style, key) {
  if (!style) throw new Error("style is unavailable");
  if (typeof style.getPropertyValue === "function") return style.getPropertyValue(key);
  return style[key] || "";
}

function setStyleValue(style, key, value) {
  if (!style) throw new Error("style is unavailable");
  if (typeof style.setProperty === "function") style.setProperty(key, String(value));
  else style[key] = String(value);
}

function removeStyleValue(style, key) {
  if (!style) throw new Error("style is unavailable");
  if (typeof style.removeProperty === "function") style.removeProperty(key);
  else delete style[key];
}

function setInlineStyle(style, key, value) {
  if (!style) throw new Error("style is unavailable");
  style[key] = value || "";
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function normalizeTransform(value) {
  const transform = String(value || "").trim();
  return transform && transform.toLowerCase() !== NONE_TRANSFORM ? transform : "";
}

function readProperty(style, key) {
  if (!style) return "";
  const propertyValue = typeof style.getPropertyValue === "function" ? style.getPropertyValue(key) : "";
  return propertyValue || style[key] || "";
}

function createBrowserHostAdapter(options) {
  const cfg = options || {};
  const refs = cfg.elementRefs;
  const registry = cfg.registry;
  const rectReader = cfg.rectReader || ((element) => element.getBoundingClientRect());
  const computedStyleReader = cfg.computedStyleReader || ((element) => (
    cfg.windowAdapter && typeof cfg.windowAdapter.getComputedStyle === "function"
      ? cfg.windowAdapter.getComputedStyle(element)
      : null
  ));
  const originalByElement = new WeakMap();

  function registeredOperations(elementId) {
    if (!registry || typeof registry.getElementById !== "function") return [];
    const definition = registry.getElementById(elementId);
    if (!definition) return [];
    if (definition.operations) return Object.keys(definition.operations).filter((key) => definition.operations[key] === true);
    return Array.isArray(definition.effectiveOps) ? definition.effectiveOps : (definition.allowedOps || []);
  }

  function getRef(elementId) {
    if (!isValidElementId(elementId)) return blocked(BROWSER_ERROR_CODES.INVALID_ELEMENT_ID, "invalid elementId");
    const result = refs && typeof refs.get === "function" ? refs.get(elementId) : null;
    const element = result && result.ok !== false ? (result.value || result) : null;
    if (!isElementRef(element)) return blocked(BROWSER_ERROR_CODES.ELEMENT_REF_MISSING, "elementRef is missing.");
    return ok(element);
  }

  function getTextRef(elementId) {
    let result = null;
    if (cfg.textRefs && typeof cfg.textRefs.get === "function") result = cfg.textRefs.get(elementId);
    else if (typeof cfg.getTextRef === "function") result = cfg.getTextRef(elementId);
    const element = result && result.ok !== false ? (result.value || result) : null;
    return isElementRef(element) ? element : null;
  }

  function readComputed(element) {
    try {
      return ok(computedStyleReader ? computedStyleReader(element) : null);
    } catch (error) {
      return blocked(BROWSER_ERROR_CODES.HOST_READ_FAILED, error.message || "computed style read failed");
    }
  }

  function captureTextState(element, elementId) {
    const textElement = getTextRef(elementId);
    const target = textElement || element;
    const computed = readComputed(target);
    if (!computed.ok) return computed;
    const properties = {};
    TEXT_INLINE_FIELDS.forEach((field) => {
      const inline = readProperty(target.style, field);
      const computedValue = readProperty(computed.value, field);
      properties[field] = {
        inline,
        computed: computedValue,
        effective: inline || computedValue || "",
        ownership: inline ? "inline" : (computedValue ? "computed" : "none"),
      };
    });
    return ok({ hasTextRef: !!textElement, properties });
  }

  function readVisibleState(element, elementId) {
    try {
      const textState = captureTextState(element, elementId);
      if (!textState.ok) return textState;
      return ok({
        elementId,
        inlineStyles: OUTER_INLINE_FIELDS.reduce((acc, field) => { acc[field] = readProperty(element.style, field); return acc; }, {}),
        hidden: !!element.hidden,
        textState: textState.value,
        customProperties: EDITOR_FIELDS.reduce((acc, key) => { acc[key] = getStyleValue(element.style, key) || ""; return acc; }, {}),
      });
    } catch (error) {
      return blocked(BROWSER_ERROR_CODES.HOST_READ_FAILED, error.message || "style read failed");
    }
  }

  function readOriginalState(element, elementId) {
    const snapshot = readVisibleState(element, elementId);
    if (!snapshot.ok) return snapshot;
    const inlineTransform = normalizeTransform(snapshot.value.inlineStyles.transform);
    if (inlineTransform) {
      snapshot.value.transformBase = inlineTransform;
      snapshot.value.transformBaseSource = "inline";
      return snapshot;
    }
    const computed = readComputed(element);
    if (!computed.ok) return computed;
    const computedTransform = normalizeTransform(readProperty(computed.value, "transform"));
    snapshot.value.transformBase = computedTransform;
    snapshot.value.transformBaseSource = computedTransform ? "computed" : "none";
    return snapshot;
  }

  function ensureOriginal(element, elementId) {
    if (originalByElement.has(element)) return ok(originalByElement.get(element));
    const snapshot = readOriginalState(element, elementId);
    if (!snapshot.ok) return snapshot;
    originalByElement.set(element, clone(snapshot.value));
    return snapshot;
  }

  function createHostSnapshot(element, elementId) {
    const visibleState = readVisibleState(element, elementId);
    if (!visibleState.ok) return visibleState;
    const hasOriginal = originalByElement.has(element);
    return ok({
      elementId,
      visibleState: visibleState.value,
      ownership: { hasOriginal, originalSnapshot: hasOriginal ? clone(originalByElement.get(element)) : null },
    });
  }

  function normalizeHostSnapshot(snapshot) {
    if (snapshot && snapshot.visibleState && snapshot.ownership) return snapshot;
    return { elementId: snapshot && snapshot.elementId, visibleState: snapshot || {}, ownership: { hasOriginal: false, originalSnapshot: null } };
  }

  function restoreSnapshot(element, elementId, snapshot) {
    try {
      const inlineStyles = snapshot.inlineStyles || snapshot;
      OUTER_INLINE_FIELDS.forEach((field) => setInlineStyle(element.style, field, inlineStyles[field] || ""));
      element.hidden = !!snapshot.hidden;
      const textElement = getTextRef(elementId);
      const textTarget = textElement || element;
      const properties = snapshot.textState && snapshot.textState.properties;
      if (properties) TEXT_INLINE_FIELDS.forEach((field) => setInlineStyle(textTarget.style, field, properties[field] && properties[field].inline));
      const customProperties = snapshot.customProperties || {};
      EDITOR_FIELDS.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(customProperties, key) && customProperties[key] !== "") setStyleValue(element.style, key, customProperties[key]);
        else removeStyleValue(element.style, key);
      });
      return ok();
    } catch (error) {
      return blocked(BROWSER_ERROR_CODES.HOST_APPLY_FAILED, error.message || "style restore failed");
    }
  }

  function readRect(element) {
    try {
      const rect = rectReader(element);
      const width = toNumber(rect && rect.width);
      const height = toNumber(rect && rect.height);
      if (!Number.isFinite(width) || !Number.isFinite(height) || width < 0 || height < 0) return blocked(BROWSER_ERROR_CODES.CURRENT_VALUE_UNAVAILABLE, "rect width/height unavailable.");
      return ok({ width, height, left: toNumber(rect.left) || 0, top: toNumber(rect.top) || 0 });
    } catch (error) {
      return blocked(BROWSER_ERROR_CODES.HOST_READ_FAILED, error.message || "rect read failed");
    }
  }

  function getCurrentEntry(elementId, element) {
    const rect = readRect(element);
    if (!rect.ok) return rect;
    const computed = readComputed(element);
    if (!computed.ok) return computed;
    try {
      const width = toNumber(getStyleValue(element.style, EDITOR_WIDTH)) ?? toNumber(element.style.width) ?? toNumber(computed.value && computed.value.width) ?? rect.value.width;
      const height = toNumber(getStyleValue(element.style, EDITOR_HEIGHT)) ?? toNumber(element.style.height) ?? toNumber(computed.value && computed.value.height) ?? rect.value.height;
      if (!Number.isFinite(width) || !Number.isFinite(height) || width < 0 || height < 0) return blocked(BROWSER_ERROR_CODES.CURRENT_VALUE_UNAVAILABLE, "current size unavailable.");
      const operations = registeredOperations(elementId);
      if (operations.some((operation) => ["resizeWidth", "resizeHeight", "textMove", "textResize"].includes(operation))) {
        const elementValues = {};
        if (operations.includes("move")) { elementValues.x = toNumber(getStyleValue(element.style, EDITOR_X)) || 0; elementValues.y = toNumber(getStyleValue(element.style, EDITOR_Y)) || 0; }
        if (operations.includes("resizeWidth")) elementValues.width = width;
        if (operations.includes("resizeHeight")) elementValues.height = height;
        if (operations.includes("show") || operations.includes("hide")) elementValues.visible = !(element.hidden === true || getStyleValue(element.style, EDITOR_VISIBLE) === "false");
        const result = { elementId };
        if (Object.keys(elementValues).length > 0) result.element = elementValues;
        if (operations.includes("textMove") || operations.includes("textResize")) {
          const textElement = getTextRef(elementId) || element;
          const textComputed = readComputed(textElement);
          if (!textComputed.ok) return textComputed;
          result.text = {
            offsetX: toNumber(getStyleValue(element.style, TEXT_OFFSET_X)) || 0,
            offsetY: toNumber(getStyleValue(element.style, TEXT_OFFSET_Y)) || 0,
            fontSize: toNumber(getStyleValue(element.style, TEXT_FONT_SIZE)) ?? toNumber(readProperty(textElement.style, "fontSize")) ?? toNumber(readProperty(textComputed.value, "fontSize")) ?? 16,
          };
        }
        return ok(result);
      }
      return ok({ elementId, x: toNumber(getStyleValue(element.style, EDITOR_X)) || 0, y: toNumber(getStyleValue(element.style, EDITOR_Y)) || 0, width, height, visible: !(element.hidden === true || getStyleValue(element.style, EDITOR_VISIBLE) === "false") });
    } catch (error) {
      return blocked(BROWSER_ERROR_CODES.HOST_READ_FAILED, error.message || "style read failed");
    }
  }

  function applyTransform(element, elementId) {
    const original = ensureOriginal(element, elementId);
    if (!original.ok) return original;
    const targetTransform = normalizeTransform(original.value.transformBase || original.value.inlineStyles.transform);
    try {
      if (targetTransform) {
        setStyleValue(element.style, TARGET_TRANSFORM, targetTransform);
        element.style.transform = `var(${TARGET_TRANSFORM}) translate(var(${EDITOR_X}, 0px), var(${EDITOR_Y}, 0px))`;
      } else {
        removeStyleValue(element.style, TARGET_TRANSFORM);
        element.style.transform = `translate(var(${EDITOR_X}, 0px), var(${EDITOR_Y}, 0px))`;
      }
      return ok();
    } catch (error) {
      return blocked(BROWSER_ERROR_CODES.HOST_APPLY_FAILED, error.message || "transform apply failed");
    }
  }

  function applyTextEntry(element, elementId, textValues, original) {
    if (!textValues || Object.keys(textValues).length === 0) return ok();
    const textElement = getTextRef(elementId);
    if (Object.prototype.hasOwnProperty.call(textValues, "offsetY") && !textElement) {
      return blocked(BROWSER_ERROR_CODES.TEXT_OFFSET_Y_UNSUPPORTED, "text offsetY requires an explicit text ref.");
    }
    const target = textElement || element;
    const properties = original.value.textState.properties;
    try {
      if (Object.prototype.hasOwnProperty.call(textValues, "offsetX")) {
        const base = toNumber(properties.textIndent.effective) || 0;
        setStyleValue(element.style, TEXT_OFFSET_X, px(textValues.offsetX));
        target.style.textIndent = px(base + textValues.offsetX);
      }
      if (Object.prototype.hasOwnProperty.call(textValues, "offsetY")) {
        const baseTransform = normalizeTransform(properties.transform.effective);
        const editorTransform = `translateY(${px(textValues.offsetY)})`;
        setStyleValue(element.style, TEXT_OFFSET_Y, px(textValues.offsetY));
        setStyleValue(element.style, TEXT_TRANSFORM, editorTransform);
        target.style.transform = baseTransform ? `${baseTransform} ${editorTransform}` : editorTransform;
      }
      if (Object.prototype.hasOwnProperty.call(textValues, "fontSize")) {
        setStyleValue(element.style, TEXT_FONT_SIZE, px(textValues.fontSize));
        target.style.fontSize = px(textValues.fontSize);
      }
      return ok();
    } catch (error) {
      return blocked(BROWSER_ERROR_CODES.HOST_APPLY_FAILED, error.message || "text layout apply failed");
    }
  }

  return {
    validateElementRef(elementId) { return getRef(elementId); },
    captureElementLayoutState(elementId) {
      const ref = getRef(elementId);
      return ref.ok ? createHostSnapshot(ref.value, elementId) : ref;
    },
    applyLayoutEntry(elementId, entry) {
      const ref = getRef(elementId);
      if (!ref.ok) return ref;
      const element = ref.value;
      const textValues = entry.text || {};
      if (Object.prototype.hasOwnProperty.call(textValues, "offsetY") && !getTextRef(elementId)) return blocked(BROWSER_ERROR_CODES.TEXT_OFFSET_Y_UNSUPPORTED, "text offsetY requires an explicit text ref.");
      const original = ensureOriginal(element, elementId);
      if (!original.ok) return original;
      try {
        const elementValues = entry.element || entry;
        if (Object.prototype.hasOwnProperty.call(elementValues, "x")) setStyleValue(element.style, EDITOR_X, px(elementValues.x));
        if (Object.prototype.hasOwnProperty.call(elementValues, "y")) setStyleValue(element.style, EDITOR_Y, px(elementValues.y));
        if (Object.prototype.hasOwnProperty.call(elementValues, "x") || Object.prototype.hasOwnProperty.call(elementValues, "y")) {
          const transformed = applyTransform(element, elementId);
          if (!transformed.ok) return transformed;
        }
        if (Object.prototype.hasOwnProperty.call(elementValues, "width")) { setStyleValue(element.style, EDITOR_WIDTH, px(elementValues.width)); element.style.width = px(elementValues.width); }
        if (Object.prototype.hasOwnProperty.call(elementValues, "height")) { setStyleValue(element.style, EDITOR_HEIGHT, px(elementValues.height)); element.style.height = px(elementValues.height); }
        if (Object.prototype.hasOwnProperty.call(elementValues, "visible")) { setStyleValue(element.style, EDITOR_VISIBLE, elementValues.visible ? "true" : "false"); element.hidden = elementValues.visible === false; }
        const textApplied = applyTextEntry(element, elementId, textValues, original);
        return textApplied.ok ? ok() : textApplied;
      } catch (error) {
        return blocked(BROWSER_ERROR_CODES.HOST_APPLY_FAILED, error.message || "layout apply failed");
      }
    },
    clearElementLayout(elementId) {
      const ref = getRef(elementId);
      if (!ref.ok) return ref;
      const original = originalByElement.get(ref.value);
      if (!original) return ok();
      const restored = restoreSnapshot(ref.value, elementId, original);
      if (restored.ok) originalByElement.delete(ref.value);
      return restored;
    },
    restoreElementLayoutState(elementId, snapshot) {
      const ref = getRef(elementId);
      if (!ref.ok) return ref;
      const hostSnapshot = normalizeHostSnapshot(snapshot || {});
      const restored = restoreSnapshot(ref.value, elementId, hostSnapshot.visibleState || {});
      if (!restored.ok) return restored;
      if (hostSnapshot.ownership && hostSnapshot.ownership.hasOriginal) originalByElement.set(ref.value, clone(hostSnapshot.ownership.originalSnapshot));
      else originalByElement.delete(ref.value);
      return ok();
    },
    getCurrentLayoutEntry(elementId) {
      const ref = getRef(elementId);
      return ref.ok ? getCurrentEntry(elementId, ref.value) : ref;
    },
    reapplyLayoutEntries(entries) {
      for (const entry of entries || []) {
        const applied = this.applyLayoutEntry(entry.elementId, entry);
        if (!applied.ok) return applied;
      }
      return ok();
    },
  };
}

module.exports = { createBrowserHostAdapter };
