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

function registryListResult(registry) {
  if (!isFn(registry, "listElements")) {
    return blockedResult(RUNTIME_ERROR_CODES.INVALID_REGISTRY, "registry.listElements is required.");
  }
  return callResult(() => registry.listElements(), RUNTIME_ERROR_CODES.REGISTRY_READ_FAILED);
}

function registryGetResult(registry, id) {
  if (!isFn(registry, "getElementById")) {
    return blockedResult(RUNTIME_ERROR_CODES.INVALID_REGISTRY, "registry.getElementById is required.");
  }
  return callResult(() => registry.getElementById(id), RUNTIME_ERROR_CODES.REGISTRY_READ_FAILED);
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
  const result = registryGetResult(registry, id);
  if (!result.ok) return result;
  const element = result.value;
  if (!element) return blockedResult(RUNTIME_ERROR_CODES.UNKNOWN_ELEMENT, "unknown element.");
  if (element.editable === false) {
    return blockedResult(RUNTIME_ERROR_CODES.ELEMENT_NOT_EDITABLE, "element is not editable.");
  }
  return okResult(element);
}

function getAllowedOps(element) {
  return Array.isArray(element.effectiveOps)
    ? element.effectiveOps
    : (Array.isArray(element.allowedOps) ? element.allowedOps : []);
}

function isOperationAllowed(element, operation) {
  const lockedOps = Array.isArray(element.lockedOps) ? element.lockedOps : [];
  return !lockedOps.includes(operation) && getAllowedOps(element).includes(operation);
}

function validateLayoutEntryForElement(entry, registryElement) {
  const normalized = normalizeLayoutEntry(entry);
  if (!normalized) {
    return blockedResult(RUNTIME_ERROR_CODES.INVALID_LAYOUT_ENTRY, "layout entry is invalid or empty.");
  }
  if (normalized.elementId !== registryElement.id) {
    return blockedResult(RUNTIME_ERROR_CODES.INVALID_LAYOUT_ENTRY, "layout entry elementId does not match registry element.");
  }
  if ((Object.prototype.hasOwnProperty.call(normalized, "x") || Object.prototype.hasOwnProperty.call(normalized, "y")) && !isOperationAllowed(registryElement, "move")) {
    return blockedResult(RUNTIME_ERROR_CODES.OPERATION_NOT_ALLOWED, "layout entry requires move operation.");
  }
  if ((Object.prototype.hasOwnProperty.call(normalized, "width") || Object.prototype.hasOwnProperty.call(normalized, "height")) && !isOperationAllowed(registryElement, "resize")) {
    return blockedResult(RUNTIME_ERROR_CODES.OPERATION_NOT_ALLOWED, "layout entry requires resize operation.");
  }
  if ((Object.prototype.hasOwnProperty.call(normalized, "textOffsetX") || Object.prototype.hasOwnProperty.call(normalized, "textOffsetY")) && !isOperationAllowed(registryElement, "textMove")) {
    return blockedResult(RUNTIME_ERROR_CODES.OPERATION_NOT_ALLOWED, "layout entry requires textMove operation.");
  }
  if (Object.prototype.hasOwnProperty.call(normalized, "fontSize") && !isOperationAllowed(registryElement, "fontSize")) {
    return blockedResult(RUNTIME_ERROR_CODES.OPERATION_NOT_ALLOWED, "layout entry requires fontSize operation.");
  }
  if (Object.prototype.hasOwnProperty.call(normalized, "visible")) {
    const visibilityOperation = normalized.visible === false ? "hide" : "show";
    if (!isOperationAllowed(registryElement, visibilityOperation)) {
      return blockedResult(RUNTIME_ERROR_CODES.OPERATION_NOT_ALLOWED, `layout entry requires ${visibilityOperation} operation.`);
    }
  }
  return okResult(normalized);
}

function operationAllowed(element, operation) {
  return isOperationAllowed(element, operation);
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


  function listRegistryElements() {
    const listed = registryListResult(registry);
    if (!listed.ok) return listed;
    if (!Array.isArray(listed.value)) {
      return blockedResult(RUNTIME_ERROR_CODES.INVALID_REGISTRY, "registry.listElements must return an array.");
    }
    return okResult(listed.value);
  }

  function validateEntryForHost(entry) {
    const elementResult = validateElement(registry, entry && entry.elementId);
    if (!elementResult.ok) return elementResult;
    const entryResult = validateLayoutEntryForElement(entry, elementResult.value);
    if (!entryResult.ok) return entryResult;
    const ref = validateHostRef(host, entryResult.value.elementId);
    if (!ref.ok) return ref;
    return okResult({ entry: entryResult.value, element: elementResult.value });
  }

  function validateEntriesForHost(entries) {
    const validatedEntries = [];
    const seen = new Set();
    for (const rawEntry of entries) {
      const normalized = normalizeLayoutEntry(rawEntry);
      if (!normalized) return blockedResult(RUNTIME_ERROR_CODES.INVALID_LAYOUT_ENTRY, "layout entry is invalid or empty.");
      if (seen.has(normalized.elementId)) {
        return blockedResult(RUNTIME_ERROR_CODES.INVALID_LAYOUT_ENTRY, "layout entries contain duplicate elementId.");
      }
      seen.add(normalized.elementId);
      const validated = validateEntryForHost(normalized);
      if (!validated.ok) return validated;
      validatedEntries.push(validated.value.entry);
    }
    return okResult(validatedEntries);
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

    const listed = listRegistryElements();
    if (!listed.ok) return listed;
    const entries = [];
    for (const element of listed.value) {
      const current = readHostEntry(host, element.id);
      if (!current.ok) return current;
      const normalized = normalizeLayoutEntry(current.value);
      if (normalized) {
        const entryResult = validateLayoutEntryForElement(normalized, element);
        if (!entryResult.ok) return entryResult;
        entries.push(entryResult.value);
      }
    }

    return okResult(undefined, { status: session.begin(entries) });
  }

  function applyEntryToHost(entry) {
    const validated = validateEntryForHost(entry);
    if (!validated.ok) return validated;
    return callResult(() => host.applyLayoutEntry(validated.value.entry.elementId, validated.value.entry), RUNTIME_ERROR_CODES.HOST_APPLY_FAILED);
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
    if (!["move", "resize", "textMove", "fontSize"].includes(changeRequest.operation) || !operationAllowed(elementResult.value, changeRequest.operation)) {
      return blockedResult(RUNTIME_ERROR_CODES.OPERATION_NOT_ALLOWED, "operation is not allowed.");
    }

    const entry = normalizeLayoutEntry({ elementId: changeRequest.elementId, ...(changeRequest.payload || {}) });
    if (!entry) {
      return blockedResult(RUNTIME_ERROR_CODES.INVALID_LAYOUT_ENTRY, "changeRequest payload contains no neutral layout entry.");
    }
    const entryValidation = validateLayoutEntryForElement(entry, elementResult.value);
    if (!entryValidation.ok) return entryValidation;

    const snapshot = captureHostState(host, changeRequest.elementId);
    if (!snapshot.ok) return snapshot;
    const oldSessionEntries = session.getSessionEntries();
    const applied = callResult(
      () => host.applyLayoutEntry(changeRequest.elementId, entryValidation.value),
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
    const currentEntry = normalizeLayoutEntry(current.value) || entryValidation.value;
    const currentValidation = validateLayoutEntryForElement(currentEntry, elementResult.value);
    if (!currentValidation.ok) {
      session.setSessionEntries(oldSessionEntries);
      return withRollbackInfo(currentValidation, restoreHostSnapshots(host, { [changeRequest.elementId]: snapshot.value }));
    }
    session.setEntry(currentValidation.value);
    return okResult(currentValidation.value, { status: session.status() });
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
    const listed = listRegistryElements();
    if (!listed.ok) return listed;
    const editableElements = listed.value.filter((element) => element.editable !== false);
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

    const oldSessionEntries = session.getSessionEntries();
    const oldBaselineEntries = session.getBaselineEntries();
    const validatedEntries = validateEntriesForHost(oldSessionEntries);
    if (!validatedEntries.ok) return validatedEntries;
    const oldPersistent = readStorage(storage, context);
    if (!oldPersistent.ok) return oldPersistent;
    const entries = validatedEntries.value;

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
      const validated = validateEntryForHost(entry);
      if (!validated.ok) return validated;
      normalizedEntries.push(validated.value.entry);
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
    const listed = listRegistryElements();
    if (!listed.ok) return listed;
    const editableById = new Map(listed.value.filter((element) => element.editable !== false).map((element) => [element.id, element]));
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
    const listed = listRegistryElements();
    if (!listed.ok) return listed;
    const editableElements = listed.value.filter((element) => element.editable !== false);
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

  function getPersistenceStatus() {
    const available = storageAvailable(storage);
    return {
      available: available.ok,
      persistent: available.ok && storagePersistent(storage).ok,
      code: available.ok ? (storagePersistent(storage).ok ? "PERSISTENT" : RUNTIME_ERROR_CODES.STORAGE_NOT_PERSISTENT) : available.code,
    };
  }

  function inspectElement() {
    const { scopeId, elementId } = parseScoped(arguments);
    const preflightResult = preflight(scopeId, false);
    if (!preflightResult.ok) return preflightResult;
    const elementResult = registryGetResult(registry, elementId);
    if (!elementResult.ok) return elementResult;
    const element = elementResult.value;
    if (!element) return blockedResult(RUNTIME_ERROR_CODES.UNKNOWN_ELEMENT, "unknown element.");
    const current = readHostEntry(host, elementId);
    if (!current.ok) return current;
    const sessionEntries = normalizeEntries(session.getSessionEntries());
    const baselineEntries = normalizeEntries(session.getBaselineEntries());
    const currentEntry = normalizeLayoutEntry(current.value) || sessionEntries.get(elementId) || { elementId };
    const effectiveLayout = clone(current.value) || clone(currentEntry);
    const baselineEntry = baselineEntries.get(elementId) || null;
    const allowedOps = Array.isArray(element.allowedOps) ? element.allowedOps.slice() : [];
    const lockedOps = Array.isArray(element.lockedOps) ? element.lockedOps : [];
    const effectiveOps = (Array.isArray(element.effectiveOps) ? element.effectiveOps : allowedOps).filter((op) => !lockedOps.includes(op));
    return okResult(undefined, { elementId, currentEntry, effectiveLayout, baselineEntry, changed: JSON.stringify(currentEntry || null) !== JSON.stringify(baselineEntry || null), allowedOps, effectiveOps });
  }

  function reapplyCurrentLayoutState(scopeId) {
    const preflightResult = preflight(scopeId, true);
    if (!preflightResult.ok) return preflightResult;
    const validatedEntries = validateEntriesForHost(session.getSessionEntries());
    if (!validatedEntries.ok) return validatedEntries;
    if (isFn(host, "reapplyLayoutEntries")) {
      const reapplied = callResult(
        () => host.reapplyLayoutEntries(validatedEntries.value),
        RUNTIME_ERROR_CODES.HOST_APPLY_FAILED
      );
      if (!reapplied.ok) return reapplied;
    } else {
      for (const entry of validatedEntries.value) {
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
    inspectElement,
    getPersistenceStatus,
    reapplyCurrentLayoutState,
    endSession,
  };
}

const { resolveOperationStep } = require("./operation-step-resolver.cjs");
module.exports = { createUiEditorRuntime, validateLayoutEntryForElement, resolveOperationStep };
