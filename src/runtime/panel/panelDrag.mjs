import {
  buildDragResult,
  normalizeDragBounds,
  normalizeDragDelta,
  validateDragBounds,
  validateDragDelta,
} from "../drag/dragRuntime.mjs";

export const PANEL_DRAG_COORDINATE_SYSTEM = "css-pixels";

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(source, key) {
  return Boolean(source) && Object.prototype.hasOwnProperty.call(source, key);
}

function normalizeString(value = "") {
  return String(value == null ? "" : value).trim();
}

function createValidationResult(errors) {
  return {
    ok: errors.length === 0,
    errors,
  };
}

function prefixErrors(errors, fieldName) {
  return errors.map((error) => ({
    ...error,
    fieldName: error.fieldName ? `${fieldName}.${error.fieldName}` : fieldName,
  }));
}

function buildViewportConstraints(viewportBounds, panelBounds) {
  const minX = viewportBounds.x;
  const minY = viewportBounds.y;
  return {
    minX,
    minY,
    maxX: Math.max(minX, viewportBounds.x + viewportBounds.width - panelBounds.width),
    maxY: Math.max(minY, viewportBounds.y + viewportBounds.height - panelBounds.height),
  };
}

function validatePanelDragInput(input) {
  const errors = [];

  if (!isObject(input)) {
    errors.push({
      code: "INVALID_PANEL_DRAG_INPUT",
      message: "Panel drag input must be an object.",
    });
    return createValidationResult(errors);
  }

  if (hasOwn(input, "panelId") && typeof input.panelId !== "string") {
    errors.push({
      code: "INVALID_PANEL_ID",
      message: "Panel drag panelId must be a string when present.",
      fieldName: "panelId",
    });
  }

  prefixErrors(validateDragBounds(input.startBounds).errors, "startBounds").forEach((error) => {
    errors.push(error);
  });
  prefixErrors(validateDragDelta(input.delta).errors, "delta").forEach((error) => {
    errors.push(error);
  });
  prefixErrors(validateDragBounds(input.viewportBounds).errors, "viewportBounds").forEach((error) => {
    errors.push(error);
  });

  const coordinateSystem = hasOwn(input, "coordinateSystem")
    ? normalizeString(input.coordinateSystem)
    : PANEL_DRAG_COORDINATE_SYSTEM;
  if (coordinateSystem !== PANEL_DRAG_COORDINATE_SYSTEM) {
    errors.push({
      code: "UNSUPPORTED_PANEL_DRAG_COORDINATE_SYSTEM",
      message: "Panel drag coordinateSystem must be css-pixels.",
      coordinateSystem,
      fieldName: "coordinateSystem",
    });
  }

  return createValidationResult(errors);
}

export function normalizePanelDragInput(input = {}) {
  const source = isObject(input) ? input : {};
  const startBounds = normalizeDragBounds(source.startBounds);
  const viewportBounds = normalizeDragBounds(source.viewportBounds);
  const coordinateSystem = hasOwn(source, "coordinateSystem")
    ? normalizeString(source.coordinateSystem)
    : PANEL_DRAG_COORDINATE_SYSTEM;

  return {
    panelId: normalizeString(source.panelId),
    startBounds,
    delta: normalizeDragDelta(source.delta),
    viewportBounds,
    coordinateSystem,
    constraints: buildViewportConstraints(viewportBounds, startBounds),
  };
}

export function buildPanelDragResult(input = {}) {
  const source = isObject(input) ? input : {};
  const validation = validatePanelDragInput(source);
  const panelId = hasOwn(source, "panelId") ? normalizeString(source.panelId) : "";
  const coordinateSystem = hasOwn(source, "coordinateSystem")
    ? normalizeString(source.coordinateSystem)
    : PANEL_DRAG_COORDINATE_SYSTEM;

  if (!validation.ok) {
    return {
      ok: false,
      errors: validation.errors,
      panelId,
      bounds: null,
      changed: false,
      coordinateSystem,
    };
  }

  const normalized = normalizePanelDragInput(source);
  const result = buildDragResult({
    elementId: normalized.panelId,
    startBounds: normalized.startBounds,
    delta: normalized.delta,
    constraints: normalized.constraints,
    coordinateSystem: normalized.coordinateSystem,
  });

  return {
    ok: result.ok,
    errors: result.errors,
    panelId: normalized.panelId,
    bounds: result.bounds,
    changed: result.changed,
    coordinateSystem: normalized.coordinateSystem,
  };
}

export function calculatePanelDragPosition(input = {}) {
  return buildPanelDragResult(input);
}
