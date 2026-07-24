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
const EDITOR_TEXT_OFFSET_X = "--ui-editor-text-offset-x";
const EDITOR_TEXT_OFFSET_Y = "--ui-editor-text-offset-y";
const EDITOR_TEXT_FONT_SIZE = "--ui-editor-text-font-size";
const EDITOR_TEXT_TRANSFORM = "--ui-editor-text-transform";
const TARGET_TRANSFORM = "--ui-editor-target-transform";
const EDITOR_FIELDS = [EDITOR_X, EDITOR_Y, EDITOR_WIDTH, EDITOR_HEIGHT, EDITOR_VISIBLE, TARGET_TRANSFORM, EDITOR_TEXT_OFFSET_X, EDITOR_TEXT_OFFSET_Y, EDITOR_TEXT_FONT_SIZE, EDITOR_TEXT_TRANSFORM];
const EMPTY_TRANSFORM = "";

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

function createBrowserHostAdapter(options) {
  const cfg = options || {};
  const refs = cfg.elementRefs;
  const rectReader = cfg.rectReader || ((element) => element.getBoundingClientRect());
  const computedStyleReader = cfg.computedStyleReader || ((element) => (
    cfg.windowAdapter && typeof cfg.windowAdapter.getComputedStyle === "function"
      ? cfg.windowAdapter.getComputedStyle(element)
      : null
  ));
  const originalByElement = new WeakMap();
  const textRefs = cfg.textRefs || null;

  function getRef(elementId) {
    if (!isValidElementId(elementId)) return blocked(BROWSER_ERROR_CODES.INVALID_ELEMENT_ID, "invalid elementId");
    const result = refs && typeof refs.get === "function" ? refs.get(elementId) : null;
    const element = result && result.ok !== false ? (result.value || result) : null;
    if (!isElementRef(element)) return blocked(BROWSER_ERROR_CODES.ELEMENT_REF_MISSING, "elementRef is missing.");
    return ok(element);
  }

  function getTextRef(elementId) {
    if (textRefs && typeof textRefs.get === "function") {
      const result = textRefs.get(elementId);
      const element = result && result.ok !== false ? (result.value || result) : null;
      return isElementRef(element) ? element : null;
    }
    if (typeof cfg.getTextRef === "function") {
      const result = cfg.getTextRef(elementId);
      const element = result && result.ok !== false ? (result.value || result) : null;
      return isElementRef(element) ? element : null;
    }
    return null;
  }

  function readTextState(element, elementId) {
    const textElement = getTextRef(elementId);
    const target = textElement || element;
    const computed = computedStyleReader ? computedStyleReader(target) : null;
    return {
      hasTextRef: !!textElement,
      inlineTextIndent: target.style.textIndent || "",
      computedTextIndent: computed ? (getStyleValue(computed, "textIndent") || computed.textIndent || "") : "",
      inlinePaddingTop: target.style.paddingTop || "",
      computedPaddingTop: computed ? (getStyleValue(computed, "paddingTop") || computed.paddingTop || "") : "",
      inlineFontSize: target.style.fontSize || "",
      computedFontSize: computed ? (getStyleValue(computed, "fontSize") || computed.fontSize || "") : "",
      inlineTransform: target.style.transform || "",
    };
  }

  function readVisibleState(element, elementId) {
    try {
      return ok({
        elementId,
        transform: element.style.transform || "",
        width: element.style.width || "",
        height: element.style.height || "",
        hidden: !!element.hidden,
        textState: readTextState(element, elementId),
        customProperties: EDITOR_FIELDS.reduce((acc, key) => {
          acc[key] = getStyleValue(element.style, key) || "";
          return acc;
        }, {}),
      });
    } catch (error) {
      return blocked(BROWSER_ERROR_CODES.HOST_READ_FAILED, error.message || "style read failed");
    }
  }

  function createHostSnapshot(element, elementId) {
    const visibleState = readVisibleState(element, elementId);
    if (!visibleState.ok) return visibleState;
    const hasOriginal = originalByElement.has(element);
    return ok({
      elementId,
      visibleState: visibleState.value,
      ownership: {
        hasOriginal,
        originalSnapshot: hasOriginal ? clone(originalByElement.get(element)) : null,
      },
    });
  }

  function normalizeHostSnapshot(snapshot) {
    if (snapshot && snapshot.visibleState && snapshot.ownership) return snapshot;
    return {
      elementId: snapshot && snapshot.elementId,
      visibleState: snapshot || {},
      ownership: { hasOriginal: false, originalSnapshot: null },
    };
  }

  function ensureOriginal(element, elementId) {
    if (originalByElement.has(element)) return ok(originalByElement.get(element));
    const snapshot = readVisibleState(element, elementId);
    if (!snapshot.ok) return snapshot;
    originalByElement.set(element, clone(snapshot.value));
    return snapshot;
  }

  function restoreTextSnapshot(element, elementId, snapshot) {
    const textState = snapshot.textState || {};
    const textElement = getTextRef(elementId);
    const target = textElement || element;
    setInlineStyle(target.style, "textIndent", textState.inlineTextIndent || "");
    setInlineStyle(target.style, "fontSize", textState.inlineFontSize || "");
    setInlineStyle(target.style, "transform", textState.inlineTransform || "");
    if (textElement) setInlineStyle(target.style, "paddingTop", textState.inlinePaddingTop || "");
  }

  function restoreSnapshot(element, elementId, snapshot) {
    try {
      setInlineStyle(element.style, "transform", snapshot.transform || "");
      setInlineStyle(element.style, "width", snapshot.width || "");
      setInlineStyle(element.style, "height", snapshot.height || "");
      element.hidden = !!snapshot.hidden;
      restoreTextSnapshot(element, elementId, snapshot);
      const customProperties = snapshot.customProperties || {};
      EDITOR_FIELDS.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(customProperties, key) && customProperties[key] !== "") {
          setStyleValue(element.style, key, customProperties[key]);
        } else {
          removeStyleValue(element.style, key);
        }
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
      if (!Number.isFinite(width) || !Number.isFinite(height) || width < 0 || height < 0) {
        return blocked(BROWSER_ERROR_CODES.CURRENT_VALUE_UNAVAILABLE, "rect width/height unavailable.");
      }
      return ok({ width, height, left: toNumber(rect.left) || 0, top: toNumber(rect.top) || 0 });
    } catch (error) {
      return blocked(BROWSER_ERROR_CODES.HOST_READ_FAILED, error.message || "rect read failed");
    }
  }

  function readComputed(element) {
    try {
      return ok(computedStyleReader ? computedStyleReader(element) : null);
    } catch (error) {
      return blocked(BROWSER_ERROR_CODES.HOST_READ_FAILED, error.message || "computed style read failed");
    }
  }

  function getCurrentEntry(elementId, element) {
    const rect = readRect(element);
    if (!rect.ok) return rect;
    const computed = readComputed(element);
    if (!computed.ok) return computed;
    try {
      const width = toNumber(getStyleValue(element.style, EDITOR_WIDTH))
        ?? toNumber(element.style.width)
        ?? toNumber(computed.value && computed.value.width)
        ?? rect.value.width;
      const height = toNumber(getStyleValue(element.style, EDITOR_HEIGHT))
        ?? toNumber(element.style.height)
        ?? toNumber(computed.value && computed.value.height)
        ?? rect.value.height;
      if (!Number.isFinite(width) || !Number.isFinite(height) || width < 0 || height < 0) {
        return blocked(BROWSER_ERROR_CODES.CURRENT_VALUE_UNAVAILABLE, "current size unavailable.");
      }
      const entry = {
        elementId,
        x: toNumber(getStyleValue(element.style, EDITOR_X)) || 0,
        y: toNumber(getStyleValue(element.style, EDITOR_Y)) || 0,
        width,
        height,
        visible: !(element.hidden === true || getStyleValue(element.style, EDITOR_VISIBLE) === "false"),
      };
      if (getStyleValue(element.style, EDITOR_TEXT_OFFSET_X) !== "") entry.textOffsetX = toNumber(getStyleValue(element.style, EDITOR_TEXT_OFFSET_X)) || 0;
      if (getStyleValue(element.style, EDITOR_TEXT_OFFSET_Y) !== "") entry.textOffsetY = toNumber(getStyleValue(element.style, EDITOR_TEXT_OFFSET_Y)) || 0;
      if (getStyleValue(element.style, EDITOR_TEXT_FONT_SIZE) !== "") entry.fontSize = toNumber(getStyleValue(element.style, EDITOR_TEXT_FONT_SIZE));
      return ok(entry);
    } catch (error) {
      return blocked(BROWSER_ERROR_CODES.HOST_READ_FAILED, error.message || "style read failed");
    }
  }

  function applyTransform(element, elementId) {
    const original = ensureOriginal(element, elementId);
    if (!original.ok) return original;
    const targetTransform = original.value.transform || EMPTY_TRANSFORM;
    try {
      setStyleValue(element.style, TARGET_TRANSFORM, targetTransform);
      element.style.transform = `var(${TARGET_TRANSFORM}, none) translate(var(${EDITOR_X}, 0px), var(${EDITOR_Y}, 0px))`;
      return ok();
    } catch (error) {
      return blocked(BROWSER_ERROR_CODES.HOST_APPLY_FAILED, error.message || "transform apply failed");
    }
  }


  function applyTextEntry(element, elementId, entry, original) {
    const textElement = getTextRef(elementId);
    const target = textElement || element;
    const baseX = toNumber(original.value.textState && (original.value.textState.inlineTextIndent || original.value.textState.computedTextIndent)) || 0;
    const baseY = toNumber(original.value.textState && (original.value.textState.inlinePaddingTop || original.value.textState.computedPaddingTop)) || 0;
    const baseFont = toNumber(original.value.textState && (original.value.textState.inlineFontSize || original.value.textState.computedFontSize));
    if (Object.prototype.hasOwnProperty.call(entry, "textOffsetX")) {
      setStyleValue(element.style, EDITOR_TEXT_OFFSET_X, px(entry.textOffsetX));
      target.style.textIndent = px(baseX + (Number(entry.textOffsetX) || 0));
    }
    if (Object.prototype.hasOwnProperty.call(entry, "textOffsetY")) {
      setStyleValue(element.style, EDITOR_TEXT_OFFSET_Y, px(entry.textOffsetY));
      if (textElement) {
        const baseTransform = original.value.textState && original.value.textState.inlineTransform ? `${original.value.textState.inlineTransform} ` : "";
        setStyleValue(element.style, EDITOR_TEXT_TRANSFORM, `translateY(${px(entry.textOffsetY)})`);
        target.style.transform = `${baseTransform}translateY(${px(entry.textOffsetY)})`.trim();
      } else {
        setStyleValue(element.style, EDITOR_TEXT_TRANSFORM, `translateY(${px(entry.textOffsetY)})`);
      }
    }
    if (Object.prototype.hasOwnProperty.call(entry, "fontSize")) {
      setStyleValue(element.style, EDITOR_TEXT_FONT_SIZE, px(entry.fontSize));
      target.style.fontSize = px(entry.fontSize);
    }
    void baseY; void baseFont;
  }

  return {
    validateElementRef(elementId) {
      return getRef(elementId);
    },
    captureElementLayoutState(elementId) {
      const ref = getRef(elementId);
      if (!ref.ok) return ref;
      return createHostSnapshot(ref.value, elementId);
    },
    applyLayoutEntry(elementId, entry) {
      const ref = getRef(elementId);
      if (!ref.ok) return ref;
      const element = ref.value;
      const original = ensureOriginal(element, elementId);
      if (!original.ok) return original;
      try {
        if (Object.prototype.hasOwnProperty.call(entry, "x")) setStyleValue(element.style, EDITOR_X, px(entry.x));
        if (Object.prototype.hasOwnProperty.call(entry, "y")) setStyleValue(element.style, EDITOR_Y, px(entry.y));
        if (Object.prototype.hasOwnProperty.call(entry, "x") || Object.prototype.hasOwnProperty.call(entry, "y")) {
          const appliedTransform = applyTransform(element, elementId);
          if (!appliedTransform.ok) return appliedTransform;
        }
        if (Object.prototype.hasOwnProperty.call(entry, "width")) {
          setStyleValue(element.style, EDITOR_WIDTH, px(entry.width));
          element.style.width = px(entry.width);
        }
        if (Object.prototype.hasOwnProperty.call(entry, "height")) {
          setStyleValue(element.style, EDITOR_HEIGHT, px(entry.height));
          element.style.height = px(entry.height);
        }
        if (Object.prototype.hasOwnProperty.call(entry, "visible")) {
          setStyleValue(element.style, EDITOR_VISIBLE, entry.visible ? "true" : "false");
          element.hidden = entry.visible === false;
        }
        applyTextEntry(element, elementId, entry, original);
        return ok();
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
      if (hostSnapshot.ownership && hostSnapshot.ownership.hasOriginal) {
        originalByElement.set(ref.value, clone(hostSnapshot.ownership.originalSnapshot));
      } else {
        originalByElement.delete(ref.value);
      }
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
