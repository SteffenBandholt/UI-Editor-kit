export const PANEL_DEFAULT_POSITION = Object.freeze({
  left: null,
  top: 132,
  right: 24,
  bottom: null,
});

function normalizeNumber(value) {
  if (value == null || value === "") return null;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.round(parsed));
}

export function normalizePanelPosition(position = {}) {
  const source = position && typeof position === "object" ? position : {};
  const normalized = {
    left: normalizeNumber(source.left),
    top: normalizeNumber(source.top),
    right: normalizeNumber(source.right),
    bottom: normalizeNumber(source.bottom),
  };

  if (normalized.top == null) normalized.top = PANEL_DEFAULT_POSITION.top;
  if (normalized.left == null && normalized.right == null) normalized.right = PANEL_DEFAULT_POSITION.right;

  return normalized;
}

export function createDefaultPanelState() {
  return {
    isOpen: true,
    position: { ...PANEL_DEFAULT_POSITION },
  };
}

export function updatePanelPosition(state = {}, position = {}) {
  return {
    ...createDefaultPanelState(),
    ...(state && typeof state === "object" ? state : {}),
    position: normalizePanelPosition(position),
  };
}

export function setPanelOpen(state = {}, isOpen = true) {
  return {
    ...createDefaultPanelState(),
    ...(state && typeof state === "object" ? state : {}),
    isOpen: isOpen === true,
  };
}
