"use strict";

const { BROWSER_ERROR_CODES, ok, blocked, isValidElementId } = require("./browser-result.cjs");

const SCHEMA_VERSION = 1;
const CONTEXT_KEYS = ["targetAppId", "moduleId", "scopeId", "layoutProfileId"];

function validContext(context) {
  return context && CONTEXT_KEYS.every((key) => typeof context[key] === "string" && context[key].trim().length > 0);
}

function sameContext(a, b) {
  return validContext(a) && validContext(b) && CONTEXT_KEYS.every((key) => a[key] === b[key]);
}

function containsDomRef(value, seen) {
  if (!value || typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (typeof value.getBoundingClientRect === "function" || (value.style && typeof value.style === "object")) return true;
  return Object.keys(value).some((key) => containsDomRef(value[key], seen));
}

function cloneJsonEntries(entries) {
  if (!Array.isArray(entries)) return null;
  if (entries.some((entry) => containsDomRef(entry, new Set()))) return null;
  try {
    return JSON.parse(JSON.stringify(entries));
  } catch (_error) {
    return null;
  }
}

function createBrowserLayoutStorage(options) {
  const cfg = options || {};
  const storage = cfg.storage;
  const namespace = cfg.namespace || "ui-editor-layout";
  const clock = cfg.clock || (() => new Date().toISOString());

  function available() {
    return !!(
      storage &&
      typeof storage.getItem === "function" &&
      typeof storage.setItem === "function" &&
      typeof storage.removeItem === "function"
    );
  }

  function validateStorage() {
    return available() ? ok() : blocked(BROWSER_ERROR_CODES.STORAGE_UNAVAILABLE, "storage unavailable");
  }

  function validateContext(context) {
    return validContext(context) ? ok() : blocked("INVALID_TARGET_CONTEXT", "invalid context");
  }

  function key(context) {
    return `${namespace}::${context.targetAppId}::${context.moduleId}::${context.scopeId}::${context.layoutProfileId}`;
  }

  function readResult(context) {
    const storageResult = validateStorage();
    if (!storageResult.ok) return storageResult;
    const contextResult = validateContext(context);
    if (!contextResult.ok) return contextResult;
    let raw;
    try {
      raw = storage.getItem(key(context));
    } catch (error) {
      return blocked(BROWSER_ERROR_CODES.STORAGE_READ_FAILED, error.message || "read failed");
    }
    if (raw == null) return ok({ schemaVersion: SCHEMA_VERSION, context, entries: [], savedAt: null });
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      return blocked(BROWSER_ERROR_CODES.STORAGE_PARSE_FAILED, error.message || "parse failed");
    }
    if (parsed.schemaVersion !== SCHEMA_VERSION) {
      return blocked(BROWSER_ERROR_CODES.STORAGE_SCHEMA_UNSUPPORTED, "unsupported schemaVersion");
    }
    if (!sameContext(parsed.context, context) || !Array.isArray(parsed.entries)) {
      return blocked(BROWSER_ERROR_CODES.STORAGE_READ_FAILED, "stored payload does not match context/schema");
    }
    return ok(parsed);
  }

  function write(context, entries) {
    const storageResult = validateStorage();
    if (!storageResult.ok) return storageResult;
    const contextResult = validateContext(context);
    if (!contextResult.ok) return contextResult;
    const jsonEntries = cloneJsonEntries(entries);
    if (!jsonEntries) return blocked(BROWSER_ERROR_CODES.STORAGE_WRITE_FAILED, "entries must be JSON data without DOM refs");
    const payload = { schemaVersion: SCHEMA_VERSION, context: { ...context }, entries: jsonEntries, savedAt: clock() };
    try {
      storage.setItem(key(context), JSON.stringify(payload));
      return ok(payload);
    } catch (error) {
      return blocked(BROWSER_ERROR_CODES.STORAGE_WRITE_FAILED, error.message || "write failed");
    }
  }

  function clear(context) {
    const storageResult = validateStorage();
    if (!storageResult.ok) return storageResult;
    const contextResult = validateContext(context);
    if (!contextResult.ok) return contextResult;
    try {
      storage.removeItem(key(context));
      return ok();
    } catch (error) {
      return blocked(BROWSER_ERROR_CODES.STORAGE_CLEAR_FAILED, error.message || "clear failed");
    }
  }

  function deleteEntry(context, elementId) {
    const contextResult = validateContext(context);
    if (!contextResult.ok) return contextResult;
    if (!isValidElementId(elementId)) return blocked(BROWSER_ERROR_CODES.INVALID_ELEMENT_ID, "invalid elementId");
    const read = readResult(context);
    if (!read.ok) return read;
    const nextEntries = read.value.entries.filter((entry) => !entry || entry.elementId !== elementId);
    if (nextEntries.length === read.value.entries.length) return ok(read.value, { deleted: false });
    const written = write(context, nextEntries);
    return written.ok ? ok(written.value, { deleted: true }) : written;
  }

  return {
    available: available(),
    persistent: available(),
    getKey: key,
    readResult,
    write,
    clear,
    deleteEntry,
  };
}

module.exports = { createBrowserLayoutStorage };
