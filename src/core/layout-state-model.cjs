"use strict";

const LAYOUT_STATE_REQUIRED_FIELDS = Object.freeze([
  "layoutProfileId",
  "targetAppId",
  "uiScope",
  "elementId",
  "changeId",
  "operation",
  "layoutValue",
  "version",
  "createdAt",
  "updatedAt",
]);

const LAYOUT_STATE_OPTIONAL_FIELDS = Object.freeze([
  "source",
  "note",
  "previousVersion",
  "appliedBy",
]);

const LAYOUT_STATE_FIELDS = Object.freeze([
  ...LAYOUT_STATE_REQUIRED_FIELDS,
  ...LAYOUT_STATE_OPTIONAL_FIELDS,
]);

const FORBIDDEN_LAYOUT_STATE_FIELDS = Object.freeze([
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
]);

function hasOwn(source, key) {
  return Boolean(source) && Object.prototype.hasOwnProperty.call(source, key);
}

function cloneLayoutValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneLayoutValue(entry));
  }

  if (value && typeof value === "object") {
    const clone = {};
    Object.keys(value).forEach((key) => {
      if (FORBIDDEN_LAYOUT_STATE_FIELDS.includes(key)) {
        return;
      }

      clone[key] = cloneLayoutValue(value[key]);
    });
    return clone;
  }

  return value;
}

function normalizeLayoutStateRecord(values) {
  if (!values || typeof values !== "object" || Array.isArray(values)) {
    return {};
  }

  const normalized = {};

  LAYOUT_STATE_FIELDS.forEach((fieldName) => {
    if (!hasOwn(values, fieldName)) {
      return;
    }

    normalized[fieldName] = cloneLayoutValue(values[fieldName]);
  });

  return normalized;
}

function createLayoutStateRecord(values) {
  return normalizeLayoutStateRecord(values);
}

function getLayoutStateFields() {
  return {
    required: LAYOUT_STATE_REQUIRED_FIELDS.slice(),
    optional: LAYOUT_STATE_OPTIONAL_FIELDS.slice(),
  };
}

function getForbiddenLayoutStateFields() {
  return FORBIDDEN_LAYOUT_STATE_FIELDS.slice();
}

module.exports = {
  LAYOUT_STATE_REQUIRED_FIELDS,
  LAYOUT_STATE_OPTIONAL_FIELDS,
  LAYOUT_STATE_FIELDS,
  FORBIDDEN_LAYOUT_STATE_FIELDS,
  normalizeLayoutStateRecord,
  createLayoutStateRecord,
  getLayoutStateFields,
  getForbiddenLayoutStateFields,
};
