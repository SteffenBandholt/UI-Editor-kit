"use strict";

const crypto = require("node:crypto");
const { ELECTRON_EDITOR_ERROR_CODES } = require("./electron-error-codes.cjs");
const { validateUiElementList } = require("../core/ui-element-validator.cjs");

const TARGET_REGISTRATION_STATUSES = Object.freeze([
  "notInstalled",
  "registrationRequired",
  "registrationInProgress",
  "incomplete",
  "complete",
  "changed",
  "incompatible",
  "blocked",
]);

const REGISTRY_SCOPE_STATUSES = Object.freeze(["incomplete", "complete", "changed", "incompatible", "blocked"]);
const BASELINE_KEYS = Object.freeze([
  "x", "y", "width", "height", "textOffsetX", "textOffsetY", "fontSize", "visible",
  "minWidth", "maxWidth", "minHeight", "maxHeight",
]);

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function sortedText(values) {
  return Array.isArray(values) ? [...new Set(values.map(text).filter(Boolean))].sort() : [];
}

function canonicalBaseline(value) {
  if (!isObject(value)) return null;
  const result = {};
  for (const key of BASELINE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
    const current = value[key];
    if (key === "visible") result[key] = current !== false;
    else if (current === null) result[key] = null;
    else if (Number.isFinite(Number(current))) result[key] = Number(current);
  }
  return result;
}

function canonicalElement(scopeId, element) {
  const operationEffects = {};
  for (const key of Object.keys(isObject(element?.operationEffects) ? element.operationEffects : {}).sort()) operationEffects[key] = text(element.operationEffects[key]);
  const operationAffectedIds = {};
  for (const key of Object.keys(isObject(element?.operationAffectedIds) ? element.operationAffectedIds : {}).sort()) operationAffectedIds[key] = sortedText(element.operationAffectedIds[key]);
  return {
    id: text(element?.id),
    parentId: element?.parentId == null ? null : text(element.parentId),
    scopeId: text(element?.scopeId) || scopeId,
    type: text(element?.type),
    role: text(element?.role),
    semanticKey: text(element?.semanticKey) || text(element?.id),
    capabilities: sortedText(element?.capabilities || element?.allowedOps),
    lockedOps: sortedText(element?.lockedOps),
    baseline: canonicalBaseline(element?.baseline),
    refKey: text(element?.refKey),
    selectionKind: text(element?.selectionKind),
    selectionLevels: sortedText(element?.selectionLevels),
    operationEffects,
    operationAffectedIds,
    geometry: isObject(element?.geometry) ? Object.fromEntries(Object.keys(element.geometry).sort().map((key) => [key, Number(element.geometry[key])])) : {},
  };
}

function canonicalScope(scope) {
  const scopeId = text(scope?.scopeId);
  return {
    scopeId,
    status: text(scope?.status),
    expectedElementIds: sortedText(scope?.expectedElementIds),
    elements: (Array.isArray(scope?.elements) ? scope.elements : [])
      .map((element) => canonicalElement(scopeId, element))
      .sort((left, right) => left.id.localeCompare(right.id)),
  };
}

function canonicalRegistry(registryScopes) {
  return (Array.isArray(registryScopes) ? registryScopes : [])
    .map(canonicalScope)
    .sort((left, right) => left.scopeId.localeCompare(right.scopeId));
}

function createRegistryFingerprint(registryScopes) {
  const json = JSON.stringify(canonicalRegistry(registryScopes));
  return `sha256:${crypto.createHash("sha256").update(json, "utf8").digest("hex")}`;
}

function error(code, field, details) {
  return { code, ...(field ? { field } : {}), ...(details ? { details } : {}) };
}

function hasCycle(elementsById, elementId) {
  const seen = new Set();
  let current = elementsById.get(elementId);
  while (current?.parentId) {
    if (!elementsById.has(current.parentId)) return false;
    if (seen.has(current.parentId)) return true;
    seen.add(current.parentId);
    current = elementsById.get(current.parentId);
  }
  return false;
}

function validateRegistrationSnapshot(snapshot) {
  const errors = [];
  if (!isObject(snapshot)) return { ok: false, errors: [error(ELECTRON_EDITOR_ERROR_CODES.REGISTRATION_FAILED, "snapshot")] };
  const contract = snapshot.contract;
  const scopes = Array.isArray(snapshot.registryScopes) ? snapshot.registryScopes : [];
  if (!isObject(contract)) errors.push(error(ELECTRON_EDITOR_ERROR_CODES.REGISTRATION_FAILED, "contract"));
  for (const field of ["applicationId", "displayName", "appVersion", "framework", "contractVersion", "adapterVersion", "uiCapability", "pdfCapability"]) {
    if (!text(contract?.[field])) errors.push(error(ELECTRON_EDITOR_ERROR_CODES.REGISTRATION_FAILED, `contract.${field}`));
  }
  if (!Array.isArray(contract?.supportedOperations)) errors.push(error(ELECTRON_EDITOR_ERROR_CODES.REGISTRATION_FAILED, "contract.supportedOperations"));
  if (contract?.labelFieldSeparation !== true) errors.push(error(ELECTRON_EDITOR_ERROR_CODES.REGISTRY_INCOMPATIBLE, "contract.labelFieldSeparation"));
  if (contract?.visibilityCapability !== true) errors.push(error(ELECTRON_EDITOR_ERROR_CODES.REGISTRY_INCOMPATIBLE, "contract.visibilityCapability"));
  if (!Number.isInteger(contract?.registryVersion) || contract.registryVersion < 1)
    errors.push(error(ELECTRON_EDITOR_ERROR_CODES.REGISTRY_VERSION_MISSING, "contract.registryVersion"));
  if (!text(contract?.registryFingerprint))
    errors.push(error(ELECTRON_EDITOR_ERROR_CODES.REGISTRY_FINGERPRINT_MISSING, "contract.registryFingerprint"));
  if (!TARGET_REGISTRATION_STATUSES.includes(contract?.registryStatus))
    errors.push(error(ELECTRON_EDITOR_ERROR_CODES.REGISTRY_INCOMPATIBLE, "contract.registryStatus"));
  if (!Array.isArray(contract?.activeScopes))
    errors.push(error(ELECTRON_EDITOR_ERROR_CODES.REGISTRY_INCOMPLETE, "contract.activeScopes"));

  const scopeIds = new Set();
  const globalElementIds = new Set();
  for (const [scopeIndex, scope] of scopes.entries()) {
    const prefix = `registryScopes[${scopeIndex}]`;
    const scopeId = text(scope?.scopeId);
    if (!scopeId || scopeIds.has(scopeId)) {
      errors.push(error(ELECTRON_EDITOR_ERROR_CODES.REGISTRY_INCOMPLETE, `${prefix}.scopeId`));
      continue;
    }
    scopeIds.add(scopeId);
    if (!REGISTRY_SCOPE_STATUSES.includes(scope.status))
      errors.push(error(ELECTRON_EDITOR_ERROR_CODES.REGISTRY_SCOPE_INCOMPLETE, `${prefix}.status`));
    if (!text(scope.inventoryStatus)) errors.push(error(ELECTRON_EDITOR_ERROR_CODES.REGISTRY_SCOPE_INCOMPLETE, `${prefix}.inventoryStatus`));
    const elements = Array.isArray(scope.elements) ? scope.elements : [];
    const elementContractErrors = elements.length > 0 ? validateUiElementList(elements).errors : [];
    for (const contractError of elementContractErrors) {
      const code = contractError.code === "missing_role" || contractError.code === "invalid_role"
        ? ELECTRON_EDITOR_ERROR_CODES.REGISTRY_ROLE_MISSING
        : contractError.code.includes("parent") || contractError.code.includes("cycle")
          ? ELECTRON_EDITOR_ERROR_CODES.REGISTRY_PARENT_INVALID
          : ELECTRON_EDITOR_ERROR_CODES.REGISTRY_INCOMPATIBLE;
      errors.push(error(code, `${prefix}.${contractError.field || "elements"}`, contractError.code));
    }
    const expected = sortedText(scope.expectedElementIds);
    const byId = new Map();
    for (const [elementIndex, element] of elements.entries()) {
      const elementPrefix = `${prefix}.elements[${elementIndex}]`;
      const id = text(element?.id);
      if (!id || byId.has(id)) {
        errors.push(error(ELECTRON_EDITOR_ERROR_CODES.REGISTRY_INCOMPLETE, `${elementPrefix}.id`));
        continue;
      }
      if (globalElementIds.has(id)) errors.push(error(ELECTRON_EDITOR_ERROR_CODES.REGISTRY_INCOMPATIBLE, `${elementPrefix}.id`, "duplicate"));
      globalElementIds.add(id);
      byId.set(id, element);
      if (!text(element.type)) errors.push(error(ELECTRON_EDITOR_ERROR_CODES.REGISTRY_INCOMPATIBLE, `${elementPrefix}.type`));
      if (!text(element.role)) errors.push(error(ELECTRON_EDITOR_ERROR_CODES.REGISTRY_ROLE_MISSING, `${elementPrefix}.role`));
      if (!text(element.semanticKey)) errors.push(error(ELECTRON_EDITOR_ERROR_CODES.REGISTRY_INCOMPATIBLE, `${elementPrefix}.semanticKey`));
      if (!new Set(["editorEnabled", "editorContainer", "locked"]).has(element.registrationStatus))
        errors.push(error(ELECTRON_EDITOR_ERROR_CODES.REGISTRY_INCOMPATIBLE, `${elementPrefix}.registrationStatus`));
      if (!text(element.refKey)) errors.push(error(ELECTRON_EDITOR_ERROR_CODES.REGISTRY_REFERENCE_MISSING, `${elementPrefix}.refKey`));
      if (!isObject(element.baseline)) errors.push(error(ELECTRON_EDITOR_ERROR_CODES.REGISTRY_BASELINE_MISSING, `${elementPrefix}.baseline`));
      if (element.referenceResolved !== true && scope.status === "complete")
        errors.push(error(ELECTRON_EDITOR_ERROR_CODES.REGISTRY_REFERENCE_MISSING, `${elementPrefix}.referenceResolved`));
      const allowed = sortedText(element.capabilities || element.allowedOps);
      const locked = sortedText(element.lockedOps);
      if (allowed.some((operation) => locked.includes(operation)))
        errors.push(error(ELECTRON_EDITOR_ERROR_CODES.REGISTRY_INCOMPATIBLE, `${elementPrefix}.capabilities`));
      const baseline = element.baseline || {};
      const baselineMissing = [
        allowed.includes("move") && (!Number.isFinite(Number(baseline.x)) || !Number.isFinite(Number(baseline.y))),
        (allowed.includes("resize") || allowed.includes("resizeWidth")) && !Number.isFinite(Number(baseline.width)),
        (allowed.includes("resize") || allowed.includes("resizeHeight")) && !Number.isFinite(Number(baseline.height)),
        allowed.includes("textMove") && (!Number.isFinite(Number(baseline.textOffsetX)) || !Number.isFinite(Number(baseline.textOffsetY))),
        allowed.includes("textResize") && !Number.isFinite(Number(baseline.fontSize)),
        allowed.includes("setVisibility") && typeof baseline.visible !== "boolean",
      ].some(Boolean);
      if (baselineMissing) {
        errors.push(error(ELECTRON_EDITOR_ERROR_CODES.REGISTRY_BASELINE_MISSING, `${elementPrefix}.baseline`));
      }
      if (element.type === "button" && text(element.actionKind).toLowerCase().includes("domain") &&
          (!locked.includes("executeTargetAction") || !locked.includes("modifyDomainData"))) {
        errors.push(error(ELECTRON_EDITOR_ERROR_CODES.REGISTRY_INCOMPATIBLE, `${elementPrefix}.lockedOps`));
      }
    }
    for (const [id, element] of byId) {
      if (element.parentId != null && !byId.has(text(element.parentId)))
        errors.push(error(ELECTRON_EDITOR_ERROR_CODES.REGISTRY_PARENT_INVALID, `${prefix}.${id}.parentId`));
      if (hasCycle(byId, id)) errors.push(error(ELECTRON_EDITOR_ERROR_CODES.REGISTRY_PARENT_INVALID, `${prefix}.${id}.parentId`, "cycle"));
      const parent = element.parentId == null ? null : byId.get(text(element.parentId));
      if (element.type === "field" && parent?.type === "label")
        errors.push(error(ELECTRON_EDITOR_ERROR_CODES.REGISTRY_PARENT_INVALID, `${prefix}.${id}.parentId`, "label_field_separation"));
      if (element.type === "tableColumn" && (parent?.type !== "table" || !text(element.columnRole)))
        errors.push(error(ELECTRON_EDITOR_ERROR_CODES.REGISTRY_INCOMPATIBLE, `${prefix}.${id}.columnRole`));
    }
    for (const group of [...byId.values()].filter((element) => element.type === "fieldGroup")) {
      const children = [...byId.values()].filter((element) => element.parentId === group.id);
      if (!children.some((element) => element.type === "label") || !children.some((element) => element.type === "field"))
        errors.push(error(ELECTRON_EDITOR_ERROR_CODES.REGISTRY_INCOMPLETE, `${prefix}.${group.id}`, "label_field_siblings"));
    }
    for (const id of expected) {
      if (!byId.has(id)) errors.push(error(ELECTRON_EDITOR_ERROR_CODES.REGISTRY_EXPECTED_ELEMENT_MISSING, `${prefix}.${id}`));
    }
    if (scope.status === "complete") {
      if (expected.length === 0 || expected.length !== byId.size)
        errors.push(error(ELECTRON_EDITOR_ERROR_CODES.REGISTRY_SCOPE_INCOMPLETE, `${prefix}.expectedElementIds`));
      const roots = [...byId.values()].filter((element) => element.type === "root" && element.parentId == null);
      if (roots.length !== 1 || roots[0].id !== scopeId)
        errors.push(error(ELECTRON_EDITOR_ERROR_CODES.REGISTRY_PARENT_INVALID, `${prefix}.root`));
    }
  }

  for (const scopeId of contract?.activeScopes || []) {
    const scope = scopes.find((candidate) => candidate.scopeId === scopeId);
    if (!scope || scope.status !== "complete") errors.push(error(ELECTRON_EDITOR_ERROR_CODES.REGISTRY_SCOPE_BLOCKED, `contract.activeScopes.${scopeId}`));
  }
  if (Array.isArray(contract?.activeScopes) && new Set(contract.activeScopes).size !== contract.activeScopes.length)
    errors.push(error(ELECTRON_EDITOR_ERROR_CODES.REGISTRY_INCOMPATIBLE, "contract.activeScopes", "duplicate"));
  if (contract?.registryStatus === "complete" && scopes.some((scope) => scope.status !== "complete"))
    errors.push(error(ELECTRON_EDITOR_ERROR_CODES.REGISTRY_INCOMPLETE, "contract.registryStatus"));
  if (contract?.registryStatus === "incompatible" || contract?.registryStatus === "blocked")
    errors.push(error(ELECTRON_EDITOR_ERROR_CODES.REGISTRY_INCOMPATIBLE, "contract.registryStatus"));
  if (text(contract?.registryFingerprint)) {
    const expectedFingerprint = createRegistryFingerprint(scopes);
    if (contract.registryFingerprint !== expectedFingerprint)
      errors.push(error(ELECTRON_EDITOR_ERROR_CODES.REGISTRY_FINGERPRINT_MISMATCH, "contract.registryFingerprint"));
  }
  return { ok: errors.length === 0, errors, fingerprint: createRegistryFingerprint(scopes) };
}

function assessExistingTargetRegistration({
  installed = true,
  registrationInProgress = false,
  adapterAvailable = false,
  refResolutionAvailable = false,
  baselineAvailable = false,
  domainActionProtectionAvailable = false,
  snapshot = null,
  previousSnapshot = null,
} = {}) {
  if (!installed) return { status: "notInstalled", canOpen: false, code: ELECTRON_EDITOR_ERROR_CODES.EDITOR_NOT_INSTALLED };
  if (registrationInProgress) return { status: "registrationInProgress", canOpen: false, code: ELECTRON_EDITOR_ERROR_CODES.REGISTRATION_NOT_CONFIRMED };
  if (!snapshot?.contract || !Array.isArray(snapshot?.registryScopes) || !adapterAvailable)
    return { status: "registrationRequired", canOpen: false, code: ELECTRON_EDITOR_ERROR_CODES.REGISTRATION_REQUIRED };
  if (!refResolutionAvailable || !baselineAvailable || !domainActionProtectionAvailable)
    return { status: "incomplete", canOpen: false, code: ELECTRON_EDITOR_ERROR_CODES.REGISTRY_INCOMPLETE };
  const validation = validateRegistrationSnapshot(snapshot);
  if (!validation.ok) {
    const incompatible = validation.errors.some((entry) => entry.code === ELECTRON_EDITOR_ERROR_CODES.REGISTRY_INCOMPATIBLE || entry.code === ELECTRON_EDITOR_ERROR_CODES.REGISTRY_PROFILE_MIGRATION_REQUIRED);
    return { status: incompatible ? "incompatible" : "incomplete", canOpen: false, code: validation.errors[0]?.code || ELECTRON_EDITOR_ERROR_CODES.REGISTRATION_FAILED, errors: validation.errors };
  }
  const comparison = compareRegistrySnapshots(previousSnapshot, snapshot);
  if (previousSnapshot && comparison.status === "incompatible")
    return { status: "incompatible", canOpen: false, code: ELECTRON_EDITOR_ERROR_CODES.REGISTRY_PROFILE_MIGRATION_REQUIRED, comparison };
  if (previousSnapshot && comparison.status === "changed")
    return { status: "changed", canOpen: true, code: ELECTRON_EDITOR_ERROR_CODES.REGISTRY_CHANGED, comparison };
  const complete = snapshot.contract.registryStatus === "complete";
  return {
    status: complete ? "complete" : "incomplete",
    canOpen: Array.isArray(snapshot.contract.activeScopes) && snapshot.contract.activeScopes.length > 0,
    code: complete ? "registration_complete" : ELECTRON_EDITOR_ERROR_CODES.REGISTRY_SCOPE_BLOCKED,
    comparison,
  };
}

function elementMap(snapshot) {
  return new Map((snapshot?.registryScopes || []).flatMap((scope) => (scope.elements || []).map((element) => [element.id, canonicalElement(scope.scopeId, element)])));
}

function same(valueA, valueB) {
  return JSON.stringify(valueA) === JSON.stringify(valueB);
}

function compareRegistrySnapshots(previous, next) {
  if (!previous) return { status: "changed", addedElementIds: [...elementMap(next).keys()].sort(), removedElementIds: [], stableElementIds: [], migrationRequiredIds: [], removedCapabilities: {} };
  if (previous.contract.registryVersion === next.contract.registryVersion && previous.contract.registryFingerprint === next.contract.registryFingerprint)
    return { status: "current", addedElementIds: [], removedElementIds: [], stableElementIds: [...elementMap(next).keys()].sort(), migrationRequiredIds: [], removedCapabilities: {} };
  const before = elementMap(previous);
  const after = elementMap(next);
  const addedElementIds = [...after.keys()].filter((id) => !before.has(id)).sort();
  const removedElementIds = [...before.keys()].filter((id) => !after.has(id)).sort();
  const stableElementIds = [...after.keys()].filter((id) => before.has(id)).sort();
  const migrationRequiredIds = [];
  const removedCapabilities = {};
  for (const id of stableElementIds) {
    const left = before.get(id); const right = after.get(id);
    if (left.parentId !== right.parentId || left.scopeId !== right.scopeId || left.type !== right.type || left.role !== right.role || left.semanticKey !== right.semanticKey || left.refKey !== right.refKey)
      migrationRequiredIds.push(id);
    const removed = left.capabilities.filter((capability) => !right.capabilities.includes(capability));
    if (removed.length) removedCapabilities[id] = removed;
  }
  return { status: migrationRequiredIds.length ? "incompatible" : "changed", addedElementIds, removedElementIds, stableElementIds, migrationRequiredIds, removedCapabilities };
}

function valueForCapabilities(layout, capabilities) {
  if (!isObject(layout)) return null;
  const result = {};
  if (capabilities.includes("move")) { result.x = layout.x; result.y = layout.y; }
  if (capabilities.includes("resize") || capabilities.includes("resizeWidth")) result.width = layout.width;
  if (capabilities.includes("resize") || capabilities.includes("resizeHeight")) result.height = layout.height;
  if (capabilities.includes("textMove")) { result.textOffsetX = layout.textOffsetX; result.textOffsetY = layout.textOffsetY; }
  if (capabilities.includes("textResize")) result.fontSize = layout.fontSize;
  if (capabilities.includes("setVisibility")) result.visible = layout.visible;
  return result;
}

function reconcileRegistryProfile(previous, next, profileEntries = {}) {
  const comparison = compareRegistrySnapshots(previous, next);
  const nextElements = elementMap(next);
  const active = {};
  const archived = {};
  const newElementIds = [];
  for (const [id, entry] of nextElements) {
    if (comparison.migrationRequiredIds.includes(id)) continue;
    if (Object.prototype.hasOwnProperty.call(profileEntries, id)) {
      active[id] = valueForCapabilities(profileEntries[id], entry.capabilities);
    } else {
      active[id] = valueForCapabilities(entry.baseline, entry.capabilities);
      newElementIds.push(id);
    }
  }
  for (const id of comparison.removedElementIds) {
    if (Object.prototype.hasOwnProperty.call(profileEntries, id)) archived[id] = profileEntries[id];
  }
  return {
    ok: comparison.migrationRequiredIds.length === 0,
    code: comparison.migrationRequiredIds.length
      ? ELECTRON_EDITOR_ERROR_CODES.REGISTRY_PROFILE_MIGRATION_REQUIRED
      : comparison.status === "current" ? "registry_profile_current" : ELECTRON_EDITOR_ERROR_CODES.REGISTRY_CHANGED,
    active,
    archived,
    newElementIds: newElementIds.sort(),
    ignoredElementIds: [...comparison.removedElementIds],
    migrationRequiredIds: [...comparison.migrationRequiredIds],
    removedCapabilities: { ...comparison.removedCapabilities },
    comparison,
  };
}

function createRegistryRefreshCoordinator({ requestSnapshot, getDirtyElementIds = () => [] }) {
  if (typeof requestSnapshot !== "function") throw new TypeError("requestSnapshot muss eine Funktion sein.");
  let current = null;
  async function refresh(reason = "open") {
    let candidate;
    try { candidate = await requestSnapshot(reason); }
    catch (cause) { return { ok: false, code: ELECTRON_EDITOR_ERROR_CODES.REGISTRY_REFRESH_FAILED, preserved: Boolean(current), current, cause }; }
    const validation = validateRegistrationSnapshot(candidate);
    if (!validation.ok) return { ok: false, code: validation.errors[0]?.code || ELECTRON_EDITOR_ERROR_CODES.REGISTRY_REFRESH_FAILED, errors: validation.errors, preserved: Boolean(current), current };
    const comparison = compareRegistrySnapshots(current, candidate);
    const dirty = sortedText(getDirtyElementIds());
    if (current && comparison.status !== "current" && dirty.length)
      return { ok: false, code: ELECTRON_EDITOR_ERROR_CODES.REGISTRY_PROFILE_CONFLICT, conflictElementIds: dirty, preserved: true, current, comparison };
    if (comparison.migrationRequiredIds.length)
      return { ok: false, code: ELECTRON_EDITOR_ERROR_CODES.REGISTRY_PROFILE_MIGRATION_REQUIRED, preserved: true, current, comparison };
    current = candidate;
    return { ok: true, code: comparison.status === "current" ? "registry_current" : ELECTRON_EDITOR_ERROR_CODES.REGISTRY_CHANGED, current, comparison };
  }
  return Object.freeze({ refresh, handleEvent: (eventName) => refresh(eventName), getCurrent: () => current });
}

module.exports = Object.freeze({
  TARGET_REGISTRATION_STATUSES,
  REGISTRY_SCOPE_STATUSES,
  canonicalRegistry,
  createRegistryFingerprint,
  validateRegistrationSnapshot,
  assessExistingTargetRegistration,
  compareRegistrySnapshots,
  reconcileRegistryProfile,
  createRegistryRefreshCoordinator,
});
