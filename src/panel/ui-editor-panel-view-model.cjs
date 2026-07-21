"use strict";
const { PANEL_MODES, PANEL_INTENTS } = require("./panel-intents.cjs");
const { createPanelMessageCatalog } = require("./panel-message-catalog.cjs");
function button(label, intent, enabled, reasonCode, extra) { return { enabled: !!enabled, visible: true, label, intent, ...(reasonCode ? { reasonCode } : {}), ...(extra || {}) }; }
function statusFrom(result, messages) {
  if (!result) return { kind: "idle", code: "IDLE", messageKey: "IDLE", message: messages.get("IDLE") };
  const code = result.code || (result.ok ? "OK" : "UNKNOWN_ERROR");
  const key = result.messageKey || code;
  const incomplete = result.rollbackComplete === false;
  const kind = incomplete ? "warning" : result.blocked ? "blocked" : result.ok === false ? "error" : "success";
  return { kind, code: incomplete ? "ROLLBACK_INCOMPLETE" : code, messageKey: incomplete ? "ROLLBACK_INCOMPLETE" : key, message: result.message || messages.get(incomplete ? "ROLLBACK_INCOMPLETE" : key), ...(Object.prototype.hasOwnProperty.call(result,"rollbackComplete") ? { rollbackComplete: result.rollbackComplete } : {}), ...(result.rollbackErrors ? { details: result.rollbackErrors } : result.details ? { details: result.details } : {}) };
}
function createUiEditorPanelViewModel(options) {
  const cfg = options || {}; const state = cfg.controllerState || {}; let messages = state.messages || cfg.messages || createPanelMessageCatalog(); if (!messages || typeof messages.get !== "function") messages = createPanelMessageCatalog(messages && messages.messages ? messages.messages : messages);
  const selected = !!state.selectedElementId; const editable = selected && state.editable !== false;
  const availableModes = Array.isArray(state.availableModes) ? state.availableModes : [];
  const busy = !!state.busy; const persistence = cfg.persistenceStatus || state.persistenceStatus || { available: true, persistent: true };
  const hasMove = availableModes.includes(PANEL_MODES.MOVE), hasWidth = availableModes.includes(PANEL_MODES.WIDTH), hasHeight = availableModes.includes(PANEL_MODES.HEIGHT);
  const enabledBase = selected && editable && !busy;
  const dpad = {
    up: button("↑", PANEL_INTENTS.DPAD_UP, enabledBase && (state.mode === PANEL_MODES.MOVE || state.mode === PANEL_MODES.HEIGHT), enabledBase ? undefined : "NO_SELECTION", { direction: "up", ariaLabel: "Nach oben" }),
    down: button("↓", PANEL_INTENTS.DPAD_DOWN, enabledBase && (state.mode === PANEL_MODES.MOVE || state.mode === PANEL_MODES.HEIGHT), enabledBase ? undefined : "NO_SELECTION", { direction: "down", ariaLabel: "Nach unten" }),
    left: button("←", PANEL_INTENTS.DPAD_LEFT, enabledBase && (state.mode === PANEL_MODES.MOVE || state.mode === PANEL_MODES.WIDTH), enabledBase ? undefined : "NO_SELECTION", { direction: "left", ariaLabel: "Nach links oder kleiner" }),
    right: button("→", PANEL_INTENTS.DPAD_RIGHT, enabledBase && (state.mode === PANEL_MODES.MOVE || state.mode === PANEL_MODES.WIDTH), enabledBase ? undefined : "NO_SELECTION", { direction: "right", ariaLabel: "Nach rechts oder größer" }),
    center: button("↶", PANEL_INTENTS.DPAD_CENTER, enabledBase, enabledBase ? undefined : "NO_SELECTION", { direction: "center", ariaLabel: "Änderungen dieses Elements verwerfen" }),
  };
  return { selection: { selected, elementId: state.selectedElementId || null, name: state.selectedElementName || "", editable, allowedOps: state.allowedOps || [], effectiveOps: state.effectiveOps || [], availableModes },
    modes: [
      { id: PANEL_MODES.MOVE, label: "Verschieben", enabled: enabledBase && hasMove, active: state.mode === PANEL_MODES.MOVE },
      { id: PANEL_MODES.WIDTH, label: "Breite", enabled: enabledBase && hasWidth, active: state.mode === PANEL_MODES.WIDTH },
      { id: PANEL_MODES.HEIGHT, label: "Höhe", enabled: enabledBase && hasHeight, active: state.mode === PANEL_MODES.HEIGHT },
    ], dpad,
    actions: { save: button("Speichern", PANEL_INTENTS.SAVE, !busy && persistence.available && persistence.persistent, !persistence.available ? "STORAGE_UNAVAILABLE" : !persistence.persistent ? "STORAGE_NOT_PERSISTENT" : undefined), load: button("Laden", PANEL_INTENTS.LOAD, !busy && persistence.available, !persistence.available ? "STORAGE_UNAVAILABLE" : undefined), discardAll: button("Alle Änderungen verwerfen", PANEL_INTENTS.DISCARD_ALL, !busy), resetElement: button("Element auf Standard zurücksetzen", PANEL_INTENTS.REQUEST_RESET_ELEMENT, enabledBase && persistence.persistent, !persistence.persistent ? "STORAGE_NOT_PERSISTENT" : undefined), resetLayout: button("Standardlayout wiederherstellen", PANEL_INTENTS.REQUEST_RESET_LAYOUT, !busy && persistence.persistent, !persistence.persistent ? "STORAGE_NOT_PERSISTENT" : undefined) },
    session: cfg.runtimeStatus || state.runtimeStatus || { active: false, changedCount: 0, changedElementIds: [] }, persistence, dialog: state.dialog || { open: false }, status: statusFrom(cfg.lastResult || state.lastResult, messages), busy };
}
module.exports = { createUiEditorPanelViewModel, statusFrom };
