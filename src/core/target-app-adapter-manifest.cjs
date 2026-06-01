"use strict";

const TARGET_APP_ADAPTER_MANIFEST_REQUIRED_FIELDS = Object.freeze([
  "targetAppId",
  "adapterName",
  "adapterVersion",
  "uiScope",
  "layoutProfileId",
  "supportedElementTypes",
  "supportedRoles",
  "supportedOperations",
  "lockedOperations",
  "persistenceMode",
  "executionMode",
  "riskClass",
  "rollbackStrategy",
  "testStrategy",
]);

const TARGET_APP_ADAPTER_MANIFEST_OPTIONAL_FIELDS = Object.freeze([
  "description",
  "manifestVersion",
  "createdAt",
  "updatedAt",
  "notes",
]);

const FORBIDDEN_TARGET_APP_ADAPTER_MANIFEST_FIELDS = Object.freeze([
  "fachDaten",
  "businessData",
  "database",
  "sql",
  "recordId",
  "entity",
  "tableName",
  "save",
  "delete",
  "submit",
  "upload",
  "customer",
  "project",
  "task",
  "statusText",
  "amount",
  "price",
  "personalData",
  "documentData",
  "productiveData",
]);

const TARGET_APP_ADAPTER_MANIFEST_ALLOWED_MODES = Object.freeze({
  persistenceModes: Object.freeze(["none", "memory-only", "layout-state-store"]),
  executionModes: Object.freeze(["disabled", "dry-run", "test-host", "manual-gated"]),
  riskClasses: Object.freeze(["low", "medium", "high", "blocked"]),
});

const STRING_FIELDS = Object.freeze([
  "targetAppId",
  "adapterName",
  "adapterVersion",
  "uiScope",
  "layoutProfileId",
  "persistenceMode",
  "executionMode",
  "riskClass",
  "rollbackStrategy",
  "testStrategy",
]);

const ARRAY_FIELDS = Object.freeze([
  "supportedElementTypes",
  "supportedRoles",
  "supportedOperations",
  "lockedOperations",
]);

function cloneManifestValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneManifestValue(entry));
  }

  if (value && typeof value === "object") {
    const clone = {};
    Object.keys(value).forEach((key) => {
      clone[key] = cloneManifestValue(value[key]);
    });
    return clone;
  }

  return value;
}

function isManifestObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function createManifestError(code, message, field) {
  const error = { code, message };

  if (field !== undefined) {
    error.field = field;
  }

  return error;
}

function getTargetAppAdapterManifestRequiredFields() {
  return TARGET_APP_ADAPTER_MANIFEST_REQUIRED_FIELDS.slice();
}

function getTargetAppAdapterManifestOptionalFields() {
  return TARGET_APP_ADAPTER_MANIFEST_OPTIONAL_FIELDS.slice();
}

function getForbiddenTargetAppAdapterManifestFields() {
  return FORBIDDEN_TARGET_APP_ADAPTER_MANIFEST_FIELDS.slice();
}

function getTargetAppAdapterManifestAllowedModes() {
  return {
    persistenceModes: TARGET_APP_ADAPTER_MANIFEST_ALLOWED_MODES.persistenceModes.slice(),
    executionModes: TARGET_APP_ADAPTER_MANIFEST_ALLOWED_MODES.executionModes.slice(),
    riskClasses: TARGET_APP_ADAPTER_MANIFEST_ALLOWED_MODES.riskClasses.slice(),
  };
}

function getKnownManifestFields() {
  return TARGET_APP_ADAPTER_MANIFEST_REQUIRED_FIELDS.concat(TARGET_APP_ADAPTER_MANIFEST_OPTIONAL_FIELDS);
}

function normalizeTargetAppAdapterManifest(values) {
  if (!isManifestObject(values)) {
    return {};
  }

  const knownFields = getKnownManifestFields();
  const forbiddenFields = new Set(FORBIDDEN_TARGET_APP_ADAPTER_MANIFEST_FIELDS);

  return knownFields.reduce((manifest, field) => {
    if (!forbiddenFields.has(field) && Object.prototype.hasOwnProperty.call(values, field)) {
      manifest[field] = cloneManifestValue(values[field]);
    }
    return manifest;
  }, {});
}

function createTargetAppAdapterManifest(values) {
  return normalizeTargetAppAdapterManifest(values);
}

function validateRequiredFields(manifest, errors) {
  TARGET_APP_ADAPTER_MANIFEST_REQUIRED_FIELDS.forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(manifest, field)) {
      errors.push(createManifestError("missing_required_field", `Pflichtfeld ${field} fehlt.`, field));
    }
  });
}

function validateStringFields(manifest, errors) {
  STRING_FIELDS.forEach((field) => {
    if (
      Object.prototype.hasOwnProperty.call(manifest, field) &&
      (typeof manifest[field] !== "string" || manifest[field].trim() === "")
    ) {
      errors.push(createManifestError("invalid_string_field", `${field} muss eine nicht leere Zeichenkette sein.`, field));
    }
  });
}

function validateArrayFields(manifest, errors) {
  ARRAY_FIELDS.forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(manifest, field)) {
      return;
    }

    if (!Array.isArray(manifest[field])) {
      errors.push(createManifestError("invalid_array_field", `${field} muss ein Array sein.`, field));
      return;
    }

    const hasInvalidEntry = manifest[field].some((entry) => typeof entry !== "string" || entry.trim() === "");
    if (hasInvalidEntry) {
      errors.push(
        createManifestError("invalid_array_field", `${field} darf nur nicht leere Zeichenketten enthalten.`, field)
      );
    }
  });
}

function validateModes(manifest, errors) {
  const allowedModes = TARGET_APP_ADAPTER_MANIFEST_ALLOWED_MODES;
  const modeChecks = [
    ["persistenceMode", allowedModes.persistenceModes],
    ["executionMode", allowedModes.executionModes],
    ["riskClass", allowedModes.riskClasses],
  ];

  modeChecks.forEach(([field, allowedValues]) => {
    if (
      Object.prototype.hasOwnProperty.call(manifest, field) &&
      typeof manifest[field] === "string" &&
      manifest[field].trim() !== "" &&
      !allowedValues.includes(manifest[field])
    ) {
      errors.push(createManifestError("invalid_mode", `${field} ist nicht erlaubt.`, field));
    }
  });
}

function validateForbiddenFields(manifest, errors) {
  FORBIDDEN_TARGET_APP_ADAPTER_MANIFEST_FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(manifest, field)) {
      errors.push(createManifestError("forbidden_field", `${field} ist im Adapter-Manifest nicht erlaubt.`, field));
    }
  });
}

function validateTargetAppAdapterManifest(manifest) {
  const errors = [];

  if (!isManifestObject(manifest)) {
    errors.push(createManifestError("invalid_manifest", "Adapter-Manifest muss ein Objekt sein."));
    return {
      ok: false,
      errors,
    };
  }

  validateForbiddenFields(manifest, errors);
  validateRequiredFields(manifest, errors);
  validateStringFields(manifest, errors);
  validateArrayFields(manifest, errors);
  validateModes(manifest, errors);

  return {
    ok: errors.length === 0,
    errors,
  };
}

module.exports = {
  getTargetAppAdapterManifestRequiredFields,
  getTargetAppAdapterManifestOptionalFields,
  getForbiddenTargetAppAdapterManifestFields,
  getTargetAppAdapterManifestAllowedModes,
  normalizeTargetAppAdapterManifest,
  createTargetAppAdapterManifest,
  validateTargetAppAdapterManifest,
};
