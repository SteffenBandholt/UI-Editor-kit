"use strict";

const EDITOR_STATUS_MESSAGES = Object.freeze({
  no_selection: "Kein Element ausgewaehlt.",
  unknown_scope: "Scope ist nicht bekannt oder nicht verfuegbar.",
  unknown_element: "Element ist nicht registriert.",
  wrong_scope: "Element gehoert nicht zum aktiven Scope.",
  operation_not_allowed: "Operation ist fuer dieses Element nicht erlaubt.",
  operation_locked: "Operation ist fuer dieses Element gesperrt.",
  invalid_payload: "Aenderungsdaten sind ungueltig.",
  forbidden_field: "Feld ist im neutralen Vertrag nicht erlaubt.",
  layout_state_unavailable: "Layout-Zustand ist nicht verfuegbar.",
  invalid_layout_state: "Layout-Zustand ist ungueltig.",
  unsupported_layout_schema_version: "Layout-Schema-Version wird nicht unterstuetzt.",
  incompatible_layout_profile: "Layout-Profil passt nicht zum aktiven Scope.",
  layout_profile_not_found: "Layout-Profil wurde nicht gefunden.",
  layout_reset_unavailable: "Layout-Reset ist nicht verfuegbar.",
  target_rejected_change: "Ziel hat die Layout-Aenderung abgelehnt.",
});

function getEditorStatusMessage(code) {
  return EDITOR_STATUS_MESSAGES[code] || "Neutraler Editor-Status.";
}

module.exports = {
  EDITOR_STATUS_MESSAGES,
  getEditorStatusMessage,
};
