"use strict";

const ELECTRON_EDITOR_ERROR_CODES = Object.freeze({
  EDITOR_NOT_INSTALLED: "electron_editor_not_installed",
  EDITOR_START_FAILED: "electron_editor_start_failed",
  EDITOR_ALREADY_RUNNING: "electron_editor_already_running",
  HANDSHAKE_FAILED: "electron_editor_handshake_failed",
  PROTOCOL_UNSUPPORTED: "electron_editor_protocol_unsupported",
  PIPE_ACCESS_DENIED: "electron_editor_pipe_access_denied",
  PIPE_TIMEOUT: "electron_editor_pipe_timeout",
  MESSAGE_INVALID: "electron_editor_message_invalid",
  MESSAGE_TOO_LARGE: "electron_editor_message_too_large",
  SESSION_INVALID: "electron_editor_session_invalid",
  REGISTRY_INVALID: "electron_registry_invalid",
  ELEMENT_NOT_FOUND: "electron_element_not_found",
  OPERATION_NOT_ALLOWED: "electron_operation_not_allowed",
  OPERATION_LOCKED: "electron_operation_locked",
  CHANGE_APPLY_FAILED: "electron_change_apply_failed",
  CHANGE_READBACK_FAILED: "electron_change_readback_failed",
  CHANGE_ROLLBACK_FAILED: "electron_change_rollback_failed",
  SELECTION_FAILED: "electron_selection_failed",
  HIGHLIGHT_FAILED: "electron_highlight_failed",
  PROFILE_LOAD_FAILED: "electron_profile_load_failed",
  PROFILE_SAVE_FAILED: "electron_profile_save_failed",
  RESTORE_FAILED: "electron_restore_failed",
  PDF_NOT_AVAILABLE: "electron_pdf_not_available",
});

class ElectronEditorError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = "ElectronEditorError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

module.exports = Object.freeze({ ELECTRON_EDITOR_ERROR_CODES, ElectronEditorError });
