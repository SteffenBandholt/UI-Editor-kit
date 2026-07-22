"use strict";
const { PANEL_LAYERS, PANEL_MODES, PANEL_INTENTS } = require("./panel-intents.cjs");
const { createPanelMessageCatalog } = require("./panel-message-catalog.cjs");
function button(label, intent, enabled, reasonCode, extra) { return { enabled: !!enabled, visible: true, label, intent, ...(reasonCode ? { reasonCode } : {}), ...(extra || {}) }; }
function statusFrom(result, messages) {
  if (!result) return { kind: "idle", code: "IDLE", messageKey: "IDLE", message: messages.get("IDLE") };
  const code = result.code || (result.ok ? "OK" : "UNKNOWN_ERROR");
  const key = result.messageKey || code;
  const incomplete = result.rollbackComplete === false;
  const kind = incomplete ? "warning" : result.blocked ? "blocked" : result.ok === false ? "error" : "success";
  return { kind, code: incomplete ? "ROLLBACK_INCOMPLETE" : code, messageKey: incomplete ? "ROLLBACK_INCOMPLETE" : key, message: result.message || result.reason || messages.get(incomplete ? "ROLLBACK_INCOMPLETE" : key), ...(Object.prototype.hasOwnProperty.call(result,"rollbackComplete") ? { rollbackComplete: result.rollbackComplete } : {}), ...(result.rollbackErrors ? { details: result.rollbackErrors } : result.details ? { details: result.details } : {}) };
}
function createUiEditorPanelViewModel(options) {
  const cfg = options || {}; const state = cfg.controllerState || {}; let messages = state.messages || cfg.messages || createPanelMessageCatalog(); if (!messages || typeof messages.get !== "function") messages = createPanelMessageCatalog(messages && messages.messages ? messages.messages : messages);
  const selected = !!state.selectedElementId; const editable = selected && state.editable !== false;
  const elementModes = Array.isArray(state.availableModes) ? state.availableModes : [];
  const textModes = Array.isArray(state.availableTextModes) ? state.availableTextModes : [];
  const layer = state.layer || PANEL_LAYERS.ELEMENT;
  const availableModes = layer === PANEL_LAYERS.TEXT ? textModes : elementModes;
  const busy = !!state.busy; const persistence = cfg.persistenceStatus || state.persistenceStatus || { available: true, persistent: true };
  const enabledBase = selected && editable && !busy;
  const directionEnabled = (direction) => {
    if (!enabledBase) return false;
    if ([PANEL_MODES.MOVE, PANEL_MODES.TEXT_POSITION].includes(state.mode)) return true;
    if ([PANEL_MODES.WIDTH, PANEL_MODES.TEXT_SIZE].includes(state.mode)) return ["left", "right"].includes(direction);
    if (state.mode === PANEL_MODES.HEIGHT) return ["up", "down"].includes(direction);
    return false;
  };
  const dpad = {
    up: button("↑", PANEL_INTENTS.DPAD_UP, directionEnabled("up"), enabledBase ? undefined : "NO_SELECTION", { direction: "up", ariaLabel: "Nach oben" }),
    down: button("↓", PANEL_INTENTS.DPAD_DOWN, directionEnabled("down"), enabledBase ? undefined : "NO_SELECTION", { direction: "down", ariaLabel: "Nach unten" }),
    left: button("←", PANEL_INTENTS.DPAD_LEFT, directionEnabled("left"), enabledBase ? undefined : "NO_SELECTION", { direction: "left", ariaLabel: "Nach links oder kleiner" }),
    right: button("→", PANEL_INTENTS.DPAD_RIGHT, directionEnabled("right"), enabledBase ? undefined : "NO_SELECTION", { direction: "right", ariaLabel: "Nach rechts oder größer" }),
    center: button("↶", PANEL_INTENTS.DPAD_CENTER, enabledBase, enabledBase ? undefined : "NO_SELECTION", { direction: "center", ariaLabel: "Änderungen dieses Elements verwerfen" }),
  };
  const allModes = [
    { id: PANEL_MODES.MOVE, label: "Verschieben" }, { id: PANEL_MODES.WIDTH, label: "Breite" }, { id: PANEL_MODES.HEIGHT, label: "Höhe" },
    { id: PANEL_MODES.TEXT_POSITION, label: "Position" }, { id: PANEL_MODES.TEXT_SIZE, label: "Größe" },
  ];
  return {
    selection: { selected, elementId: state.selectedElementId || null, name: state.selectedElementName || "", editable, allowedOps: state.allowedOps || [], effectiveOps: state.effectiveOps || [], availableModes },
    layer,
    layers: [
      { id: PANEL_LAYERS.ELEMENT, label: "ELEMENT", enabled: enabledBase && elementModes.length > 0, active: layer === PANEL_LAYERS.ELEMENT },
      { id: PANEL_LAYERS.TEXT, label: "TEXT", enabled: enabledBase && textModes.length > 0, active: layer === PANEL_LAYERS.TEXT },
    ],
    modes: allModes.filter((mode) => layer === PANEL_LAYERS.TEXT ? mode.id.startsWith("text-") : !mode.id.startsWith("text-")).map((mode) => ({ ...mode, enabled: enabledBase && availableModes.includes(mode.id), active: state.mode === mode.id })),
    dpad, stepSize: state.stepSize || 5,
    actions: {
      save: button("Speichern", PANEL_INTENTS.SAVE, !busy && persistence.available && persistence.persistent, !persistence.available ? "STORAGE_UNAVAILABLE" : !persistence.persistent ? "STORAGE_NOT_PERSISTENT" : undefined),
      load: button("Laden", PANEL_INTENTS.LOAD, !busy && persistence.available, !persistence.available ? "STORAGE_UNAVAILABLE" : undefined),
      discardAll: button("Alle Änderungen verwerfen", PANEL_INTENTS.DISCARD_ALL, !busy),
      resetElement: button("Gespeicherte Elementwerte löschen", PANEL_INTENTS.REQUEST_RESET_ELEMENT, enabledBase && persistence.persistent, !persistence.persistent ? "STORAGE_NOT_PERSISTENT" : undefined),
      resetLayout: button("Gesamtes Layout zurücksetzen", PANEL_INTENTS.REQUEST_RESET_LAYOUT, !busy && persistence.persistent, !persistence.persistent ? "STORAGE_NOT_PERSISTENT" : undefined),
      close: button("Editor schließen", PANEL_INTENTS.CLOSE, !busy),
    },
    session: cfg.runtimeStatus || state.runtimeStatus || { active: false, changedCount: 0, changedElementIds: [] }, persistence, dialog: state.dialog || { open: false }, status: statusFrom(cfg.lastResult || state.lastResult, messages), busy,
  };
}
module.exports = { createUiEditorPanelViewModel, statusFrom };
