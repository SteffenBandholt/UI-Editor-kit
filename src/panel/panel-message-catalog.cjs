"use strict";
const defaults = Object.freeze({
  NO_SELECTION: "Kein Element ausgewählt.", UNKNOWN_ELEMENT: "Element ist nicht registriert.", ELEMENT_NOT_EDITABLE: "Element ist nicht editierbar.",
  OPERATION_NOT_ALLOWED: "Operation ist nicht erlaubt.", CHANGE_APPLIED: "Änderung übernommen.", ELEMENT_CHANGES_DISCARDED: "Änderungen dieses Elements verworfen.",
  LAYOUT_SAVED: "Layout gespeichert.", LAYOUT_LOADED: "Layout geladen.", ALL_CHANGES_DISCARDED: "Alle Sitzungsänderungen verworfen.",
  ELEMENT_RESET_TO_DEFAULTS: "Element auf Standard zurückgesetzt.", LAYOUT_RESET_TO_DEFAULTS: "Standardlayout wiederhergestellt.",
  STORAGE_UNAVAILABLE: "Persistenz ist nicht verfügbar.", STORAGE_NOT_PERSISTENT: "Persistenz ist nicht dauerhaft.", ROLLBACK_INCOMPLETE: "Rollback unvollständig.",
  UNKNOWN_ERROR: "Unbekannter Fehler.", MIN_SIZE_REACHED: "Mindestgröße erreicht.", BUSY: "Bedienpanel ist beschäftigt.", IDLE: "Bereit.",
  RESET_ELEMENT_TITLE: "Element dauerhaft zurücksetzen", RESET_ELEMENT_MESSAGE: "Nur das ausgewählte Element wird dauerhaft auf den Standard zurückgesetzt. Andere Elemente bleiben unverändert.",
  RESET_LAYOUT_TITLE: "Standardlayout dauerhaft wiederherstellen", RESET_LAYOUT_MESSAGE: "Das gespeicherte Layout für aktuellen Scope und aktuelles Profil wird dauerhaft gelöscht.",
});
function createPanelMessageCatalog(overrides) {
  const messages = { ...defaults, ...(overrides || {}) };
  return Object.freeze({ get(key) { return messages[key] || messages.UNKNOWN_ERROR; }, messages: Object.freeze({ ...messages }) });
}
module.exports = { createPanelMessageCatalog };
