"use strict";

const {
  validateLayoutState,
  normalizeLayoutState,
  getLayoutStateProfileKey,
  assertCompatibleLayoutProfile,
} = require("./layout-state-contract.cjs");

const LAYOUT_STATE_SELECTOR_FIELDS = Object.freeze([
  "targetAppId",
  "uiScope",
  "layoutScope",
  "layoutProfileId",
]);

function isPlainObject(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function clone(value) { return normalizeLayoutState(value); }
function resultError(code, message, details) { return { ok: false, status: code, errors: [{ code, message, ...(details || {}) }] }; }
function normalizeSelector(selector) {
  if (!isPlainObject(selector)) return null;
  const unknown = Object.keys(selector).find((fieldName) => !LAYOUT_STATE_SELECTOR_FIELDS.includes(fieldName));
  if (unknown) return { error: resultError("invalid_layout_state", `Selector-Feld ist nicht erlaubt: ${unknown}`, { field: unknown }) };
  const missing = LAYOUT_STATE_SELECTOR_FIELDS.find((fieldName) => typeof selector[fieldName] !== "string" || selector[fieldName].trim() === "");
  if (missing) return { error: resultError("invalid_layout_state", `Selector-Feld fehlt: ${missing}`, { field: missing }) };
  return LAYOUT_STATE_SELECTOR_FIELDS.reduce((entry, fieldName) => { entry[fieldName] = selector[fieldName]; return entry; }, {});
}
function createMemoryLayoutStateStore(options) {
  const safeOptions = isPlainObject(options) ? options : {};
  const validationOptions = { allowedPayloadFields: safeOptions.allowedPayloadFields || [] };
  const records = new Map();
  function saveLayoutState(layoutState) {
    const validation = validateLayoutState(layoutState, validationOptions);
    if (!validation.ok) return { ok: false, status: validation.errors[0].code, errors: validation.errors };
    const normalized = normalizeLayoutState(layoutState);
    const key = getLayoutStateProfileKey(normalized);
    records.set(key, clone(normalized));
    return { ok: true, status: "layout_state_saved", layoutState: clone(normalized) };
  }
  function loadLayoutState(selector) {
    const normalizedSelector = normalizeSelector(selector);
    if (!normalizedSelector || normalizedSelector.error) return normalizedSelector ? normalizedSelector.error : resultError("invalid_layout_state", "Selector muss ein Objekt sein.");
    const key = getLayoutStateProfileKey(normalizedSelector);
    if (!records.has(key)) return resultError("layout_profile_not_found", "Layout-Profil wurde nicht gefunden.");
    const layoutState = records.get(key);
    const compatible = assertCompatibleLayoutProfile(layoutState, normalizedSelector);
    if (!compatible.ok) return { ok: false, status: "incompatible_layout_profile", errors: compatible.errors };
    return { ok: true, status: "layout_state_loaded", layoutState: clone(layoutState) };
  }
  function resetLayoutState(selector) {
    const normalizedSelector = normalizeSelector(selector);
    if (!normalizedSelector || normalizedSelector.error) return normalizedSelector ? normalizedSelector.error : resultError("invalid_layout_state", "Selector muss ein Objekt sein.");
    const key = getLayoutStateProfileKey(normalizedSelector);
    if (!records.has(key)) return resultError("layout_profile_not_found", "Layout-Profil wurde nicht gefunden.");
    records.delete(key);
    return { ok: true, status: "layout_state_reset", reset: "removed" };
  }
  function listLayoutProfiles(selector) {
    const partial = isPlainObject(selector) ? selector : {};
    const unknown = Object.keys(partial).find((fieldName) => !LAYOUT_STATE_SELECTOR_FIELDS.includes(fieldName));
    if (unknown) return { ok: false, status: "invalid_layout_state", errors: [{ code: "invalid_layout_state", field: unknown, message: `Selector-Feld ist nicht erlaubt: ${unknown}` }] };
    const profiles = Array.from(records.values())
      .filter((state) => Object.keys(partial).every((fieldName) => state[fieldName] === partial[fieldName]))
      .map((state) => LAYOUT_STATE_SELECTOR_FIELDS.reduce((entry, fieldName) => { entry[fieldName] = state[fieldName]; return entry; }, {}));
    return { ok: true, status: "layout_profiles_listed", profiles };
  }
  return { saveLayoutState, loadLayoutState, resetLayoutState, listLayoutProfiles };
}
module.exports = { LAYOUT_STATE_SELECTOR_FIELDS, createMemoryLayoutStateStore };
