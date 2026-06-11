"use strict";

const { createDefaultPanelState, normalizePanelPosition } = require("./panelState.cjs");

const PREVIEW_BUTTONS = Object.freeze([
  { id: "move-left", label: "Links", operation: "move", payload: { dx: -1, dy: 0 } },
  { id: "move-right", label: "Rechts", operation: "move", payload: { dx: 1, dy: 0 } },
  { id: "move-up", label: "Hoch", operation: "move", payload: { dx: 0, dy: -1 } },
  { id: "move-down", label: "Runter", operation: "move", payload: { dx: 0, dy: 1 } },
  { id: "width-minus", label: "Breite -", operation: "resizeWidth", payload: { delta: -1 } },
  { id: "width-plus", label: "Breite +", operation: "resizeWidth", payload: { delta: 1 } },
  { id: "height-minus", label: "Hoehe -", operation: "resizeHeight", payload: { delta: -1 } },
  { id: "height-plus", label: "Hoehe +", operation: "resizeHeight", payload: { delta: 1 } },
  { id: "hide", label: "Ausblenden", operation: "hide", payload: {} },
  { id: "show", label: "Einblenden", operation: "show", payload: {} },
]);

function normalizeString(value = "") {
  return String(value == null ? "" : value).trim();
}

function normalizeList(value = []) {
  return Array.isArray(value)
    ? value.map((entry) => normalizeString(entry)).filter(Boolean)
    : [];
}

function normalizeSummary(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  return {
    total: Math.max(0, Math.round(Number(source.total) || 0)),
    operations: normalizeList(source.operations),
  };
}

function operationAllowed(operation, allowedOps, lockedOps) {
  if (!operation || lockedOps.includes(operation)) return false;
  if (operation === "resizeWidth") return allowedOps.includes("resize") || allowedOps.includes("width") || allowedOps.includes("resizeWidth");
  if (operation === "resizeHeight") return allowedOps.includes("resize") || allowedOps.includes("height") || allowedOps.includes("resizeHeight");
  return allowedOps.includes(operation);
}

function createPreviewButtons({ allowedOps = [], lockedOps = [], hasTarget = false } = {}) {
  return PREVIEW_BUTTONS.map((button) => ({
    id: button.id,
    label: button.label,
    operation: button.operation,
    payload: { ...button.payload },
    isEnabled: hasTarget && operationAllowed(button.operation, allowedOps, lockedOps),
    kind: "preview",
  }));
}

function buildPanelViewModel(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const panelState = {
    ...createDefaultPanelState(),
    ...(source.state && typeof source.state === "object" ? source.state : {}),
  };
  const targetId = normalizeString(source.targetId || source.target?.id || source.element?.id);
  const targetLabel = normalizeString(source.targetLabel || source.target?.label || source.element?.label || source.element?.name || targetId);
  const previewTargetId = normalizeString(source.previewTargetId || source.previewTarget?.id || targetId);
  const previewTargetLabel = normalizeString(source.previewTargetLabel || source.previewTarget?.label || previewTargetId);
  const allowedOps = normalizeList(source.allowedOps || source.element?.allowedOps);
  const lockedOps = normalizeList(source.lockedOps || source.element?.lockedOps);
  const pendingChangeSummary = normalizeSummary(source.pendingChangeSummary);
  const hasTarget = Boolean(targetId);
  const canReset = source.canReset == null ? hasTarget && pendingChangeSummary.total > 0 : source.canReset === true;
  const canDiscard = source.canDiscard == null ? pendingChangeSummary.total > 0 : source.canDiscard === true;

  const buttons = [
    ...createPreviewButtons({ allowedOps, lockedOps, hasTarget }),
    {
      id: "reset",
      label: "Reset",
      operation: "reset",
      payload: {},
      isEnabled: canReset,
      kind: "panel",
    },
    {
      id: "discard",
      label: "Aenderungen verwerfen",
      operation: "discard",
      payload: {},
      isEnabled: canDiscard,
      kind: "panel",
    },
  ];

  return {
    isOpen: panelState.isOpen === true,
    position: normalizePanelPosition(panelState.position),
    title: normalizeString(source.title) || "Preview",
    targetLabel,
    targetId,
    previewTargetLabel,
    previewTargetId,
    allowedOps,
    lockedOps,
    pendingChangeSummary,
    canReset,
    canDiscard,
    statusText: normalizeString(source.statusText),
    buttons,
  };
}

module.exports = {
  buildPanelViewModel,
  createPreviewButtons,
};
