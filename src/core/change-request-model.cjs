"use strict";

const CHANGE_REQUEST_REQUIRED_FIELDS = Object.freeze([
  "changeId",
  "elementId",
  "operation",
  "payload",
  "createdAt",
  "source",
]);

const CHANGE_REQUEST_OPTIONAL_FIELDS = Object.freeze([
  "note",
  "reason",
  "scope",
  "requestedBy",
]);

const CHANGE_REQUEST_FIELDS = Object.freeze([
  ...CHANGE_REQUEST_REQUIRED_FIELDS,
  ...CHANGE_REQUEST_OPTIONAL_FIELDS,
]);

const FORBIDDEN_CHANGE_REQUEST_FIELDS = Object.freeze([
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
]);

function hasOwn(source, key) {
  return Boolean(source) && Object.prototype.hasOwnProperty.call(source, key);
}

function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneValue(entry));
  }

  if (value && typeof value === "object") {
    const clone = {};
    Object.keys(value).forEach((key) => {
      if (FORBIDDEN_CHANGE_REQUEST_FIELDS.includes(key)) {
        return;
      }

      clone[key] = cloneValue(value[key]);
    });
    return clone;
  }

  return value;
}

function normalizeChangeRequest(values) {
  if (!values || typeof values !== "object" || Array.isArray(values)) {
    return {};
  }

  const normalized = {};

  CHANGE_REQUEST_FIELDS.forEach((fieldName) => {
    if (!hasOwn(values, fieldName)) {
      return;
    }

    normalized[fieldName] = cloneValue(values[fieldName]);
  });

  return normalized;
}

function createChangeRequest(values) {
  return normalizeChangeRequest(values);
}

function getChangeRequestFields() {
  return {
    required: CHANGE_REQUEST_REQUIRED_FIELDS.slice(),
    optional: CHANGE_REQUEST_OPTIONAL_FIELDS.slice(),
  };
}

function getForbiddenChangeRequestFields() {
  return FORBIDDEN_CHANGE_REQUEST_FIELDS.slice();
}

module.exports = {
  CHANGE_REQUEST_REQUIRED_FIELDS,
  CHANGE_REQUEST_OPTIONAL_FIELDS,
  CHANGE_REQUEST_FIELDS,
  FORBIDDEN_CHANGE_REQUEST_FIELDS,
  normalizeChangeRequest,
  createChangeRequest,
  getChangeRequestFields,
  getForbiddenChangeRequestFields,
};
