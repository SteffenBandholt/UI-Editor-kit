"use strict";

const SAFE_DEFAULT_STEP = 1;

function valid(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function resolveOperationStep(options) {
  const cfg = options || {};
  const steps = cfg.registryElement && cfg.registryElement.steps && typeof cfg.registryElement.steps === "object" ? cfg.registryElement.steps : {};
  const panelDefault = valid(cfg.panelStepSize);
  const explicit = valid(cfg.stepSize);
  if (explicit !== undefined) return explicit;
  if (cfg.operation === "move") return valid(steps.move) ?? panelDefault ?? SAFE_DEFAULT_STEP;
  if (cfg.operation === "resize" && cfg.axis === "width") return valid(steps.resizeWidth) ?? valid(steps.resize) ?? panelDefault ?? SAFE_DEFAULT_STEP;
  if (cfg.operation === "resize" && cfg.axis === "height") return valid(steps.resizeHeight) ?? valid(steps.resize) ?? panelDefault ?? SAFE_DEFAULT_STEP;
  if (cfg.operation === "textMove" && cfg.axis === "x") return valid(steps.textMoveX) ?? valid(steps.textMove) ?? panelDefault ?? SAFE_DEFAULT_STEP;
  if (cfg.operation === "textMove" && cfg.axis === "y") return valid(steps.textMoveY) ?? valid(steps.textMove) ?? panelDefault ?? SAFE_DEFAULT_STEP;
  if (cfg.operation === "fontSize") return valid(steps.fontSize) ?? panelDefault ?? SAFE_DEFAULT_STEP;
  return panelDefault ?? SAFE_DEFAULT_STEP;
}

module.exports = { resolveOperationStep, SAFE_DEFAULT_STEP };
