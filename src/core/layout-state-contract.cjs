"use strict";

const {
  ALLOWED_LAYOUT_PAYLOAD_FIELDS,
  CONDITIONAL_LAYOUT_PAYLOAD_FIELDS,
} = require("./change-request-validator.cjs");
const { getForbiddenChangeRequestFields } = require("./change-request-model.cjs");

const SUPPORTED_LAYOUT_SCHEMA_VERSION = 1;
const LAYOUT_STATE_REQUIRED_FIELDS = Object.freeze([
  "schemaVersion",
  "targetAppId",
  "uiScope",
  "layoutScope",
  "layoutProfileId",
]);
const LAYOUT_STATE_OPTIONAL_FIELDS = Object.freeze([
  "elements",
  "changes",
  "layoutValues",
  "createdAt",
  "updatedAt",
  "source",
  "version",
  "revision",
]);
const LAYOUT_STATE_FIELDS = Object.freeze([...LAYOUT_STATE_REQUIRED_FIELDS, ...LAYOUT_STATE_OPTIONAL_FIELDS]);
const LAYOUT_STATE_SOURCES = Object.freeze(["default", "saved", "reset"]);
const LAYOUT_STATE_ERROR_CODES = Object.freeze([
  "invalid_layout_state",
  "unsupported_layout_schema_version",
  "incompatible_layout_profile",
  "layout_profile_not_found",
  "layout_state_unavailable",
  "layout_reset_unavailable",
  "target_rejected_change",
]);
const LAYOUT_CONTAINER_FIELDS = Object.freeze(["elements", "changes", "layoutValues"]);
const FORBIDDEN_LAYOUT_STATE_FIELDS = Object.freeze([
  ...getForbiddenChangeRequestFields(),
  "businessData",
  "domainData",
  "recordId",
  "entityId",
  "customerId",
  "projectId",
  "domainStatus",
  "action",
  "actions",
  "payload",
  "filePath",
  "upload",
  "import",
  "export",
  "scanDom",
  "autoRegister",
]);

function hasOwn(source, key) {
  return Boolean(source) && Object.prototype.hasOwnProperty.call(source, key);
}
function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (isPlainObject(value)) {
    const clone = {};
    Object.keys(value).forEach((key) => { clone[key] = cloneValue(value[key]); });
    return clone;
  }
  return value;
}
function createResult(errors) {
  return { ok: errors.length === 0, errors };
}
function createError(code, message, details) {
  return { code, message, ...(details || {}) };
}
function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}
function findForbiddenFields(value, pathPrefix) {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => findForbiddenFields(entry, `${pathPrefix}[${index}]`));
  }
  if (!isPlainObject(value)) return [];
  return Object.keys(value).flatMap((key) => {
    const fieldPath = pathPrefix ? `${pathPrefix}.${key}` : key;
    const nested = findForbiddenFields(value[key], fieldPath);
    return FORBIDDEN_LAYOUT_STATE_FIELDS.includes(key) ? [fieldPath, ...nested] : nested;
  });
}
function validateNeutralLayoutValue(value, pathPrefix, errors, allowedConditionalFields) {
  if (!isPlainObject(value)) {
    errors.push(createError("invalid_layout_state", "Layoutwert muss ein Objekt sein.", { field: pathPrefix }));
    return;
  }
  Object.keys(value).forEach((fieldName) => {
    const fieldPath = pathPrefix ? `${pathPrefix}.${fieldName}` : fieldName;
    if (!ALLOWED_LAYOUT_PAYLOAD_FIELDS.includes(fieldName)) {
      errors.push(createError("invalid_layout_state", `Layoutwert ist nicht erlaubt: ${fieldName}`, { field: fieldPath }));
      return;
    }
    if (CONDITIONAL_LAYOUT_PAYLOAD_FIELDS.includes(fieldName) && !allowedConditionalFields.includes(fieldName)) {
      errors.push(createError("invalid_layout_state", `Layoutwert braucht eine ausdrueckliche Freigabe: ${fieldName}`, { field: fieldPath }));
    }
  });
}
function validateLayoutState(layoutState, options) {
  const errors = [];
  const safeOptions = isPlainObject(options) ? options : {};
  const allowedConditionalFields = Array.isArray(safeOptions.allowedPayloadFields) ? safeOptions.allowedPayloadFields : [];
  if (!isPlainObject(layoutState)) {
    return createResult([createError("invalid_layout_state", "LayoutState muss ein Objekt sein.")]);
  }
  Object.keys(layoutState).forEach((fieldName) => {
    if (!LAYOUT_STATE_FIELDS.includes(fieldName)) {
      errors.push(createError("invalid_layout_state", `LayoutState-Feld ist nicht erlaubt: ${fieldName}`, { field: fieldName }));
    }
  });
  LAYOUT_STATE_REQUIRED_FIELDS.forEach((fieldName) => {
    if (!hasOwn(layoutState, fieldName)) errors.push(createError("invalid_layout_state", `Pflichtfeld fehlt: ${fieldName}`, { field: fieldName }));
  });
  if (!hasOwn(layoutState, "schemaVersion")) {
    errors.push(createError("unsupported_layout_schema_version", "schemaVersion fehlt.", { field: "schemaVersion" }));
  } else if (layoutState.schemaVersion !== SUPPORTED_LAYOUT_SCHEMA_VERSION) {
    errors.push(createError("unsupported_layout_schema_version", "schemaVersion wird nicht unterstuetzt.", { field: "schemaVersion" }));
  }
  ["targetAppId", "uiScope", "layoutScope", "layoutProfileId"].forEach((fieldName) => {
    if (hasOwn(layoutState, fieldName) && !isNonEmptyString(layoutState[fieldName])) {
      errors.push(createError("invalid_layout_state", `Feld muss ein nicht-leerer String sein: ${fieldName}`, { field: fieldName }));
    }
  });
  if (!hasOwn(layoutState, "version") && !hasOwn(layoutState, "revision")) {
    errors.push(createError("invalid_layout_state", "version oder revision fehlt.", { field: "version" }));
  }
  ["version", "revision"].forEach((fieldName) => {
    if (hasOwn(layoutState, fieldName) && (!Number.isInteger(layoutState[fieldName]) || layoutState[fieldName] < 1)) {
      errors.push(createError("invalid_layout_state", `Feld muss eine positive Ganzzahl sein: ${fieldName}`, { field: fieldName }));
    }
  });
  if (hasOwn(layoutState, "source") && !LAYOUT_STATE_SOURCES.includes(layoutState.source)) {
    errors.push(createError("invalid_layout_state", "source ist nicht erlaubt.", { field: "source" }));
  }
  findForbiddenFields(layoutState, "").forEach((field) => {
    errors.push(createError("invalid_layout_state", `Verbotenes LayoutState-Feld vorhanden: ${field}`, { field }));
  });
  ["elements", "layoutValues"].forEach((containerName) => {
    if (!hasOwn(layoutState, containerName)) return;
    if (!isPlainObject(layoutState[containerName])) {
      errors.push(createError("invalid_layout_state", `${containerName} muss ein Objekt sein.`, { field: containerName }));
      return;
    }
    Object.keys(layoutState[containerName]).forEach((entryKey) => {
      validateNeutralLayoutValue(layoutState[containerName][entryKey], `${containerName}.${entryKey}`, errors, allowedConditionalFields);
    });
  });
  if (hasOwn(layoutState, "changes")) {
    if (!Array.isArray(layoutState.changes)) {
      errors.push(createError("invalid_layout_state", "changes muss eine Liste sein.", { field: "changes" }));
    } else {
      layoutState.changes.forEach((change, index) => validateNeutralLayoutValue(change, `changes[${index}]`, errors, allowedConditionalFields));
    }
  }
  return createResult(errors);
}
function normalizeLayoutState(layoutState) {
  if (!isPlainObject(layoutState)) return {};
  const normalized = {};
  LAYOUT_STATE_FIELDS.forEach((fieldName) => {
    if (hasOwn(layoutState, fieldName)) normalized[fieldName] = cloneValue(layoutState[fieldName]);
  });
  return normalized;
}
function createLayoutState(values) {
  return normalizeLayoutState(values);
}
function getLayoutStateProfileKey(values) {
  if (!isPlainObject(values)) return "";
  return [values.targetAppId, values.uiScope, values.layoutScope, values.layoutProfileId].join("\u001f");
}
function assertCompatibleLayoutProfile(layoutState, selector) {
  const errors = [];
  ["targetAppId", "uiScope", "layoutScope", "layoutProfileId"].forEach((fieldName) => {
    if (hasOwn(selector, fieldName) && layoutState[fieldName] !== selector[fieldName]) {
      errors.push(createError("incompatible_layout_profile", `Layout-Profil passt nicht zu ${fieldName}.`, { field: fieldName }));
    }
  });
  return createResult(errors);
}
module.exports = {
  SUPPORTED_LAYOUT_SCHEMA_VERSION,
  LAYOUT_STATE_REQUIRED_FIELDS,
  LAYOUT_STATE_OPTIONAL_FIELDS,
  LAYOUT_STATE_FIELDS,
  LAYOUT_STATE_SOURCES,
  LAYOUT_STATE_ERROR_CODES,
  LAYOUT_CONTAINER_FIELDS,
  FORBIDDEN_LAYOUT_STATE_FIELDS,
  validateLayoutState,
  normalizeLayoutState,
  createLayoutState,
  getLayoutStateProfileKey,
  assertCompatibleLayoutProfile,
};
