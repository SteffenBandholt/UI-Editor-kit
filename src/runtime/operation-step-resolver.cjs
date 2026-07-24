"use strict";

const SAFE_DEFAULT_STEP = 1;

function positiveFinite(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function resolveOperationStep(options) {
  const cfg = options || {};
  const steps = cfg.registryElement && cfg.registryElement.steps && typeof cfg.registryElement.steps === "object"
    ? cfg.registryElement.steps
    : {};
  const panelFallback = positiveFinite(cfg.panelStepSize);
  let registryStep;

  if (cfg.operation === "move") registryStep = positiveFinite(steps.move);
  else if (cfg.operation === "resize" && cfg.axis === "width") registryStep = positiveFinite(steps.resizeWidth) ?? positiveFinite(steps.resize);
  else if (cfg.operation === "resize" && cfg.axis === "height") registryStep = positiveFinite(steps.resizeHeight) ?? positiveFinite(steps.resize);
  else if (cfg.operation === "textMove" && cfg.axis === "x") registryStep = positiveFinite(steps.textMoveX) ?? positiveFinite(steps.textMove);
  else if (cfg.operation === "textMove" && cfg.axis === "y") registryStep = positiveFinite(steps.textMoveY) ?? positiveFinite(steps.textMove);
  else if (cfg.operation === "fontSize") registryStep = positiveFinite(steps.fontSize);

  return registryStep ?? panelFallback ?? SAFE_DEFAULT_STEP;
}

module.exports = { resolveOperationStep, SAFE_DEFAULT_STEP };
