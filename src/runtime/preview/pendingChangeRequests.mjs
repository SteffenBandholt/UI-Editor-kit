import { getChangeRequestOperation } from "./previewOperations.mjs";
import {
  getPreviewTargetElementId,
  getPreviewTargetMode,
} from "./previewTargetModel.mjs";

export const UNKNOWN_PREVIEW_TARGET_APP_ID = "unknown-host";

function normalizeContextValue(value = null) {
  return String(value ?? "").trim();
}

function resolvePreviewChangeRequestContext({ hostContext = {}, registry = {}, state = {} } = {}) {
  const targetAppId = normalizeContextValue(hostContext.targetAppId)
    || normalizeContextValue(registry.targetAppId)
    || normalizeContextValue(state.targetAppId)
    || UNKNOWN_PREVIEW_TARGET_APP_ID;
  const moduleId = normalizeContextValue(hostContext.moduleId)
    || normalizeContextValue(registry.moduleId)
    || normalizeContextValue(state.moduleId);
  const scopeId = normalizeContextValue(hostContext.scopeId)
    || normalizeContextValue(hostContext.activeUiScope)
    || normalizeContextValue(registry.scopeId)
    || normalizeContextValue(registry.uiScope)
    || normalizeContextValue(state.scopeId)
    || normalizeContextValue(state.activeUiScope);

  return { targetAppId, moduleId, scopeId };
}

export function removePendingChangeRequestsForTarget({ state = {}, targetNode = null, notify = null } = {}) {
  if (!Array.isArray(state.pendingChangeRequests)) return 0;

  const targetElementId = getPreviewTargetElementId(state, targetNode);
  if (!targetElementId) return 0;

  const previousCount = state.pendingChangeRequests.length;
  state.pendingChangeRequests = state.pendingChangeRequests.filter((request) => request?.targetElementId !== targetElementId);
  const removedCount = previousCount - state.pendingChangeRequests.length;
  if (removedCount > 0 && typeof notify === "function") notify(state);

  return removedCount;
}

function createBasePreviewChangeRequest({
  state,
  context,
  registryElement,
  normalizedOperation,
  targetElementId,
  getNextChangeRequestId,
  now,
}) {
  return {
    changeId: typeof getNextChangeRequestId === "function" ? getNextChangeRequestId(state) : "",
    targetAppId: context.targetAppId,
    moduleId: context.moduleId,
    scopeId: context.scopeId,
    elementId: registryElement.id,
    targetElementId,
    operation: normalizedOperation,
    payload: {},
    createdAt: now,
    updatedAt: now,
    source: "preview",
    persistent: false,
    previewTargetMode: getPreviewTargetMode(registryElement),
  };
}

function mergePreviewPayload(request, originalOperation, normalizedOperation, payload) {
  if (normalizedOperation === "move") {
    request.payload = {
      dx: (Number(request.payload?.dx) || 0) + (Number(payload?.dx) || 0),
      dy: (Number(request.payload?.dy) || 0) + (Number(payload?.dy) || 0),
    };
    return;
  }

  if (normalizedOperation === "width" || normalizedOperation === "height") {
    request.payload = {
      delta: (Number(request.payload?.delta) || 0) + (Number(payload?.delta) || 0),
    };
    return;
  }

  if (normalizedOperation === "visibility") {
    request.payload = {
      visible: originalOperation === "show",
    };
  }
}

export function upsertPreviewChangeRequest({
  state = {},
  hostContext = {},
  registry = {},
  registryElement = null,
  targetNode = null,
  operation = "",
  payload = {},
  getNextChangeRequestId = null,
  notify = null,
} = {}) {
  if (!registryElement || !targetNode) return null;
  if (!Array.isArray(state.pendingChangeRequests)) state.pendingChangeRequests = [];

  const originalOperation = normalizeContextValue(operation);
  const normalizedOperation = getChangeRequestOperation(originalOperation);
  const targetElementId = getPreviewTargetElementId(state, targetNode);
  if (!normalizedOperation || !targetElementId) return null;

  const existing = state.pendingChangeRequests.find((request) => (
    request?.targetElementId === targetElementId &&
    request?.operation === normalizedOperation
  ));
  const context = resolvePreviewChangeRequestContext({ hostContext, registry, state });
  const now = new Date().toISOString();
  const request = existing || createBasePreviewChangeRequest({
    state,
    context,
    registryElement,
    normalizedOperation,
    targetElementId,
    getNextChangeRequestId,
    now,
  });

  mergePreviewPayload(request, originalOperation, normalizedOperation, payload);
  request.elementId = registryElement.id;
  request.targetElementId = targetElementId;
  request.previewTargetMode = getPreviewTargetMode(registryElement);
  request.updatedAt = now;

  if (!existing) state.pendingChangeRequests.push(request);
  if (typeof notify === "function") notify(state);

  return request;
}

export function getPendingChangeRequestSummary(state = {}, elementId = "") {
  const requests = Array.isArray(state.pendingChangeRequests) ? state.pendingChangeRequests : [];
  const normalizedElementId = normalizeContextValue(elementId);
  const elementRequests = normalizedElementId
    ? requests.filter((request) => request?.elementId === normalizedElementId || request?.targetElementId === normalizedElementId)
    : [];
  const operations = Array.from(new Set(elementRequests.map((request) => request?.operation).filter(Boolean)));

  return {
    total: requests.length,
    operations,
  };
}
