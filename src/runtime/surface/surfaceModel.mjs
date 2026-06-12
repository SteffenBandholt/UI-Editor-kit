export const SUPPORTED_SURFACE_TYPES = Object.freeze([
  "ui-screen",
  "panel",
  "pdf-page",
  "canvas",
  "plan",
]);

const DEFAULT_COORDINATE_SYSTEM_BY_SURFACE_TYPE = Object.freeze({
  "ui-screen": "css-pixels",
  panel: "css-pixels",
  "pdf-page": "pdf-points",
  canvas: "canvas-pixels",
  plan: "plan-units",
});

const SURFACE_CAPABILITY_FIELDS = Object.freeze([
  "canHide",
  "canMove",
  "canResize",
]);

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(source, key) {
  return Boolean(source) && Object.prototype.hasOwnProperty.call(source, key);
}

function normalizeString(value = "") {
  return String(value == null ? "" : value).trim();
}

function normalizeBoolean(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeFiniteNumber(value, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function createValidationResult(errors) {
  return {
    ok: errors.length === 0,
    errors,
  };
}

export function isSupportedSurfaceType(surfaceType) {
  return SUPPORTED_SURFACE_TYPES.includes(surfaceType);
}

function getDefaultCoordinateSystem(surfaceType) {
  return DEFAULT_COORDINATE_SYSTEM_BY_SURFACE_TYPE[surfaceType] || "css-pixels";
}

function normalizeSurfaceBounds(bounds) {
  if (!isObject(bounds)) {
    return null;
  }

  return {
    ...bounds,
    x: normalizeFiniteNumber(bounds.x),
    y: normalizeFiniteNumber(bounds.y),
    width: normalizeFiniteNumber(bounds.width),
    height: normalizeFiniteNumber(bounds.height),
  };
}

function normalizeSurfaceCapabilities(capabilities) {
  const source = isObject(capabilities) ? capabilities : {};
  const normalized = { ...source };

  SURFACE_CAPABILITY_FIELDS.forEach((fieldName) => {
    normalized[fieldName] = normalizeBoolean(source[fieldName], false);
  });

  return normalized;
}

export function normalizeSurfaceElement(input) {
  const source = isObject(input) ? input : {};
  const elementId = normalizeString(source.elementId || source.id);
  const label = normalizeString(source.label || source.name || elementId);
  const normalized = {
    ...source,
    elementId,
    label,
    visible: normalizeBoolean(source.visible, true),
  };

  if (hasOwn(source, "bounds")) {
    normalized.bounds = normalizeSurfaceBounds(source.bounds);
  }

  if (hasOwn(source, "capabilities")) {
    normalized.capabilities = normalizeSurfaceCapabilities(source.capabilities);
  }

  return normalized;
}

export function normalizeSurfaceModel(input) {
  const source = isObject(input) ? input : {};
  const surfaceType = normalizeString(source.surfaceType);
  const normalized = {
    ...source,
    surfaceId: normalizeString(source.surfaceId || source.id),
    surfaceType,
    coordinateSystem: normalizeString(source.coordinateSystem || getDefaultCoordinateSystem(surfaceType)),
    elements: Array.isArray(source.elements)
      ? source.elements.map((element) => normalizeSurfaceElement(element))
      : [],
  };

  return normalized;
}

function validateSurfaceBounds(bounds, errors, elementId) {
  if (!isObject(bounds)) {
    errors.push({
      code: "INVALID_SURFACE_ELEMENT_BOUNDS",
      message: "Surface element bounds must be an object.",
      elementId,
    });
    return;
  }

  ["x", "y", "width", "height"].forEach((fieldName) => {
    if (typeof bounds[fieldName] !== "number" || !Number.isFinite(bounds[fieldName])) {
      errors.push({
        code: "INVALID_SURFACE_ELEMENT_BOUNDS_FIELD",
        message: `Surface element bounds.${fieldName} must be a finite number.`,
        elementId,
        fieldName,
      });
    }
  });

  ["width", "height"].forEach((fieldName) => {
    if (typeof bounds[fieldName] === "number" && Number.isFinite(bounds[fieldName]) && bounds[fieldName] < 0) {
      errors.push({
        code: "NEGATIVE_SURFACE_ELEMENT_BOUNDS_SIZE",
        message: `Surface element bounds.${fieldName} must not be negative.`,
        elementId,
        fieldName,
      });
    }
  });
}

function validateSurfaceCapabilities(capabilities, errors, elementId) {
  if (!isObject(capabilities)) {
    errors.push({
      code: "INVALID_SURFACE_ELEMENT_CAPABILITIES",
      message: "Surface element capabilities must be an object.",
      elementId,
    });
    return;
  }

  SURFACE_CAPABILITY_FIELDS.forEach((fieldName) => {
    if (hasOwn(capabilities, fieldName) && typeof capabilities[fieldName] !== "boolean") {
      errors.push({
        code: "INVALID_SURFACE_ELEMENT_CAPABILITY",
        message: `Surface element capabilities.${fieldName} must be boolean.`,
        elementId,
        fieldName,
      });
    }
  });
}

export function validateSurfaceElement(input) {
  const errors = [];

  if (!isObject(input)) {
    errors.push({
      code: "INVALID_SURFACE_ELEMENT",
      message: "Surface element must be an object.",
    });
    return createValidationResult(errors);
  }

  const elementId = input.elementId;

  if (typeof elementId !== "string" || elementId.trim() === "") {
    errors.push({
      code: "INVALID_SURFACE_ELEMENT_ID",
      message: "Surface element elementId must be a non-empty string.",
    });
  }

  if (hasOwn(input, "visible") && typeof input.visible !== "boolean") {
    errors.push({
      code: "INVALID_SURFACE_ELEMENT_VISIBLE",
      message: "Surface element visible must be boolean when present.",
      elementId,
    });
  }

  if (hasOwn(input, "bounds")) {
    validateSurfaceBounds(input.bounds, errors, elementId);
  }

  if (hasOwn(input, "capabilities")) {
    validateSurfaceCapabilities(input.capabilities, errors, elementId);
  }

  return createValidationResult(errors);
}

export function validateSurfaceModel(input) {
  const errors = [];

  if (!isObject(input)) {
    errors.push({
      code: "INVALID_SURFACE_MODEL",
      message: "Surface model must be an object.",
    });
    return createValidationResult(errors);
  }

  if (typeof input.surfaceId !== "string" || input.surfaceId.trim() === "") {
    errors.push({
      code: "INVALID_SURFACE_ID",
      message: "Surface model surfaceId must be a non-empty string.",
    });
  }

  if (typeof input.surfaceType !== "string" || !isSupportedSurfaceType(input.surfaceType)) {
    errors.push({
      code: "UNSUPPORTED_SURFACE_TYPE",
      message: "Surface model surfaceType must be supported.",
      surfaceType: input.surfaceType,
    });
  }

  if (!Array.isArray(input.elements)) {
    errors.push({
      code: "INVALID_SURFACE_ELEMENTS",
      message: "Surface model elements must be an array.",
    });
    return createValidationResult(errors);
  }

  input.elements.forEach((element, index) => {
    const elementResult = validateSurfaceElement(element);
    elementResult.errors.forEach((error) => {
      errors.push({
        ...error,
        index,
      });
    });
  });

  return createValidationResult(errors);
}
