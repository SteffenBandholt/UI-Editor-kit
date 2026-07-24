"use strict";

const { createUiEditorRuntime: createBaseUiEditorRuntime } = require("./ui-editor-runtime.cjs");
const { resolveOperationStep } = require("./operation-step-resolver.cjs");
const { blockedResult } = require("./runtime-result.cjs");
const { RUNTIME_ERROR_CODES } = require("./runtime-error-codes.cjs");

function isPositiveFinite(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

function explicitStepFor(registryElement, operation, axis) {
  const steps = registryElement && registryElement.steps;
  if (!steps || typeof steps !== "object") return undefined;

  const keys = [];
  if (operation === "move") keys.push("move");
  if (operation === "resize" && axis === "width") keys.push("resizeWidth", "resize");
  if (operation === "resize" && axis === "height") keys.push("resizeHeight", "resize");
  if (operation === "textMove" && axis === "x") keys.push("textMoveX", "textMove");
  if (operation === "textMove" && axis === "y") keys.push("textMoveY", "textMove");
  if (operation === "fontSize") keys.push("fontSize");

  const configuredKey = keys.find((key) => isPositiveFinite(steps[key]));
  if (!configuredKey) return undefined;
  return resolveOperationStep({ registryElement, operation, axis });
}

function readValue(entry, group, field) {
  if (!entry || typeof entry !== "object") return undefined;
  const grouped = entry[group];
  if (grouped && Number.isFinite(grouped[field])) return grouped[field];
  if (group === "element" && Number.isFinite(entry[field])) return entry[field];
  return undefined;
}

function alignedDelta(current, requested, step) {
  const delta = requested - current;
  const units = delta / step;
  return Math.abs(units - Math.round(units)) < 1e-9;
}

function validateField({ registryElement, currentEntry, payload, group, field, operation, axis }) {
  const values = payload && payload[group];
  if (!values || !Object.prototype.hasOwnProperty.call(values, field)) return null;

  const requested = values[field];
  if (!Number.isFinite(requested)) return null;

  const step = explicitStepFor(registryElement, operation, axis);
  if (!step) return null;

  const current = readValue(currentEntry, group, field);
  if (!Number.isFinite(current)) return null;
  if (alignedDelta(current, requested, step)) return null;

  return blockedResult(
    RUNTIME_ERROR_CODES.VALUE_NOT_ALIGNED_TO_STEP,
    `${group}.${field} is not aligned to the registered step.`,
    { value: { field: `${group}.${field}`, current, requested, step } }
  );
}

function validateChangeRequestStepAlignment({ registryElement, currentEntry, changeRequest }) {
  const payload = changeRequest && changeRequest.payload;
  const checks = [
    { group: "element", field: "x", operation: "move" },
    { group: "element", field: "y", operation: "move" },
    { group: "element", field: "width", operation: "resize", axis: "width" },
    { group: "element", field: "height", operation: "resize", axis: "height" },
    { group: "text", field: "offsetX", operation: "textMove", axis: "x" },
    { group: "text", field: "offsetY", operation: "textMove", axis: "y" },
    { group: "text", field: "fontSize", operation: "fontSize" },
  ];

  for (const check of checks) {
    const result = validateField({ registryElement, currentEntry, payload, ...check });
    if (result) return result;
  }
  return null;
}

function wrapRuntimeWithStepValidation(runtime, registry) {
  return Object.freeze({
    ...runtime,
    applyChange(changeRequest) {
      if (!changeRequest || typeof changeRequest !== "object") return runtime.applyChange(changeRequest);
      if (!registry || typeof registry.getElementById !== "function") return runtime.applyChange(changeRequest);

      let registryElement;
      try {
        registryElement = registry.getElementById(changeRequest.elementId);
      } catch (_error) {
        return runtime.applyChange(changeRequest);
      }
      if (!registryElement) return runtime.applyChange(changeRequest);

      const inspected = typeof runtime.inspectElement === "function"
        ? runtime.inspectElement(changeRequest.scope, changeRequest.elementId)
        : null;
      if (!inspected || inspected.ok === false) return runtime.applyChange(changeRequest);

      const currentEntry = inspected.effectiveLayout || inspected.currentEntry;
      const validation = validateChangeRequestStepAlignment({ registryElement, currentEntry, changeRequest });
      if (validation) return validation;
      return runtime.applyChange(changeRequest);
    },
  });
}

function createUiEditorRuntime(options) {
  const cfg = options || {};
  return wrapRuntimeWithStepValidation(createBaseUiEditorRuntime(cfg), cfg.registry);
}

module.exports = {
  createUiEditorRuntime,
  wrapRuntimeWithStepValidation,
  validateChangeRequestStepAlignment,
};