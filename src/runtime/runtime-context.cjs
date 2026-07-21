"use strict";
const { RUNTIME_ERROR_CODES } = require("./runtime-error-codes.cjs");
const { blockedResult, okResult } = require("./runtime-result.cjs");
function isNonEmptyString(value) { return typeof value === "string" && value.trim().length > 0; }
function normalizeTargetContext(context) {
  if (!context || typeof context !== "object" || Array.isArray(context)) return null;
  return {
    targetAppId: isNonEmptyString(context.targetAppId) ? context.targetAppId.trim() : "",
    moduleId: isNonEmptyString(context.moduleId) ? context.moduleId.trim() : "",
    scopeId: isNonEmptyString(context.scopeId) ? context.scopeId.trim() : "",
    layoutProfileId: isNonEmptyString(context.layoutProfileId) ? context.layoutProfileId.trim() : "default",
  };
}
function validateTargetContext(context) {
  const normalized = normalizeTargetContext(context);
  if (!normalized || !isNonEmptyString(normalized.targetAppId) || !isNonEmptyString(normalized.moduleId) || !isNonEmptyString(normalized.scopeId) || !isNonEmptyString(normalized.layoutProfileId)) {
    return blockedResult(RUNTIME_ERROR_CODES.INVALID_TARGET_CONTEXT, "targetContext requires non-empty targetAppId, moduleId, scopeId and layoutProfileId.");
  }
  return okResult(normalized);
}
function assertScope(context, scopeId) {
  if (scopeId === undefined || scopeId === null || scopeId === "") return okResult(context);
  return scopeId === context.scopeId ? okResult(context) : blockedResult(RUNTIME_ERROR_CODES.UNKNOWN_SCOPE, "scopeId does not match runtime targetContext.");
}
module.exports = { normalizeTargetContext, validateTargetContext, assertScope };
