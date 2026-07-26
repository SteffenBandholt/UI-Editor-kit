"use strict";

const { validateUiElementList } = require("../core/ui-element-validator.cjs");
const { LOCAL_TARGET_PROTOCOL_VERSION } = require("./local-target-protocol.cjs");

const ELECTRON_TARGET_CONTRACT_VERSION = "1.0";
const ELECTRON_TARGET_FRAMEWORK = "electron";
const ELECTRON_TARGET_OPERATIONS = Object.freeze([
  "move",
  "resize",
  "resizeWidth",
  "resizeHeight",
  "textMove",
  "textResize",
  "setVisibility",
]);
const REQUIRED_FIELDS = Object.freeze([
  "applicationId",
  "displayName",
  "framework",
  "contractVersion",
  "registryVersion",
  "activeScopes",
  "profileRoot",
  "supportedOperations",
  "selectionCapability",
  "visibilityCapability",
  "labelFieldSeparation",
  "transportProtocolVersion",
  "sessionId",
  "processId",
  "pdfCapability",
]);
const FORBIDDEN_KEYS = new Set([
  "domainData", "businessData", "fachDaten", "recordId", "entity", "database", "sql",
  "values", "rows", "records", "statusValue", "responsibleValue", "dueDate", "photos",
]);

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function findForbidden(value, path = "") {
  if (Array.isArray(value)) return value.flatMap((item, index) => findForbidden(item, `${path}[${index}]`));
  if (!isObject(value)) return [];
  return Object.entries(value).flatMap(([key, nested]) => {
    const nextPath = path ? `${path}.${key}` : key;
    return [...(FORBIDDEN_KEYS.has(key) ? [nextPath] : []), ...findForbidden(nested, nextPath)];
  });
}

function validateElectronTargetContract(contract) {
  const errors = [];
  if (!isObject(contract)) return { ok: false, errors: [{ code: "electron_contract_invalid", field: "contract" }] };
  for (const field of REQUIRED_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(contract, field)) {
      errors.push({ code: "electron_contract_missing_field", field });
    }
  }
  if (contract.framework !== ELECTRON_TARGET_FRAMEWORK) errors.push({ code: "electron_contract_framework_invalid", field: "framework" });
  if (contract.contractVersion !== ELECTRON_TARGET_CONTRACT_VERSION) errors.push({ code: "electron_contract_version_invalid", field: "contractVersion" });
  if (!Number.isInteger(contract.registryVersion) || contract.registryVersion < 1) errors.push({ code: "electron_contract_registry_version_invalid", field: "registryVersion" });
  if (!Array.isArray(contract.activeScopes) || contract.activeScopes.length === 0 || new Set(contract.activeScopes).size !== contract.activeScopes.length) {
    errors.push({ code: "electron_contract_scopes_invalid", field: "activeScopes" });
  }
  if (!Array.isArray(contract.supportedOperations) || contract.supportedOperations.some((operation) => !ELECTRON_TARGET_OPERATIONS.includes(operation))) {
    errors.push({ code: "electron_contract_operations_invalid", field: "supportedOperations" });
  }
  if (contract.selectionCapability !== "bidirectional") errors.push({ code: "electron_contract_selection_invalid", field: "selectionCapability" });
  if (contract.visibilityCapability !== true) errors.push({ code: "electron_contract_visibility_invalid", field: "visibilityCapability" });
  if (contract.labelFieldSeparation !== true) errors.push({ code: "electron_contract_label_field_invalid", field: "labelFieldSeparation" });
  if (contract.pdfCapability !== "unavailable") errors.push({ code: "electron_contract_pdf_invalid", field: "pdfCapability" });
  if (contract.transportProtocolVersion !== LOCAL_TARGET_PROTOCOL_VERSION) errors.push({ code: "electron_contract_transport_version_invalid", field: "transportProtocolVersion" });
  if (!Number.isInteger(contract.processId) || contract.processId < 1) errors.push({ code: "electron_contract_process_invalid", field: "processId" });
  for (const field of ["applicationId", "displayName", "profileRoot", "transportProtocolVersion", "sessionId"]) {
    if (typeof contract[field] !== "string" || contract[field].trim() === "") errors.push({ code: "electron_contract_text_invalid", field });
  }
  for (const field of findForbidden(contract)) errors.push({ code: "electron_contract_domain_data_forbidden", field });
  return { ok: errors.length === 0, errors };
}

function validateElectronRegistryScopes(registryScopes, activeScopes) {
  const errors = [];
  if (!Array.isArray(registryScopes)) return { ok: false, errors: [{ code: "electron_registry_invalid", field: "registryScopes" }] };
  const scopeIds = [];
  for (const [index, scope] of registryScopes.entries()) {
    if (!isObject(scope) || typeof scope.scopeId !== "string" || !Array.isArray(scope.elements)) {
      errors.push({ code: "electron_registry_invalid", field: `registryScopes[${index}]` });
      continue;
    }
    scopeIds.push(scope.scopeId);
    const result = validateUiElementList(scope.elements);
    errors.push(...result.errors.map((error) => ({ ...error, scopeId: scope.scopeId })));
    const root = scope.elements.find((element) => element.type === "root");
    if (!root || root.id !== scope.scopeId) errors.push({ code: "electron_registry_scope_root_invalid", scopeId: scope.scopeId });
  }
  if (new Set(scopeIds).size !== scopeIds.length) errors.push({ code: "electron_registry_scope_duplicate" });
  if (Array.isArray(activeScopes) && (activeScopes.length !== scopeIds.length || activeScopes.some((scopeId) => !scopeIds.includes(scopeId)))) {
    errors.push({ code: "electron_registry_active_scopes_mismatch" });
  }
  return { ok: errors.length === 0, errors };
}

function createElectronTargetContract(values) {
  const contract = Object.freeze({
    applicationId: values.applicationId,
    displayName: values.displayName,
    framework: ELECTRON_TARGET_FRAMEWORK,
    contractVersion: ELECTRON_TARGET_CONTRACT_VERSION,
    registryVersion: values.registryVersion,
    activeScopes: Object.freeze([...values.activeScopes]),
    profileRoot: values.profileRoot,
    supportedOperations: Object.freeze([...values.supportedOperations]),
    selectionCapability: "bidirectional",
    visibilityCapability: true,
    labelFieldSeparation: true,
    transportProtocolVersion: values.transportProtocolVersion,
    sessionId: values.sessionId,
    processId: values.processId,
    pdfCapability: "unavailable",
  });
  const result = validateElectronTargetContract(contract);
  if (!result.ok) {
    const error = new TypeError("Electron-Ziel-App-Vertrag ist ungueltig.");
    error.validationErrors = result.errors;
    throw error;
  }
  return contract;
}

module.exports = Object.freeze({
  ELECTRON_TARGET_CONTRACT_VERSION,
  ELECTRON_TARGET_FRAMEWORK,
  ELECTRON_TARGET_OPERATIONS,
  createElectronTargetContract,
  validateElectronTargetContract,
  validateElectronRegistryScopes,
});
