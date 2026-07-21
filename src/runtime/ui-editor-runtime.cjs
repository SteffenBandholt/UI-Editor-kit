"use strict";

const { RUNTIME_ERROR_CODES } = require("./runtime-error-codes.cjs");
const { okResult, blockedResult } = require("./runtime-result.cjs");
const { validateTargetContext, assertScope } = require("./runtime-context.cjs");
const {
  createSessionState,
  normalizeLayoutEntry,
  normalizeEntries,
  entriesToArray,
} = require("./session-state.cjs");

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function isFn(source, name) {
  return Boolean(source) && typeof source[name] === "function";
}

function parseScoped(args) {
  return args.length === 1
    ? { scopeId: undefined, elementId: args[0] }
    : { scopeId: args[0], elementId: args[1] };
}

function withRollbackInfo(result, rollback) {
  return {
    ...result,
    rollbackComplete: rollback.rollbackComplete,
    rollbackErrors: rollback.rollbackErrors,
    warnings: rollback.rollbackComplete
      ? result.warnings
      : [...(result.warnings || []), RUNTIME_ERROR_CODES.ROLLBACK_FAILED],
  };
}

function failWithRollback(code, reason, rollback) {
  return withRollbackInfo(blockedResult(code, reason), rollback);
}

function callResult(fn, code) {
  try {
    const result = fn();
    if (result && result.ok === false) {
      return blockedResult(code, result.reason || result.message || code, { value: result });
    }
    return okResult(result && Object.prototype.hasOwnProperty.call(result, "value") ? result.value : result);
  } catch (error) {
    return blockedResult(code, error.message || code);
  }
}

function registryList(registry) {
  if (!isFn(registry, "listElements")) return [];
  try {
    return registry.listElements();
  } catch (error) {
    void error;
    return [];
  }
}

function registryGet(registry, id) {
  if (!isFn(registry, "getElementById")) return null;
  try {
    return registry.getElementById(id);
  } catch (error) {
    void error;
    return null;
  }
}

function validateRegistry(registry) {
  if (!registry || !isFn(registry, "getElementById") || !isFn(registry, "listElements")) {
    return blockedResult(
      RUNTIME_ERROR_CODES.INVALID_REGISTRY,
      "registry must provide getElementById and listElements."
    );
  }
  return okResult();
}

function validateHostAdapter(host) {
  const required = [
    "validateElementRef",
    "captureElementLayoutState",
    "applyLayoutEntry",
    "clearElementLayout",
    "restoreElementLayoutState",
    "getCurrentLayoutEntry",
  ];
  const missing = required.filter((methodName) => !isFn(host, methodName));
  if (missing.length > 0) {
    return blockedResult(RUNTIME_ERROR_CODES.INVALID_HOST_ADAPTER, "hostAdapter is missing runtime methods.", {
      value: { missing },
    });
  }
  return okResult();
}

function storageAvailable(storage) {
  if (!storage) return blockedResult(RUNTIME_ERROR_CODES.STORAGE_UNAVAILABLE, "layoutStorage is required.");
  if (storage.available === false) {
    return blockedResult(RUNTIME_ERROR_CODES.STORAGE_UNAVAILABLE, "layoutStorage is not available.");
  }
  return okResult();
}

function storagePersistent(storage) {
  const available = storageAvailable(storage);
  if (!available.ok) return available;
  if (storage.persistent === false) {
    return blockedResult(RUNTIME_ERROR_CODES.STORAGE_NOT_PERSISTENT, "layoutStorage is not persistent.");
  }
  return okResult();
}

function readStorage(storage, context) {
  if (!isFn(storage, "readResult")) {
    return blockedResult(RUNTIME_ERROR_CODES.STORAGE_READ_FAILED, "layoutStorage.readResult is required.");
  }
  const result = callResult(() => storage.readResult(context), RUNTIME_ERROR_CODES.STORAGE_READ_FAILED);
  if (!result.ok) return result;
  const value = result.value && Object.prototype.hasOwnProperty.call(result.value, "entries")
    ? result.value.entries
    : result.value;
  return okResult(entriesToArray(normalizeEntries(value || [])));
}

function verifyStorage(storage, context, expected) {
  const result = readStorage(storage, context);
  if (!result.ok) return result;
  const normalizedExpected = entriesToArray(normalizeEntries(expected));
  if (JSON.stringify(result.value) !== JSON.stringify(normalizedExpected)) {
    return blockedResult(RUNTIME_ERROR_CODES.STORAGE_VERIFY_FAILED, "stored entries did not verify.", {
      value: { expected: normalizedExpected, actual: result.value },
    });
  }
  return okResult(result.value);
}

function writeStorage(storage, context, entries, code) {
  return callResult(() => storage.write(context, clone(entries)), code || RUNTIME_ERROR_CODES.STORAGE_WRITE_FAILED);
}

function validateElement(registry, id) {
  const element = registryGet(registry, id);
  if (!element) return blockedResult(RUNTIME_ERROR_CODES.UNKNOWN_ELEMENT, "unknown element.");
  if (element.editable === false) {
    return blockedResult(RUNTIME_ERROR_CODES.ELEMENT_NOT_EDITABLE, "element is not editable.");
  }
  return okResult(element);
}

function validateApplyOperation(element) {
  const allowedOps = Array.isArray(element.effectiveOps)
    ? element.effectiveOps
    : (Array.isArray(element.allowedOps) ? element.allowedOps : []);
  const lockedOps = Array.isArray(element.lockedOps) ? element.lockedOps : [];
  if (lockedOps.includes("move") && lockedOps.includes("resize")) {
    return blockedResult(RUNTIME_ERROR_CODES.OPERATION_NOT_ALLOWED, "layout apply operations are locked.");
  }
  if (!allowedOps.includes("move") && !allowedOps.includes("resize")) {
    return blockedResult(RUNTIME_ERROR_CODES.OPERATION_NOT_ALLOWED, "no neutral layout apply operation is allowed.");
  }
  return okResult();
}

function operationAllowed(element, operation) {
  const allowedOps = Array.isArray(element.effectiveOps)
    ? element.effectiveOps
    : (Array.isArray(element.allowedOps) ? element.allowedOps : []);
  const lockedOps = Array.isArray(element.lockedOps) ? element.lockedOps : [];
  return !lockedOps.includes(operation) && allowedOps.includes(operation);
}

function captureHostState(host, elementId) {
  return callResult(() => host.captureElementLayoutState(elementId), RUNTIME_ERROR_CODES.HOST_CAPTURE_FAILED);
}

function readHostEntry(host, elementId) {
  return callResult(() => host.getCurrentLayoutEntry(elementId), RUNTIME_ERROR_CODES.HOST_READ_FAILED);
}

function validateHostRef(host, elementId) {
  return callResult(() => host.validateElementRef(elementId), RUNTIME_ERROR_CODES.ELEMENT_REF_MISSING);
}

function restoreHostState(host, elementId, snapshot) {
  return callResult(
    () => host.restoreElementLayoutState(elementId, clone(snapshot)),
    RUNTIME_ERROR_CODES.ROLLBACK_FAILED
  );
}

function restoreHostSnapshots(host, snapshots) {
  const rollbackErrors = [];
  Object.keys(snapshots).forEach((elementId) => {
    const restored = restoreHostState(host, elementId, snapshots[elementId]);
    if (!restored.ok) {
      rollbackErrors.push({ elementId, code: restored.code, reason: restored.reason });
    }
  });
  return { rollbackComplete: rollbackErrors.length === 0, rollbackErrors };
}

function restorePersistent(storage, context, entries) {
  const write = writeStorage(storage, context, entries, RUNTIME_ERROR_CODES.ROLLBACK_FAILED);
  if (!write.ok) {
    return { rollbackComplete: false, rollbackErrors: [{ target: "storage", code: write.code, reason: write.reason }] };
  }
  const verify = verifyStorage(storage, context, entries);
  if (!verify.ok) {
    return { rollbackComplete: false, rollbackErrors: [{ target: "storage", code: verify.code, reason: verify.reason }] };
  }
  return { rollbackComplete: true, rollbackErrors: [] };
}

function mergeRollbackResults(...results) {
  const rollbackErrors = results.flatMap((result) => result.rollbackErrors || []);
  return { rollbackComplete: rollbackErrors.length === 0, rollbackErrors };
}

function createUiEditorRuntime(options) {
  const cfg = options || {};
  const contextResult = validateTargetContext(cfg.targetContext);
  const context = contextResult.ok ? contextResult.value : null;
  const session = createSessionState(cfg.clock);
  const registry = cfg.registry;
  const host = cfg.hostAdapter;
  const storage = cfg.layoutStorage;

  function preflight(scopeId, needActive) {
    if (!contextResult.ok) return contextResult;
    const scope = assertScope(context, scopeId);
    if (!scope.ok) return scope;
    const registryResult = validateRegistry(registry);
    if (!registryResult.ok) return registryResult;
    const hostResult = validateHostAdapter(host);
    if (!hostResult.ok) return hostResult;
    if (needActive && !session.isActive()) {
      return blockedResult(RUNTIME_ERROR_CODES.SESSION_NOT_ACTIVE, "session is not active.");
    }
    return okResult();
  }

  function status(scopeId) {
    const preflightResult = preflight(scopeId, false);
    return preflightResult.ok ? session.status() : preflightResult;
  }

  function beginSession(scopeId) {
    const preflightResult = preflight(scopeId, false);
    if (!preflightResult.ok) return preflightResult;
    if (session.isActive()) {
      return okResult(undefined, {
        code: RUNTIME_ERROR_CODES.ALREADY_ACTIVE,
        status: session.status(),
        warnings: [RUNTIME_ERROR_CODES.ALREADY_ACTIVE],
      });
    }

    const entries = [];
    for (const element of registryList(registry)) {
      const current = readHostEntry(host, element.id);
      if (!current.ok) return current;
      const normalized = normalizeLayoutEntry(current.value);
      if (normalized) entries.push(normalized);
    }

    return okResult(undefined, { status: session.begin(entries) });
  }

  function applyEntryToHost(entry) {
    const ref = validateHostRef(host, entry.elementId);
    if (!ref.ok) return ref;
    return callResult(() => host.applyLayoutEntry(entry.elementId, entry), RUNTIME_ERROR_CODES.HOST_APPLY_FAILED);
  }

  function clearEntryFromHost(elementId, registryElement) {
    const ref = validateHostRef(host, elementId);
    if (!ref.ok) return ref;
    return callResult(() => host.clearElementLayout(elementId, registryElement), RUNTIME_ERROR_CODES.HOST_CLEAR_FAILED);
  }

  function applyChange(changeRequest) {
    const preflightResult = preflight(changeRequest && changeRequest.scope, false);
    if (!preflightResult.ok) return preflightResult;
    if (!session.isActive()) {
      return blockedResult(RUNTIME_ERROR_CODES.SESSION_NOT_ACTIVE, "session is not active.");
    }
    if (!changeRequest || typeof changeRequest !== "object") {
      return blockedResult(RUNTIME_ERROR_CODES.INVALID_LAYOUT_ENTRY, "changeRequest must be an object.");
    }

    const elementResult = validateElement(registry, changeRequest.elementId);
    if (!elementResult.ok) return elementResult;
    if (!["move", "resize"].includes(changeRequest.operation) || !operationAllowed(elementResult.value, changeRequest.operation)) {
      return blockedResult(RUNTIME_ERROR_CODES.OPERATION_NOT_ALLOWED, "operation is not allowed.");
    }

    const entry = normalizeLayoutEntry({ elementId: changeRequest.elementId, ...(changeRequest.payload || {}) });
    if (!entry) {
      return blockedResult(RUNTIME_ERROR_CODES.INVALID_LAYOUT_ENTRY, "changeRequest payload contains no neutral layout entry.");
    }

    const snapshot = captureHostState(host, changeRequest.elementId);
    if (!snapshot.ok) return snapshot;
    const oldSessionEntries = session.getSessionEntries();
    const applied = callResult(
      () => host.applyLayoutEntry(changeRequest.elementId, entry),
      RUNTIME_ERROR_CODES.HOST_APPLY_FAILED
    );
    if (!applied.ok) {
      session.setSessionEntries(oldSessionEntries);
      return withRollbackInfo(applied, restoreHostSnapshots(host, { [changeRequest.elementId]: snapshot.value }));
    }

    const current = readHostEntry(host, changeRequest.elementId);
    if (!current.ok) {
      session.setSessionEntries(oldSessionEntries);
      return withRollbackInfo(current, restoreHostSnapshots(host, { [changeRequest.elementId]: snapshot.value }));
    }
    session.setEntry(normalizeLayoutEntry(current.value) || entry);
    return okResult(entry, { status: session.status() });
  }

  function discardElementChanges() {
    const { scopeId, elementId } = parseScoped(arguments);
    const preflightResult = preflight(scopeId, true);
    if (!preflightResult.ok) return preflightResult;
    const elementResult = validateElement(registry, elementId);
    if (!elementResult.ok) return elementResult;
    const baseline = normalizeEntries(session.getBaselineEntries()).get(elementId);
    const snapshot = captureHostState(host, elementId);
    if (!snapshot.ok) return snapshot;
    const oldSessionEntries = session.getSessionEntries();
    const applied = baseline ? applyEntryToHost(baseline) : clearEntryFromHost(elementId, elementResult.value);
    if (!applied.ok) {
      session.setSessionEntries(oldSessionEntries);
      return withRollbackInfo(applied, restoreHostSnapshots(host, { [elementId]: snapshot.value }));
    }
    if (baseline) session.setEntry(baseline);
    else session.removeEntry(elementId);
    return okResult(undefined, { status: session.status() });
  }

  function discardAllChanges(scopeId) {
    const preflightResult = preflight(scopeId, true);
    if (!preflightResult.ok) return preflightResult;
    const oldSessionEntries = session.getSessionEntries();
    const baselineEntries = session.getBaselineEntries();
    const baselineById = normalizeEntries(baselineEntries);
    const editableElements = registryList(registry).filter((element) => element.editable !== false);
    const snapshots = {};

    for (const element of editableElements) {
      const snapshot = captureHostState(host, element.id);
      if (!snapshot.ok) return snapshot;
      snapshots[element.id] = snapshot.value;
    }

    for (const element of editableElements) {
      const entry = baselineById.get(element.id);
      const applied = entry ? applyEntryToHost(entry) : clearEntryFromHost(element.id, element);
      if (!applied.ok) {
        session.setSessionEntries(oldSessionEntries);
        return withRollbackInfo(applied, restoreHostSnapshots(host, snapshots));
      }
    }

    session.setSessionEntries(baselineEntries);
    return okResult(undefined, { status: session.status() });
  }

  function resetSessionBaseline(scopeId) {
    const preflightResult = preflight(scopeId, true);
    if (!preflightResult.ok) return preflightResult;
    return okResult(undefined, { status: session.resetBaselineToSession() });
  }

  function resetSessionBaselineElement() {
    const { scopeId, elementId } = parseScoped(arguments);
    const preflightResult = preflight(scopeId, true);
    if (!preflightResult.ok) return preflightResult;
    const elementResult = validateElement(registry, elementId);
    if (!elementResult.ok) return elementResult;
    return okResult(undefined, { status: session.resetBaselineElement(elementId) });
  }

  function saveLayout(scopeId) {
    const preflightResult = preflight(scopeId, true);
    if (!preflightResult.ok) return preflightResult;
    const persistent = storagePersistent(storage);
    if (!persistent.ok) return persistent;

    const oldPersistent = readStorage(storage, context);
    if (!oldPersistent.ok) return oldPersistent;
    const oldSessionEntries = session.getSessionEntries();
    const oldBaselineEntries = session.getBaselineEntries();
    const entries = session.getSessionEntries();

    const written = writeStorage(storage, context, entries);
    if (!written.ok) return written;
    const verified = verifyStorage(storage, context, entries);
    if (!verified.ok) {
      session.setSessionEntries(oldSessionEntries);
      session.setBaselineEntries(oldBaselineEntries);
      return withRollbackInfo(verified, restorePersistent(storage, context, oldPersistent.value));
    }

    session.resetBaselineToSession();
    return okResult(entries, { status: session.status() });
  }

  function validateLoadedEntries(entries) {
    const normalizedEntries = [];
    const seen = new Set();
    for (const rawEntry of entries) {
      const entry = normalizeLayoutEntry(rawEntry);
      if (!entry) return blockedResult(RUNTIME_ERROR_CODES.INVALID_LAYOUT_ENTRY, "loaded layout entry is invalid.");
      if (seen.has(entry.elementId)) {
        return blockedResult(RUNTIME_ERROR_CODES.INVALID_LAYOUT_ENTRY, "loaded layout entries contain duplicate elementId.");
      }
      seen.add(entry.elementId);
      const element = validateElement(registry, entry.elementId);
      if (!element.ok) return element;
      const operation = validateApplyOperation(element.value);
      if (!operation.ok) return operation;
      const ref = validateHostRef(host, entry.elementId);
      if (!ref.ok) return ref;
      normalizedEntries.push(entry);
    }
    return okResult(normalizedEntries);
  }

  function loadLayout(scopeId) {
    const preflightResult = preflight(scopeId, false);
    if (!preflightResult.ok) return preflightResult;
    const available = storageAvailable(storage);
    if (!available.ok) return available;
    const read = readStorage(storage, context);
    if (!read.ok) return read;
    const validated = validateLoadedEntries(read.value);
    if (!validated.ok) return validated;

    const oldSessionEntries = session.getSessionEntries();
    const oldBaselineEntries = session.getBaselineEntries();
    const loadedEntries = validated.value;
    const loadedById = normalizeEntries(loadedEntries);
    const previousIds = new Set([...normalizeEntries(oldSessionEntries).keys(), ...normalizeEntries(oldBaselineEntries).keys()]);
    const affectedIds = new Set([...loadedById.keys(), ...previousIds]);
    const editableById = new Map(registryList(registry).filter((element) => element.editable !== false).map((element) => [element.id, element]));
    const snapshots = {};

    for (const elementId of affectedIds) {
      const element = editableById.get(elementId);
      if (!element) continue;
      const snapshot = captureHostState(host, elementId);
      if (!snapshot.ok) return snapshot;
      snapshots[elementId] = snapshot.value;
    }

    for (const entry of loadedEntries) {
      const applied = applyEntryToHost(entry);
      if (!applied.ok) {
        session.setSessionEntries(oldSessionEntries);
        session.setBaselineEntries(oldBaselineEntries);
        return withRollbackInfo(applied, restoreHostSnapshots(host, snapshots));
      }
    }

    for (const [elementId, element] of editableById.entries()) {
      if (!affectedIds.has(elementId) || loadedById.has(elementId)) continue;
      const cleared = clearEntryFromHost(elementId, element);
      if (!cleared.ok) {
        session.setSessionEntries(oldSessionEntries);
        session.setBaselineEntries(oldBaselineEntries);
        return withRollbackInfo(cleared, restoreHostSnapshots(host, snapshots));
      }
    }

    if (!session.isActive()) session.begin(oldSessionEntries);
    session.setSessionEntries(loadedEntries);
    session.setBaselineEntries(loadedEntries);
    return okResult(loadedEntries, { status: session.status() });
  }

  function resetLayoutToDefaults(scopeId) {
    const preflightResult = preflight(scopeId, true);
    if (!preflightResult.ok) return preflightResult;
    const persistent = storagePersistent(storage);
    if (!persistent.ok) return persistent;
    const oldPersistent = readStorage(storage, context);
    if (!oldPersistent.ok) return oldPersistent;
    const oldSessionEntries = session.getSessionEntries();
    const oldBaselineEntries = session.getBaselineEntries();
    const editableElements = registryList(registry).filter((element) => element.editable !== false);
    const snapshots = {};

    function rollbackFrom(errorResult) {
      session.setSessionEntries(oldSessionEntries);
      session.setBaselineEntries(oldBaselineEntries);
      const hostRollback = restoreHostSnapshots(host, snapshots);
      const persistentRollback = restorePersistent(storage, context, oldPersistent.value);
      return withRollbackInfo(errorResult, mergeRollbackResults(hostRollback, persistentRollback));
    }

    for (const element of editableElements) {
      const snapshot = captureHostState(host, element.id);
      if (!snapshot.ok) return rollbackFrom(snapshot);
      snapshots[element.id] = snapshot.value;
      const cleared = clearEntryFromHost(element.id, element);
      if (!cleared.ok) return rollbackFrom(cleared);
    }

    const clearedStorage = callResult(() => storage.clear(context), RUNTIME_ERROR_CODES.STORAGE_CLEAR_FAILED);
    if (!clearedStorage.ok) return rollbackFrom(clearedStorage);
    const verified = verifyStorage(storage, context, []);
    if (!verified.ok) return rollbackFrom(verified);

    session.setSessionEntries([]);
    session.setBaselineEntries([]);
    return okResult([], { status: session.status() });
  }

  function resetElementToDefaults() {
    const { scopeId, elementId } = parseScoped(arguments);
    const preflightResult = preflight(scopeId, true);
    if (!preflightResult.ok) return preflightResult;
    const elementResult = validateElement(registry, elementId);
    if (!elementResult.ok) return elementResult;
    const persistent = storagePersistent(storage);
    if (!persistent.ok) return persistent;
    const oldPersistent = readStorage(storage, context);
    if (!oldPersistent.ok) return oldPersistent;
    const oldSessionEntries = session.getSessionEntries();
    const oldBaselineEntries = session.getBaselineEntries();
    const snapshot = captureHostState(host, elementId);
    if (!snapshot.ok) return snapshot;

    function rollbackFrom(errorResult) {
      session.setSessionEntries(oldSessionEntries);
      session.setBaselineEntries(oldBaselineEntries);
      const hostRollback = restoreHostSnapshots(host, { [elementId]: snapshot.value });
      const persistentRollback = restorePersistent(storage, context, oldPersistent.value);
      return withRollbackInfo(errorResult, mergeRollbackResults(hostRollback, persistentRollback));
    }

    const cleared = clearEntryFromHost(elementId, elementResult.value);
    if (!cleared.ok) return rollbackFrom(cleared);
    session.removeEntry(elementId);
    session.resetBaselineElement(elementId);

    const written = isFn(storage, "deleteEntry")
      ? callResult(() => storage.deleteEntry(context, elementId), RUNTIME_ERROR_CODES.STORAGE_WRITE_FAILED)
      : writeStorage(storage, context, oldPersistent.value.filter((entry) => entry.elementId !== elementId));
    if (!written.ok) return rollbackFrom(written);

    const verified = readStorage(storage, context);
    if (!verified.ok) return rollbackFrom(verified);
    if (verified.value.some((entry) => entry.elementId === elementId)) {
      return rollbackFrom(blockedResult(RUNTIME_ERROR_CODES.STORAGE_VERIFY_FAILED, "element entry was not removed."));
    }

    return okResult(undefined, { status: session.status() });
  }

  function reapplyCurrentLayoutState(scopeId) {
    const preflightResult = preflight(scopeId, true);
    if (!preflightResult.ok) return preflightResult;
    if (isFn(host, "reapplyLayoutEntries")) {
      const reapplied = callResult(
        () => host.reapplyLayoutEntries(session.getSessionEntries()),
        RUNTIME_ERROR_CODES.HOST_APPLY_FAILED
      );
      if (!reapplied.ok) return reapplied;
    } else {
      for (const entry of session.getSessionEntries()) {
        const applied = applyEntryToHost(entry);
        if (!applied.ok) return applied;
      }
    }
    return okResult(undefined, { status: session.status() });
  }

  function endSession(scopeId) {
    const preflightResult = preflight(scopeId, true);
    if (!preflightResult.ok) return preflightResult;
    return okResult(undefined, { status: session.end() });
  }

  return {
    beginSession,
    getSessionStatus: status,
    applyChange,
    discardElementChanges,
    discardAllChanges,
    resetSessionBaseline,
    resetSessionBaselineElement,
    saveLayout,
    loadLayout,
    resetLayoutToDefaults,
    resetElementToDefaults,
    reapplyCurrentLayoutState,
    endSession,
  };
}

module.exports = { createUiEditorRuntime };
