"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { SPACING_OPERATIONS, SPACING_TARGETS, normalizeSpacingValues } = require("../core/spacing-contract.cjs");
const {
  TABLE_LAYOUT_OPERATIONS, TABLE_WIDTH_MODES, TABLE_WRAP_MODES, TABLE_OVERFLOW_MODES,
  TABLE_HORIZONTAL_OVERFLOW_MODES, TABLE_ROW_HEIGHT_MODES,
} = require("../core/table-layout-contract.cjs");

const PROFILE_SCHEMA_VERSION = 2;
const ACTIVE_PROFILE_SCHEMA_VERSION = 1;
const DEFAULT_PROFILE_ID = "standard";
const PROFILE_IDS = new Set(["standard", "compact"]);
const PROFILE_FIELDS = new Set(["schemaVersion", "applicationId", "profileId", "savedAt", "scopes"]);
const SCOPE_FIELDS = new Set(["scopeId", "registryFingerprint", "layoutState", "explicitOperations"]);
const STATE_FIELDS = new Set(["elements"]);
const ELEMENT_FIELDS = new Set([
  "elementId", "scopeId", "x", "y", "width", "height",
  "textOffsetX", "textOffsetY", "fontSize", "visible",
  "spacing", "table",
]);
const TABLE_STATE_FIELDS = new Set([
  "tableId", "columnId", "widthMode", "wrapMode", "overflowMode",
  "horizontalOverflowMode", "rowHeightMode",
]);
const CAPABILITY_FIELDS = Object.freeze({
  Position: ["x", "y"],
  Width: ["width"],
  Height: ["height"],
  TextPosition: ["textOffsetX", "textOffsetY"],
  FontSize: ["fontSize"],
  Visibility: ["visible"],
  Spacing: ["spacing"],
});

function isObject(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function text(value) { return typeof value === "string" ? value.trim() : ""; }
function own(value, key) { return Object.prototype.hasOwnProperty.call(value, key); }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex").toUpperCase(); }
function profilePath(profileRoot, profileId) { return path.join(profileRoot, `${profileId}.layout-profile.json`); }
function markerPath(profileRoot) { return path.join(profileRoot, "startup-profile-recovery.json"); }
function ordinalCompare(left, right) { return left < right ? -1 : left > right ? 1 : 0; }

function capabilities(entry) {
  if (entry?.editable !== true) return [];
  const ops = new Set(Array.isArray(entry.allowedOps) ? entry.allowedOps : []);
  const result = [];
  if (ops.has("move")) result.push("Position");
  if (ops.has("resize") || ops.has("resizeWidth") || ops.has("changeWidth")) result.push("Width");
  if (ops.has("resize") || ops.has("resizeHeight")) result.push("Height");
  if (ops.has("textMove")) result.push("TextPosition");
  if (ops.has("textResize")) result.push("FontSize");
  if (ops.has("setVisibility")) result.push("Visibility");
  if (SPACING_OPERATIONS.some((operation) => ops.has(operation))) result.push("Spacing");
  return result.sort(ordinalCompare);
}

function kind(type) {
  const values = {
    root: "Scope", area: "Area", group: "Group", fieldGroup: "FieldGroup",
    label: "StaticText", field: "InputField", button: "Button", table: "Table",
    tableColumn: "TableColumn", tableHeader: "TableHeader", tableBody: "TableBody",
    tableRow: "TableRow", tableHeaderCell: "TableHeaderCell", tableDataCell: "TableDataCell",
    tableFooter: "TableFooter", tableViewport: "TableViewport", horizontalScrollArea: "HorizontalScrollArea",
    statusIndicator: "StatusIndicator",
    componentPart: "Group",
  };
  return values[type] || "";
}

function createUiScopeFingerprint(scope) {
  const scopeId = text(scope?.scopeId);
  const canonical = (Array.isArray(scope?.elements) ? scope.elements : [])
    .map((entry) => ({
      elementId: text(entry?.id),
      scopeId,
      parentId: entry?.parentId == null ? null : text(entry.parentId),
      kind: kind(entry?.type),
      capabilities: capabilities(entry),
    }))
    .sort((left, right) => ordinalCompare(left.elementId, right.elementId));
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(canonical), "utf8").digest("hex")}`;
}

function error(code, message, field = "") { return { code, message, ...(field ? { field } : {}) }; }
function assertFields(value, allowed, field, errors) {
  if (!isObject(value)) { errors.push(error("invalid_layout_document", `${field} muss ein Objekt sein.`, field)); return; }
  for (const key of Object.keys(value)) if (!allowed.has(key)) errors.push(error("forbidden_field", `Feld '${key}' ist nicht erlaubt.`, `${field}.${key}`));
}
function finite(value) { return typeof value === "number" && Number.isFinite(value); }
function optionalFinite(source, key) {
  if (!isObject(source) || !own(source, key) || source[key] == null) return undefined;
  return finite(source[key]) ? source[key] : undefined;
}
function declaredOptionalBound(source, key) {
  if (!isObject(source) || !own(source, key)) return { declared: false, valid: true, value: undefined };
  if (source[key] == null) return { declared: true, valid: true, value: undefined };
  return { declared: true, valid: finite(source[key]), value: optionalFinite(source, key) };
}

function validateTableState(saved, entry, prefix, errors) {
  const allowed = TABLE_LAYOUT_OPERATIONS.some((operation) => Array.isArray(entry?.allowedOps) && entry.allowedOps.includes(operation));
  if (!allowed) {
    if (saved?.table != null) errors.push(error("operation_not_allowed", "table ist nicht erlaubt.", `${prefix}.table`));
    return;
  }
  if (!isObject(saved?.table)) {
    errors.push(error("invalid_layout_value", "table fehlt oder ist ungÃ¼ltig.", `${prefix}.table`));
    return;
  }
  assertFields(saved.table, TABLE_STATE_FIELDS, `${prefix}.table`, errors);
  const table = saved.table;
  const declaredTableId = text(entry?.tableLayout?.tableId || entry?.tableBinding?.tableId);
  if (!text(table.tableId) || text(table.tableId) !== declaredTableId)
    errors.push(error("invalid_layout_value", "tableId passt nicht zum Tabellenvertrag.", `${prefix}.table.tableId`));
  if (entry?.type === "tableColumn") {
    if (text(table.columnId) !== text(entry?.tableColumnLayout?.columnId))
      errors.push(error("invalid_layout_value", "columnId passt nicht zum Spaltenvertrag.", `${prefix}.table.columnId`));
    if (!TABLE_WIDTH_MODES.includes(table.widthMode)) errors.push(error("invalid_layout_value", "widthMode ist ungÃ¼ltig.", `${prefix}.table.widthMode`));
    if (!TABLE_WRAP_MODES.includes(table.wrapMode)) errors.push(error("invalid_layout_value", "wrapMode ist ungÃ¼ltig.", `${prefix}.table.wrapMode`));
    if (!TABLE_OVERFLOW_MODES.includes(table.overflowMode)) errors.push(error("invalid_layout_value", "overflowMode ist ungÃ¼ltig.", `${prefix}.table.overflowMode`));
    if (table.horizontalOverflowMode != null || table.rowHeightMode != null)
      errors.push(error("invalid_layout_value", "Spaltenstatus enthÃ¤lt Tabellenfelder.", `${prefix}.table`));
  } else {
    if (table.columnId != null || table.widthMode != null || table.wrapMode != null || table.overflowMode != null)
      errors.push(error("invalid_layout_value", "Tabellenstatus enthÃ¤lt Spaltenfelder.", `${prefix}.table`));
    if (!TABLE_HORIZONTAL_OVERFLOW_MODES.includes(table.horizontalOverflowMode)) errors.push(error("invalid_layout_value", "horizontalOverflowMode ist ungÃ¼ltig.", `${prefix}.table.horizontalOverflowMode`));
    if (!TABLE_ROW_HEIGHT_MODES.includes(table.rowHeightMode)) errors.push(error("invalid_layout_value", "rowHeightMode ist ungÃ¼ltig.", `${prefix}.table.rowHeightMode`));
  }
}

function validateElement(saved, entry, scopeId, errors) {
  const prefix = `scopes.${scopeId}.${text(saved?.elementId) || "unknown"}`;
  assertFields(saved, ELEMENT_FIELDS, prefix, errors);
  if (text(saved?.scopeId) !== scopeId) errors.push(error("wrong_scope", "Element-Scope passt nicht.", `${prefix}.scopeId`));
  const capabilitySet = new Set(capabilities(entry));
  validateTableState(saved, entry, prefix, errors);
  for (const [capability, fields] of Object.entries(CAPABILITY_FIELDS)) {
    const allowed = capabilitySet.has(capability);
    for (const field of fields) {
      if (!allowed && saved?.[field] != null) errors.push(error("operation_not_allowed", `${field} ist nicht erlaubt.`, `${prefix}.${field}`));
      if (allowed && saved?.[field] == null) errors.push(error("invalid_layout_value", `${field} fehlt.`, `${prefix}.${field}`));
      if (allowed && field === "visible" && typeof saved?.[field] !== "boolean") errors.push(error("invalid_layout_value", `${field} ist ungültig.`, `${prefix}.${field}`));
      if (allowed && field !== "visible" && field !== "spacing" && !finite(saved?.[field])) errors.push(error("invalid_layout_value", `${field} ist nicht endlich.`, `${prefix}.${field}`));
      if (allowed && field === "spacing") {
        try {
          const normalized = normalizeSpacingValues(saved?.spacing);
          const supported = Array.isArray(entry?.spacingTargets) ? entry.spacingTargets : [];
          if (Object.keys(normalized).some((target) => !SPACING_TARGETS.includes(target) || !supported.includes(target))) {
            errors.push(error("operation_not_allowed", "spacingTarget ist nicht freigegeben.", `${prefix}.spacing`));
          }
        } catch {
          errors.push(error("invalid_layout_value", "spacing ist ungültig.", `${prefix}.spacing`));
        }
      }
    }
  }
  const baseline = entry?.baseline || {};
  for (const [field, minKey, maxKey] of [
    ["width", "minWidth", "maxWidth"],
    ["height", "minHeight", "maxHeight"],
  ]) {
    const value = saved?.[field];
    if (value == null) continue;
    const minimum = declaredOptionalBound(baseline, minKey);
    const maximum = declaredOptionalBound(baseline, maxKey);
    if (!minimum.valid || !maximum.valid || (finite(minimum.value) && finite(maximum.value) && maximum.value < minimum.value)) {
      errors.push(error("incompatible_registry", `${field} besitzt ungültige explizite Grenzen.`, `${prefix}.${field}`));
      continue;
    }
    if (value < 0) errors.push(error("invalid_layout_geometry", `${field} ist technisch nicht darstellbar.`, `${prefix}.${field}`));
    else if ((finite(minimum.value) && value < minimum.value - 0.01) || (finite(maximum.value) && value > maximum.value + 0.01))
      errors.push(error("invalid_layout_geometry", `${field} verletzt eine explizit deklarierte Grenze.`, `${prefix}.${field}`));
  }
  const geometry = isObject(entry?.geometry) ? entry.geometry : {};
  const storedOffset = declaredOptionalBound(geometry, "maximumStoredOffset");
  const ordinaryOffset = declaredOptionalBound(geometry, "maximumOffset");
  const legacyMaximumOffset = finite(storedOffset.value) ? storedOffset.value : ordinaryOffset.value;
  if (!storedOffset.valid || !ordinaryOffset.valid || (finite(storedOffset.value) && storedOffset.value < 0) || (finite(ordinaryOffset.value) && ordinaryOffset.value < 0)) {
    errors.push(error("incompatible_registry", "Die explizite Legacy-Positionsgrenze ist ungültig.", `${prefix}.position`));
  }
  for (const [field, minKey, maxKey] of [["x", "minX", "maxX"], ["y", "minY", "maxY"]]) {
    const value = saved?.[field];
    if (value == null) continue;
    const declaredMinimum = declaredOptionalBound(baseline, minKey);
    const declaredMaximum = declaredOptionalBound(baseline, maxKey);
    if (!declaredMinimum.valid || !declaredMaximum.valid || (finite(declaredMinimum.value) && finite(declaredMaximum.value) && declaredMaximum.value < declaredMinimum.value)) {
      errors.push(error("incompatible_registry", `${field} besitzt ungültige explizite Grenzen.`, `${prefix}.${field}`));
      continue;
    }
    const minimum = declaredMinimum.declared ? declaredMinimum.value : (finite(legacyMaximumOffset) ? -legacyMaximumOffset : undefined);
    const maximum = declaredMaximum.declared ? declaredMaximum.value : legacyMaximumOffset;
    if ((finite(minimum) && value < minimum - 0.01) || (finite(maximum) && value > maximum + 0.01))
      errors.push(error("invalid_layout_geometry", `${field} verletzt eine explizit deklarierte Grenze.`, `${prefix}.${field}`));
  }
  if (saved?.textOffsetX != null && saved.textOffsetX < 0 || saved?.textOffsetY != null && saved.textOffsetY < 0)
    errors.push(error("invalid_layout_geometry", "Textposition darf nicht negativ sein.", prefix));
  if (saved?.fontSize != null && (saved.fontSize <= 0 || saved.fontSize > 512))
    errors.push(error("invalid_layout_geometry", "Schriftgröße ist außerhalb der sicheren Grenzen.", `${prefix}.fontSize`));
}

function validateProfile(profileDocument, options) {
  const errors = [];
  assertFields(profileDocument, PROFILE_FIELDS, "profile", errors);
  if (profileDocument?.schemaVersion !== PROFILE_SCHEMA_VERSION) errors.push(error("unsupported_schema_version", "schemaVersion wird nicht unterstützt.", "schemaVersion"));
  if (text(profileDocument?.applicationId) !== options.applicationId) errors.push(error("wrong_application", "applicationId passt nicht.", "applicationId"));
  if (text(profileDocument?.profileId) !== options.profileId) errors.push(error("wrong_profile", "profileId passt nicht.", "profileId"));
  if (!text(profileDocument?.savedAt) || !Number.isFinite(Date.parse(profileDocument.savedAt))) errors.push(error("invalid_layout_document", "savedAt fehlt oder ist ungültig.", "savedAt"));
  if (!Array.isArray(profileDocument?.scopes)) return { ok: false, errors: [...errors, error("invalid_layout_document", "scopes fehlt.", "scopes")] };
  const scopesById = new Map();
  for (const scope of profileDocument.scopes) {
    assertFields(scope, SCOPE_FIELDS, "scopes", errors);
    const scopeId = text(scope?.scopeId);
    if (!scopeId || scopesById.has(scopeId)) { errors.push(error("duplicate_scope", "Scope fehlt oder ist doppelt.", "scopes.scopeId")); continue; }
    scopesById.set(scopeId, scope);
  }
  for (const scopeId of options.activeScopes) {
    const registryScope = options.registryScopes.find((candidate) => candidate.scopeId === scopeId && candidate.status === "complete");
    const savedScope = scopesById.get(scopeId);
    if (!registryScope) { errors.push(error("unknown_scope", `Scope '${scopeId}' ist nicht vollständig registriert.`, "scopes")); continue; }
    if (!savedScope) { errors.push(error("missing_scope", `Scope '${scopeId}' fehlt.`, "scopes")); continue; }
    const expectedFingerprint = createUiScopeFingerprint(registryScope);
    if (savedScope.registryFingerprint !== expectedFingerprint) errors.push(error("incompatible_registry", `Scope '${scopeId}' hat einen inkompatiblen Fingerprint.`, "registryFingerprint"));
    assertFields(savedScope.layoutState, STATE_FIELDS, `scopes.${scopeId}.layoutState`, errors);
    const savedElements = Array.isArray(savedScope.layoutState?.elements) ? savedScope.layoutState.elements : [];
    const registered = new Map(registryScope.elements.map((entry) => [entry.id, entry]));
    if (savedScope.explicitOperations != null) {
      if (!isObject(savedScope.explicitOperations)) errors.push(error("invalid_layout_document", "explicitOperations muss ein Objekt sein.", `scopes.${scopeId}.explicitOperations`));
      else for (const [elementId, operations] of Object.entries(savedScope.explicitOperations)) {
        const entry = registered.get(elementId);
        if (!entry) { errors.push(error("unknown_element", `Element '${elementId}' ist nicht registriert.`, `scopes.${scopeId}.explicitOperations`)); continue; }
        const allowed = new Set(Array.isArray(entry.allowedOps) ? entry.allowedOps : []);
        if (!Array.isArray(operations) || operations.length === 0 || operations.some((operation) => typeof operation !== "string" || !allowed.has(operation)))
          errors.push(error("operation_not_allowed", `Explizite Operation für '${elementId}' ist nicht erlaubt.`, `scopes.${scopeId}.explicitOperations`));
      }
    }
    const seen = new Set();
    for (const saved of savedElements) {
      const elementId = text(saved?.elementId);
      if (!elementId || seen.has(elementId)) { errors.push(error("duplicate_element", "Element fehlt oder ist doppelt.", `scopes.${scopeId}.elements`)); continue; }
      seen.add(elementId);
      const entry = registered.get(elementId);
      if (!entry) { errors.push(error("unknown_element", `Element '${elementId}' ist nicht registriert.`, `scopes.${scopeId}.elements`)); continue; }
      validateElement(saved, entry, scopeId, errors);
    }
    for (const elementId of registered.keys()) if (!seen.has(elementId)) errors.push(error("missing_element", `Element '${elementId}' fehlt.`, `scopes.${scopeId}.elements`));
  }
  for (const scopeId of scopesById.keys()) if (!options.activeScopes.includes(scopeId)) errors.push(error("unknown_scope", `Scope '${scopeId}' ist nicht aktiv.`, "scopes"));
  return { ok: errors.length === 0, errors };
}

function loadActiveProfileId(profileRoot) {
  const file = path.join(profileRoot, "active-layout-profile.json");
  try {
    const selection = JSON.parse(fs.readFileSync(file, "utf8"));
    return selection?.schemaVersion === ACTIVE_PROFILE_SCHEMA_VERSION && PROFILE_IDS.has(selection.profileId)
      ? selection.profileId : DEFAULT_PROFILE_ID;
  } catch { return DEFAULT_PROFILE_ID; }
}

function writeMarker(profileRoot, result) {
  fs.mkdirSync(profileRoot, { recursive: true });
  const file = markerPath(profileRoot);
  const temporary = path.join(profileRoot, `.startup-profile-recovery.${process.pid}.${Date.now()}.tmp`);
  const marker = {
    schemaVersion: 1,
    applicationId: result.applicationId,
    workspace: "ui",
    profileId: result.profileId,
    profilePath: result.profilePath,
    profileSha256: result.profileSha256 || null,
    state: result.state,
    code: result.code,
    observedAt: new Date().toISOString(),
  };
  fs.writeFileSync(temporary, JSON.stringify(marker, null, 2), { encoding: "utf8", flag: "wx" });
  fs.renameSync(temporary, file);
  return file;
}

function clearMarker(profileRoot) {
  try { fs.unlinkSync(markerPath(profileRoot)); } catch (error) { if (error?.code !== "ENOENT") throw error; }
}

function loadTargetStartupLayout({ profileRoot, applicationId, activeScopes, registryScopes }) {
  const root = path.resolve(profileRoot);
  const profileId = loadActiveProfileId(root);
  const file = profilePath(root, profileId);
  const base = { applicationId, profileId, profilePath: file, editorProcessRequired: false };
  if (!fs.existsSync(file)) { clearMarker(root); return { ...base, ok: true, found: false, applied: false, state: "missing", code: "layout_profile_not_found", scopes: [] }; }
  let bytes;
  let profileDocument;
  try {
    bytes = fs.readFileSync(file);
    profileDocument = JSON.parse(bytes.toString("utf8"));
  } catch (cause) {
    const result = { ...base, ok: false, found: true, applied: false, state: "corrupt", code: "invalid_json", profileSha256: bytes ? sha256(bytes) : null, scopes: [], cause };
    return { ...result, recoveryMarkerPath: writeMarker(root, result) };
  }
  const validation = validateProfile(profileDocument, { applicationId, profileId, activeScopes, registryScopes });
  if (!validation.ok) {
    const code = validation.errors[0]?.code || "invalid_layout_document";
    const state = code === "storage_read_failed" ? "blocked" : code === "invalid_json" || code.startsWith("invalid_") || code === "forbidden_field" || code === "duplicate_element" || code === "duplicate_scope" ? "corrupt" : "incompatible";
    const result = { ...base, ok: false, found: true, applied: false, state, code, profileSha256: sha256(bytes), errors: validation.errors, scopes: [] };
    return { ...result, recoveryMarkerPath: writeMarker(root, result) };
  }
  clearMarker(root);
  return {
    ...base,
    ok: true,
    found: true,
    applied: false,
    state: "compatible",
    code: "layout_profile_loaded",
    profileSha256: sha256(bytes),
    savedAt: profileDocument.savedAt,
    scopes: profileDocument.scopes.map((scope) => ({
      scopeId: scope.scopeId,
      elements: scope.layoutState.elements.map((entry) => ({ ...entry })),
      explicitOperations: scope.explicitOperations == null ? null : structuredClone(scope.explicitOperations),
    })),
  };
}

module.exports = Object.freeze({
  PROFILE_SCHEMA_VERSION,
  createUiScopeFingerprint,
  validateTargetStartupLayoutProfile: validateProfile,
  loadTargetStartupLayout,
});
