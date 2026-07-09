"use strict";

const { getEditorStatusMessage } = require("./editor-status-messages.cjs");

function isObject(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function hasFunction(source, name) { return isObject(source) && typeof source[name] === "function"; }
function manifestAllows(manifest, key) { return isObject(manifest) && manifest[key] === true; }
function hostAllows(hostAdapter, key) { return hasFunction(hostAdapter, key); }

const CONTROL_DEFS = Object.freeze({
  save: Object.freeze({ manifestKey: "saveLayoutState", hostKey: "saveLayoutState", available: "save_available", blocked: "save_blocked" }),
  load: Object.freeze({ manifestKey: "loadLayoutState", hostKey: "loadLayoutState", available: "load_available", blocked: "load_blocked" }),
  reset: Object.freeze({ manifestKey: "resetLayoutState", hostKey: "resetLayoutState", available: "reset_available", blocked: "reset_blocked" }),
});
const BLOCKING_LAYOUT_STATUSES = Object.freeze([
  "invalid_layout_state",
  "unsupported_layout_schema_version",
  "layout_profile_not_found",
  "layout_state_unavailable",
]);

function createControlState(action, hostAdapter, manifest, layoutStateAvailable, blockStatus) {
  const def = CONTROL_DEFS[action];
  if (blockStatus) return { action, status: blockStatus, available: false, message: getEditorStatusMessage(blockStatus) };
  if (!layoutStateAvailable) return { action, status: "layout_state_unavailable", available: false, message: getEditorStatusMessage("layout_state_unavailable") };
  const available = Boolean(def && manifestAllows(manifest, def.manifestKey) && hostAllows(hostAdapter, def.hostKey));
  return { action, status: available ? def.available : def.blocked, available, message: available ? `${action} ist fuer Layout-State verfuegbar.` : `${action} ist fuer Layout-State blockiert.` };
}
function resolveBlockStatus(values) {
  if (BLOCKING_LAYOUT_STATUSES.includes(values.status)) return values.status;
  if (values.validation && values.validation.ok === false && Array.isArray(values.validation.errors) && values.validation.errors.length > 0) {
    const code = values.validation.errors[0].code;
    return BLOCKING_LAYOUT_STATUSES.includes(code) ? code : "invalid_layout_state";
  }
  return null;
}
function createEditorLayoutControlViewModel(values) {
  const safeValues = isObject(values) ? values : {};
  const hostAdapter = safeValues.hostAdapter || null;
  const manifest = safeValues.manifest || null;
  const blockStatus = resolveBlockStatus(safeValues);
  const layoutStateAvailable = safeValues.layoutStateAvailable !== false && (safeValues.layoutState !== undefined || hasFunction(hostAdapter, "getCurrentLayoutState"));
  const controls = {
    save: createControlState("save", hostAdapter, manifest, layoutStateAvailable, blockStatus),
    load: createControlState("load", hostAdapter, manifest, layoutStateAvailable, blockStatus),
    reset: createControlState("reset", hostAdapter, manifest, layoutStateAvailable, blockStatus),
  };
  return { ok: !blockStatus && layoutStateAvailable, status: blockStatus || (layoutStateAvailable ? "layout_controls_ready" : "layout_state_unavailable"), controls };
}
function createEditorLayoutControlResultViewModel(result) {
  const safeResult = isObject(result) ? result : {};
  if (safeResult.ok === false || safeResult.accepted === false) {
    const status = BLOCKING_LAYOUT_STATUSES.includes(safeResult.status) ? safeResult.status : "target_rejected_change";
    return { ok: false, status, message: getEditorStatusMessage(status) };
  }
  return { ok: true, status: "layout_control_accepted", message: "Layout-Control-Status wurde akzeptiert." };
}
module.exports = { createEditorLayoutControlViewModel, createEditorLayoutControlResultViewModel };
