"use strict";

const TEXT_RESIZE_UNIT = "dip";
const TEXT_RESIZE_TOLERANCE = 0.02;

const TEXT_RESIZE_ERROR_CODES = Object.freeze({
  INVALID_INTENT: "text_resize_invalid_intent",
  EXPECTED_VALUE_CONFLICT: "text_resize_expected_value_conflict",
  READBACK_MISSING: "text_resize_readback_missing",
  READBACK_MISMATCH: "text_resize_readback_mismatch",
  NO_EFFECT: "text_resize_no_effect",
});

function finite(value) {
  if (value === null || value === undefined || typeof value === "boolean" || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function validTolerance(value) {
  const parsed = finite(value);
  return parsed !== null && parsed > 0 ? parsed : TEXT_RESIZE_TOLERANCE;
}

function readback({ requestedFontSize = null, expectedCurrentFontSize = null, previousFontSize = null, appliedFontSize = null, tolerance = TEXT_RESIZE_TOLERANCE } = {}) {
  const acceptedTolerance = validTolerance(tolerance);
  const requested = finite(requestedFontSize);
  const expected = finite(expectedCurrentFontSize);
  const previous = finite(previousFontSize);
  const applied = finite(appliedFontSize);
  return Object.freeze({
    unit: TEXT_RESIZE_UNIT,
    requestedFontSize: requested,
    expectedCurrentFontSize: expected,
    previousFontSize: previous,
    appliedFontSize: applied,
    tolerance: acceptedTolerance,
    changed: previous !== null && applied !== null && Math.abs(previous - applied) > acceptedTolerance,
    matchesRequested: requested !== null && applied !== null && Math.abs(requested - applied) <= acceptedTolerance,
  });
}

function failure(code, message, value) {
  return Object.freeze({ ok: false, code, message, readback: value });
}

function normalizeTextResizeIntent(payload, {
  minimumFontSize = 0,
  maximumFontSize = Number.MAX_SAFE_INTEGER,
  currentFontSize = null,
  tolerance = TEXT_RESIZE_TOLERANCE,
} = {}) {
  const text = payload?.text;
  const keys = text && typeof text === "object" && !Array.isArray(text) ? Object.keys(text) : [];
  const allowed = new Set(["fontSize", "unit", "expectedCurrentFontSize"]);
  const requested = finite(text?.fontSize);
  const expected = text?.expectedCurrentFontSize === null || text?.expectedCurrentFontSize === undefined
    ? null
    : finite(text.expectedCurrentFontSize);
  const unit = text?.unit === undefined ? TEXT_RESIZE_UNIT : text.unit;
  const minimum = finite(minimumFontSize) ?? 0;
  const maximum = finite(maximumFontSize) ?? Number.MAX_SAFE_INTEGER;
  const current = finite(currentFontSize);
  const acceptedTolerance = validTolerance(tolerance);
  const value = readback({ requestedFontSize: requested, expectedCurrentFontSize: expected, previousFontSize: current, tolerance: acceptedTolerance });

  if (!text || keys.length < 1 || keys.some((key) => !allowed.has(key)) || requested === null || requested <= 0 ||
      unit !== TEXT_RESIZE_UNIT || expected === null && text?.expectedCurrentFontSize !== null && text?.expectedCurrentFontSize !== undefined ||
      requested < minimum || requested > maximum) {
    return failure(TEXT_RESIZE_ERROR_CODES.INVALID_INTENT,
      `Schriftgroesse muss als positiver DIP-Wert innerhalb ${minimum} bis ${maximum} angegeben werden.`, value);
  }
  if (expected !== null && current !== null && Math.abs(expected - current) > acceptedTolerance) {
    return failure(TEXT_RESIZE_ERROR_CODES.EXPECTED_VALUE_CONFLICT,
      "Die aktuelle Schriftgroesse hat sich seit der Anforderung geaendert.", value);
  }
  return Object.freeze({
    ok: true,
    code: null,
    message: "textResize-Anforderung ist gueltig.",
    intent: Object.freeze({ unit: TEXT_RESIZE_UNIT, requestedFontSize: requested, expectedCurrentFontSize: expected, tolerance: acceptedTolerance }),
  });
}

function verifyTextResizeReadback(values = {}) {
  const value = readback(values);
  if (value.requestedFontSize === null || value.previousFontSize === null || value.appliedFontSize === null)
    return failure(TEXT_RESIZE_ERROR_CODES.READBACK_MISSING, "Die tatsaechliche Schriftgroesse konnte nicht vollstaendig zurueckgelesen werden.", value);
  if (!value.matchesRequested)
    return failure(TEXT_RESIZE_ERROR_CODES.READBACK_MISMATCH, "Die tatsaechlich angewandte Schriftgroesse entspricht nicht dem akzeptierten Zielwert.", value);
  if (!value.changed)
    return failure(TEXT_RESIZE_ERROR_CODES.NO_EFFECT, "Die tatsaechliche Schriftgroesse blieb unveraendert.", value);
  return Object.freeze({ ok: true, code: null, message: "Schriftgroesse wurde am realen Ziel angewandt und zurueckgelesen.", readback: value });
}

function createTextResizePayload(fontSize, expectedCurrentFontSize = null) {
  const text = { fontSize, unit: TEXT_RESIZE_UNIT };
  if (expectedCurrentFontSize !== null && expectedCurrentFontSize !== undefined)
    text.expectedCurrentFontSize = expectedCurrentFontSize;
  return Object.freeze({ text: Object.freeze(text) });
}

module.exports = Object.freeze({
  TEXT_RESIZE_UNIT,
  TEXT_RESIZE_TOLERANCE,
  TEXT_RESIZE_ERROR_CODES,
  createTextResizePayload,
  normalizeTextResizeIntent,
  verifyTextResizeReadback,
});
