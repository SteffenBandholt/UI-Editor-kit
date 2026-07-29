"use strict";

const SPACING_TARGETS = Object.freeze([
  "beforeElement", "afterElement",
  "groupPaddingLeft", "groupPaddingRight", "groupPaddingTop", "groupPaddingBottom",
  "childGapHorizontal", "childGapVertical", "reservedWidth", "reservedHeight",
]);
const SPACING_OPERATIONS = Object.freeze([
  "spacingIncrease", "spacingDecrease", "spacingSet", "spacingReset",
]);
const WIDTH_FLOW_ACTIONS = Object.freeze({
  PRESERVE_SPACE: "preserveSpace",
  REFLOW_NEIGHBORS: "reflowNeighbors",
  SHRINK_GROUP: "shrinkGroup",
});

function isPlainObject(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }

function normalizeSpacingValues(value = {}) {
  if (!isPlainObject(value)) throw new TypeError("spacing muss ein Objekt sein.");
  const result = {};
  for (const [target, raw] of Object.entries(value)) {
    if (!SPACING_TARGETS.includes(target)) throw new TypeError(`Unbekanntes spacingTarget: ${target}`);
    const number = Number(raw);
    if (!Number.isFinite(number) || number < 0) throw new TypeError(`Abstand fuer ${target} muss endlich und nicht negativ sein.`);
    result[target] = number;
  }
  return Object.freeze(result);
}

function validateSpacingIntent(operation, payload, supportedTargets = SPACING_TARGETS) {
  const errors = [];
  if (!SPACING_OPERATIONS.includes(operation)) errors.push({ code: "spacing_operation_invalid", field: "operation" });
  if (!isPlainObject(payload) || !isPlainObject(payload.spacing)) {
    errors.push({ code: "spacing_payload_invalid", field: "payload.spacing" });
    return { ok: false, errors };
  }
  const keys = Object.keys(payload.spacing);
  const allowedKeys = operation === "spacingReset" ? ["target"] : ["target", "value"];
  if (keys.some((key) => !allowedKeys.includes(key)) || !keys.includes("target")) errors.push({ code: "spacing_payload_invalid", field: "payload.spacing" });
  const target = payload.spacing.target;
  if (!SPACING_TARGETS.includes(target) || !supportedTargets.includes(target)) errors.push({ code: "spacing_target_not_allowed", field: "payload.spacing.target" });
  if (operation !== "spacingReset" && (!Number.isFinite(Number(payload.spacing.value)) || Number(payload.spacing.value) < 0)) {
    errors.push({ code: "spacing_value_invalid", field: "payload.spacing.value" });
  }
  return { ok: errors.length === 0, errors };
}

module.exports = Object.freeze({ SPACING_TARGETS, SPACING_OPERATIONS, WIDTH_FLOW_ACTIONS, normalizeSpacingValues, validateSpacingIntent });
