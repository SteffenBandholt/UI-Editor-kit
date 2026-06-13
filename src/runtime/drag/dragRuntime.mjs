export const SUPPORTED_DRAG_COORDINATE_SYSTEMS = Object.freeze([
  "css-pixels",
  "pdf-points",
  "canvas-pixels",
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

function normalizeFiniteNumber(value, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function createValidationResult(errors) {
  return {
    ok: errors.length === 0,
    errors,
  };
}

export function isSupportedDragCoordinateSystem(coordinateSystem) {
  return SUPPORTED_DRAG_COORDINATE_SYSTEMS.includes(coordinateSystem);
}

export function normalizeDragBounds(input) {
  const source = isObject(input) ? input : {};
  return {
    ...source,
    x: normalizeFiniteNumber(source.x),
    y: normalizeFiniteNumber(source.y),
    width: normalizeFiniteNumber(source.width),
    height: normalizeFiniteNumber(source.height),
  };
}

export function normalizeDragDelta(input) {
  const source = isObject(input) ? input : {};
  return {
    ...source,
    x: normalizeFiniteNumber(source.x),
    y: normalizeFiniteNumber(source.y),
  };
}

function normalizeDragConstraints(input) {
  if (!isObject(input)) return null;

  const normalized = { ...input };
  ["minX", "minY", "maxX", "maxY"].forEach((fieldName) => {
    if (hasOwn(input, fieldName)) {
      normalized[fieldName] = normalizeFiniteNumber(input[fieldName]);
    }
  });
  return normalized;
}

export function validateDragBounds(input) {
  const errors = [];

  if (!isObject(input)) {
    errors.push({
      code: "INVALID_DRAG_BOUNDS",
      message: "Drag bounds must be an object.",
    });
    return createValidationResult(errors);
  }

  ["x", "y", "width", "height"].forEach((fieldName) => {
    if (typeof input[fieldName] !== "number" || !Number.isFinite(input[fieldName])) {
      errors.push({
        code: "INVALID_DRAG_BOUNDS_FIELD",
        message: `Drag bounds.${fieldName} must be a finite number.`,
        fieldName,
      });
    }
  });

  ["width", "height"].forEach((fieldName) => {
    if (typeof input[fieldName] === "number" && Number.isFinite(input[fieldName]) && input[fieldName] < 0) {
      errors.push({
        code: "NEGATIVE_DRAG_BOUNDS_SIZE",
        message: `Drag bounds.${fieldName} must not be negative.`,
        fieldName,
      });
    }
  });

  return createValidationResult(errors);
}

export function validateDragDelta(input) {
  const errors = [];

  if (!isObject(input)) {
    errors.push({
      code: "INVALID_DRAG_DELTA",
      message: "Drag delta must be an object.",
    });
    return createValidationResult(errors);
  }

  ["x", "y"].forEach((fieldName) => {
    if (typeof input[fieldName] !== "number" || !Number.isFinite(input[fieldName])) {
      errors.push({
        code: "INVALID_DRAG_DELTA_FIELD",
        message: `Drag delta.${fieldName} must be a finite number.`,
        fieldName,
      });
    }
  });

  return createValidationResult(errors);
}

function validateDragConstraints(input) {
  const errors = [];

  if (input == null) return createValidationResult(errors);

  if (!isObject(input)) {
    errors.push({
      code: "INVALID_DRAG_CONSTRAINTS",
      message: "Drag constraints must be an object when present.",
    });
    return createValidationResult(errors);
  }

  ["minX", "minY", "maxX", "maxY"].forEach((fieldName) => {
    if (hasOwn(input, fieldName) && (typeof input[fieldName] !== "number" || !Number.isFinite(input[fieldName]))) {
      errors.push({
        code: "INVALID_DRAG_CONSTRAINT_FIELD",
        message: `Drag constraints.${fieldName} must be a finite number.`,
        fieldName,
      });
    }
  });

  if (
    typeof input.minX === "number"
    && typeof input.maxX === "number"
    && Number.isFinite(input.minX)
    && Number.isFinite(input.maxX)
    && input.maxX < input.minX
  ) {
    errors.push({
      code: "INVALID_DRAG_CONSTRAINT_RANGE",
      message: "Drag constraints.maxX must not be smaller than minX.",
      fieldName: "maxX",
    });
  }

  if (
    typeof input.minY === "number"
    && typeof input.maxY === "number"
    && Number.isFinite(input.minY)
    && Number.isFinite(input.maxY)
    && input.maxY < input.minY
  ) {
    errors.push({
      code: "INVALID_DRAG_CONSTRAINT_RANGE",
      message: "Drag constraints.maxY must not be smaller than minY.",
      fieldName: "maxY",
    });
  }

  return createValidationResult(errors);
}

export function applyDragDelta(bounds, delta) {
  const normalizedBounds = normalizeDragBounds(bounds);
  const normalizedDelta = normalizeDragDelta(delta);
  return {
    ...normalizedBounds,
    x: normalizedBounds.x + normalizedDelta.x,
    y: normalizedBounds.y + normalizedDelta.y,
  };
}

function clampNumber(value, minValue, maxValue) {
  let nextValue = value;
  if (typeof minValue === "number" && Number.isFinite(minValue)) {
    nextValue = Math.max(nextValue, minValue);
  }
  if (typeof maxValue === "number" && Number.isFinite(maxValue)) {
    nextValue = Math.min(nextValue, maxValue);
  }
  return nextValue;
}

export function clampBoundsToConstraints(bounds, constraints = null) {
  const normalizedBounds = normalizeDragBounds(bounds);
  const normalizedConstraints = normalizeDragConstraints(constraints);
  if (!normalizedConstraints) return normalizedBounds;

  return {
    ...normalizedBounds,
    x: clampNumber(normalizedBounds.x, normalizedConstraints.minX, normalizedConstraints.maxX),
    y: clampNumber(normalizedBounds.y, normalizedConstraints.minY, normalizedConstraints.maxY),
  };
}

function validateDragInput(input) {
  const errors = [];

  if (!isObject(input)) {
    errors.push({
      code: "INVALID_DRAG_INPUT",
      message: "Drag input must be an object.",
    });
    return createValidationResult(errors);
  }

  validateDragBounds(input.startBounds).errors.forEach((error) => {
    errors.push({
      ...error,
      fieldName: error.fieldName ? `startBounds.${error.fieldName}` : "startBounds",
    });
  });

  validateDragDelta(input.delta).errors.forEach((error) => {
    errors.push({
      ...error,
      fieldName: error.fieldName ? `delta.${error.fieldName}` : "delta",
    });
  });

  validateDragConstraints(input.constraints).errors.forEach((error) => {
    errors.push({
      ...error,
      fieldName: error.fieldName ? `constraints.${error.fieldName}` : "constraints",
    });
  });

  if (hasOwn(input, "coordinateSystem")) {
    const coordinateSystem = normalizeString(input.coordinateSystem);
    if (!isSupportedDragCoordinateSystem(coordinateSystem)) {
      errors.push({
        code: "UNSUPPORTED_DRAG_COORDINATE_SYSTEM",
        message: "Drag coordinateSystem must be supported when present.",
        coordinateSystem,
      });
    }
  }

  return createValidationResult(errors);
}

function boundsChanged(firstBounds, secondBounds) {
  return firstBounds.x !== secondBounds.x
    || firstBounds.y !== secondBounds.y
    || firstBounds.width !== secondBounds.width
    || firstBounds.height !== secondBounds.height;
}

export function buildDragResult(input) {
  const source = isObject(input) ? input : {};
  const validation = validateDragInput(source);
  if (!validation.ok) {
    return {
      ok: false,
      errors: validation.errors,
      elementId: normalizeString(source.elementId),
      bounds: null,
      changed: false,
    };
  }

  const startBounds = normalizeDragBounds(source.startBounds);
  const movedBounds = applyDragDelta(startBounds, source.delta);
  const clampedBounds = clampBoundsToConstraints(movedBounds, source.constraints);

  return {
    ok: true,
    errors: [],
    elementId: normalizeString(source.elementId),
    coordinateSystem: hasOwn(source, "coordinateSystem") ? normalizeString(source.coordinateSystem) : "",
    bounds: clampedBounds,
    changed: boundsChanged(startBounds, clampedBounds),
  };
}
