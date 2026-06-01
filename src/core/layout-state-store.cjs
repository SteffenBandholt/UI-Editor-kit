"use strict";

const { normalizeLayoutStateRecord } = require("./layout-state-model.cjs");

const LAYOUT_STATE_FILTER_FIELDS = Object.freeze([
  "layoutProfileId",
  "targetAppId",
  "uiScope",
  "elementId",
]);

function hasOwn(source, key) {
  return Boolean(source) && Object.prototype.hasOwnProperty.call(source, key);
}

function cloneRecord(record) {
  return normalizeLayoutStateRecord(record);
}

function normalizeFilter(filter) {
  if (filter === undefined || filter === null) {
    return {};
  }

  if (typeof filter !== "object" || Array.isArray(filter)) {
    throw new TypeError("Layout-State-Filter muss ein Objekt sein.");
  }

  const filterKeys = Object.keys(filter);
  const unknownFilterKey = filterKeys.find((key) => !LAYOUT_STATE_FILTER_FIELDS.includes(key));
  if (unknownFilterKey) {
    throw new TypeError(`Layout-State-Filter ist nicht erlaubt: ${unknownFilterKey}`);
  }

  const normalized = {};
  LAYOUT_STATE_FILTER_FIELDS.forEach((fieldName) => {
    if (hasOwn(filter, fieldName)) {
      normalized[fieldName] = filter[fieldName];
    }
  });

  return normalized;
}

function matchesFilter(record, filter) {
  return Object.keys(filter).every((fieldName) => record[fieldName] === filter[fieldName]);
}

function createLayoutStateStore() {
  let records = [];

  function saveLayoutStateRecord(record) {
    const normalizedRecord = normalizeLayoutStateRecord(record);
    const storedRecord = cloneRecord(normalizedRecord);
    records.push(storedRecord);
    return cloneRecord(storedRecord);
  }

  function listLayoutStateRecords(filter) {
    const normalizedFilter = normalizeFilter(filter);
    return records
      .filter((record) => matchesFilter(record, normalizedFilter))
      .map((record) => cloneRecord(record));
  }

  function getLatestLayoutStateRecord(filter) {
    const matches = listLayoutStateRecords(filter);
    if (matches.length === 0) {
      return null;
    }

    return cloneRecord(matches[matches.length - 1]);
  }

  function clearLayoutStateRecords() {
    records = [];
  }

  function resetLayoutState(filter) {
    const normalizedFilter = normalizeFilter(filter);
    const beforeCount = records.length;
    records = records.filter((record) => !matchesFilter(record, normalizedFilter));
    return beforeCount - records.length;
  }

  return {
    saveLayoutStateRecord,
    listLayoutStateRecords,
    getLatestLayoutStateRecord,
    clearLayoutStateRecords,
    resetLayoutState,
  };
}

module.exports = {
  LAYOUT_STATE_FILTER_FIELDS,
  createLayoutStateStore,
};
