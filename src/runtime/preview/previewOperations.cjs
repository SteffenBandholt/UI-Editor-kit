"use strict";

function normalizeOperationValue(value) {
  return String(value || "").trim();
}

function normalizeOperationList(value) {
  return Array.isArray(value)
    ? value.map((entry) => normalizeOperationValue(entry)).filter(Boolean)
    : [];
}

function getElementAllowedOps(element = null) {
  return normalizeOperationList(element?.allowedOps);
}

function getElementLockedOps(element = null) {
  return normalizeOperationList(element?.lockedOps);
}

function getChangeRequestOperation(operation = "") {
  const normalizedOperation = normalizeOperationValue(operation);
  if (normalizedOperation === "resizeWidth") return "width";
  if (normalizedOperation === "resizeHeight") return "height";
  if (normalizedOperation === "hide" || normalizedOperation === "show") return "visibility";
  return normalizedOperation;
}

function isResizeWidthAllowed(allowedOps, lockedOps) {
  if (lockedOps.includes("width")) return false;
  if (allowedOps.includes("width")) return true;
  if (lockedOps.includes("resize")) return false;
  return allowedOps.includes("resize");
}

function isResizeHeightAllowed(allowedOps, lockedOps) {
  if (lockedOps.includes("height")) return false;
  if (allowedOps.includes("height")) return true;
  if (lockedOps.includes("resize")) return false;
  return allowedOps.includes("resize");
}

function isPreviewOperationAllowed(element = null, operation = "") {
  const normalizedOperation = normalizeOperationValue(operation);
  const allowedOps = getElementAllowedOps(element);
  const lockedOps = getElementLockedOps(element);

  if (!normalizedOperation || lockedOps.includes(normalizedOperation)) return false;
  if (normalizedOperation === "resizeWidth") return isResizeWidthAllowed(allowedOps, lockedOps);
  if (normalizedOperation === "resizeHeight") return isResizeHeightAllowed(allowedOps, lockedOps);

  return allowedOps.includes(normalizedOperation);
}

module.exports = {
  getElementAllowedOps,
  getElementLockedOps,
  getChangeRequestOperation,
  isPreviewOperationAllowed,
};
