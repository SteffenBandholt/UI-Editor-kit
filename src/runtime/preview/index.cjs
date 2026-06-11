"use strict";

const PREVIEW_RUNTIME_API_STATUS = Object.freeze({
  status: "planned",
  targetPath: "src/runtime/preview",
  hasProductiveRuntimeLogic: false,
  hasHostAppIntegration: false,
  hasStorageIntegration: false,
});

const PLANNED_PREVIEW_RUNTIME_EXPORTS = Object.freeze([
  "getElementAllowedOps",
  "getElementLockedOps",
  "getChangeRequestOperation",
  "isPreviewOperationAllowed",
  "getNodeUiEditorId",
  "getPreviewTargetMode",
  "resolvePreviewTargetElement",
  "getPreviewTargetElement",
  "getPreviewTargetElementId",
  "upsertPreviewChangeRequest",
  "removePendingChangeRequestsForTarget",
  "getPendingChangeRequestSummary",
]);

function getPreviewRuntimeApiStatus() {
  return { ...PREVIEW_RUNTIME_API_STATUS };
}

function getPlannedPreviewRuntimeExports() {
  return PLANNED_PREVIEW_RUNTIME_EXPORTS.slice();
}

module.exports = {
  PREVIEW_RUNTIME_API_STATUS,
  PLANNED_PREVIEW_RUNTIME_EXPORTS,
  getPreviewRuntimeApiStatus,
  getPlannedPreviewRuntimeExports,
};
