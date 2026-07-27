"use strict";

const crypto = require("node:crypto");

const PDF_TARGET_CONTRACT_VERSION = "1.0";
const PDF_REGISTRY_STATUSES = Object.freeze([
  "available",
  "unavailable",
  "incomplete",
  "changed",
  "incompatible",
  "blocked",
]);
const PDF_TARGET_OPERATIONS = Object.freeze([
  "move",
  "resize",
  "resizeWidth",
  "resizeHeight",
  "textMove",
  "textResize",
  "setTextAlignment",
  "setLineSpacing",
  "setVisibility",
  "setPageMargins",
]);
const PDF_ELEMENT_KINDS = new Set([
  "document",
  "page",
  "area",
  "header",
  "footer",
  "group",
  "label",
  "value",
  "text",
  "image",
  "table",
  "tableColumn",
  "repeatingArea",
]);
const PDF_PAGE_AREAS = new Set(["document", "header", "body", "footer"]);
const PDF_BASELINE_KEYS = Object.freeze([
  "x", "y", "width", "height", "textOffsetX", "textOffsetY", "fontSize",
  "textAlignment", "lineSpacing", "visible", "marginTop", "marginRight", "marginBottom", "marginLeft",
]);
const PDF_BOUND_KEYS = Object.freeze(["minX", "maxX", "minY", "maxY", "minWidth", "maxWidth", "minHeight", "maxHeight"]);
const FORBIDDEN_KEYS = new Set([
  "domainData", "businessData", "fachDaten", "customer", "customerData", "projectData",
  "meetingData", "records", "rows", "values", "statusValue", "responsibleValue", "dueDate",
  "database", "sql", "filePath", "outputPath", "command", "shell",
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

function findForbidden(value, path = "") {
  if (Array.isArray(value)) return value.flatMap((entry, index) => findForbidden(entry, `${path}[${index}]`));
  if (!isObject(value)) return [];
  return Object.entries(value).flatMap(([key, nested]) => {
    const next = path ? `${path}.${key}` : key;
    return [...(FORBIDDEN_KEYS.has(key) ? [next] : []), ...findForbidden(nested, next)];
  });
}

function canonicalNumbers(source, keys) {
  const result = {};
  if (!isObject(source)) return result;
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
    const value = source[key];
    if (key === "visible") result[key] = value !== false;
    else if (key === "textAlignment") result[key] = text(value);
    else if (value === null) result[key] = null;
    else if (Number.isFinite(Number(value))) result[key] = Number(value);
  }
  return result;
}

function canonicalPdfRegistry(registry) {
  const scopeId = text(registry?.scopeId);
  return {
    applicationId: text(registry?.applicationId),
    documentTypeId: text(registry?.documentTypeId),
    scopeId,
    unit: text(registry?.unit),
    pageSettings: {
      format: text(registry?.pageSettings?.format),
      orientation: text(registry?.pageSettings?.orientation),
      width: Number(registry?.pageSettings?.width),
      height: Number(registry?.pageSettings?.height),
      margins: canonicalNumbers(registry?.pageSettings?.margins, ["top", "right", "bottom", "left"]),
    },
    elements: (Array.isArray(registry?.elements) ? registry.elements : []).map((element) => ({
      id: text(element?.id),
      parentId: element?.parentId == null ? null : text(element.parentId),
      scopeId: text(element?.scopeId) || scopeId,
      kind: text(element?.kind),
      role: text(element?.role),
      pageArea: text(element?.pageArea),
      order: Number(element?.order),
      editable: element?.editable === true,
      capabilities: sortedText(element?.capabilities || element?.allowedOps),
      lockedOps: sortedText(element?.lockedOps),
      baseline: canonicalNumbers(element?.baseline, PDF_BASELINE_KEYS),
      layoutBounds: canonicalNumbers(element?.layoutBounds, PDF_BOUND_KEYS),
      refKey: text(element?.refKey),
      rendererKey: text(element?.rendererKey),
      columnRole: text(element?.columnRole),
    })).sort((left, right) => left.id.localeCompare(right.id)),
  };
}

function createPdfRegistryFingerprint(registry) {
  const json = JSON.stringify(canonicalPdfRegistry(registry));
  return `sha256:${crypto.createHash("sha256").update(json, "utf8").digest("hex")}`;
}

function validatePdfRegistry(registry) {
  const errors = [];
  if (!isObject(registry)) return { ok: false, errors: [{ code: "pdf_registry_invalid", field: "registry" }] };
  const requiredText = ["applicationId", "documentTypeId", "displayName", "scopeId", "unit"];
  for (const field of requiredText) if (!text(registry[field])) errors.push({ code: "pdf_registry_missing_field", field });
  if (registry.unit !== "mm") errors.push({ code: "pdf_registry_unit_invalid", field: "unit" });
  const page = registry.pageSettings;
  if (!isObject(page) || page.format !== "A4" || !["portrait", "landscape"].includes(page.orientation) ||
      !Number.isFinite(Number(page.width)) || !Number.isFinite(Number(page.height)) || !isObject(page.margins)) {
    errors.push({ code: "pdf_registry_page_invalid", field: "pageSettings" });
  } else {
    for (const side of ["top", "right", "bottom", "left"]) {
      if (!Number.isFinite(Number(page.margins[side])) || Number(page.margins[side]) < 0) {
        errors.push({ code: "pdf_registry_page_invalid", field: `pageSettings.margins.${side}` });
      }
    }
  }
  const elements = Array.isArray(registry.elements) ? registry.elements : [];
  if (elements.length === 0) errors.push({ code: "pdf_registry_elements_missing", field: "elements" });
  const byId = new Map();
  for (const [index, element] of elements.entries()) {
    const prefix = `elements[${index}]`;
    const id = text(element?.id);
    if (!id || !id.startsWith("pdf.") || byId.has(id)) errors.push({ code: "pdf_registry_id_invalid", field: `${prefix}.id` });
    else byId.set(id, element);
    if (text(element?.scopeId) !== text(registry.scopeId)) errors.push({ code: "pdf_registry_scope_invalid", field: `${prefix}.scopeId` });
    if (!text(element?.name) || !PDF_ELEMENT_KINDS.has(element?.kind) || !text(element?.role) || !PDF_PAGE_AREAS.has(element?.pageArea)) {
      errors.push({ code: "pdf_registry_element_invalid", field: prefix });
    }
    if (!Number.isInteger(element?.order) || element.order < 0) errors.push({ code: "pdf_registry_order_invalid", field: `${prefix}.order` });
    if (!isObject(element?.baseline) || !isObject(element?.layoutBounds) || !text(element?.refKey) || !text(element?.rendererKey)) {
      errors.push({ code: "pdf_registry_layout_invalid", field: prefix });
    }
    const allowed = sortedText(element?.capabilities || element?.allowedOps);
    const locked = sortedText(element?.lockedOps);
    if (allowed.some((operation) => !PDF_TARGET_OPERATIONS.includes(operation)) || allowed.some((operation) => locked.includes(operation))) {
      errors.push({ code: "pdf_registry_operations_invalid", field: `${prefix}.capabilities` });
    }
    if (element?.editable !== (allowed.length > 0)) errors.push({ code: "pdf_registry_editable_invalid", field: `${prefix}.editable` });
    if (element?.visible !== true) errors.push({ code: "pdf_registry_visibility_invalid", field: `${prefix}.visible` });
    if (element?.kind === "tableColumn" && !text(element?.columnRole)) errors.push({ code: "pdf_registry_column_role_missing", field: `${prefix}.columnRole` });
  }
  const roots = elements.filter((element) => element?.kind === "document" && element?.parentId == null);
  if (roots.length !== 1 || roots[0]?.id !== registry.scopeId) errors.push({ code: "pdf_registry_root_invalid", field: "elements" });
  for (const element of elements) {
    if (element?.kind !== "document" && (!text(element?.parentId) || !byId.has(text(element.parentId)))) {
      errors.push({ code: "pdf_registry_parent_invalid", field: `${text(element?.id)}.parentId` });
    }
    const seen = new Set();
    let current = element;
    while (current?.parentId && byId.has(text(current.parentId))) {
      if (!seen.add(text(current.parentId))) { errors.push({ code: "pdf_registry_parent_cycle", field: `${text(element?.id)}.parentId` }); break; }
      current = byId.get(text(current.parentId));
    }
  }
  const kinds = new Set(elements.map((element) => element?.kind));
  for (const kind of ["document", "page", "area", "header", "footer", "group", "label", "value", "table", "tableColumn", "repeatingArea"]) {
    if (!kinds.has(kind)) errors.push({ code: "pdf_registry_kind_missing", field: kind });
  }
  if (elements.filter((element) => element?.kind === "tableColumn").length < 2) errors.push({ code: "pdf_registry_columns_missing", field: "elements" });
  for (const field of findForbidden(registry)) errors.push({ code: "pdf_registry_domain_data_forbidden", field });
  return { ok: errors.length === 0, errors, fingerprint: createPdfRegistryFingerprint(registry) };
}

function validatePdfTargetContract(contract) {
  const errors = [];
  if (!isObject(contract)) return { ok: false, errors: [{ code: "pdf_contract_invalid", field: "pdfContract" }] };
  for (const field of ["applicationId", "documentTypeId", "displayName", "contractVersion", "registryFingerprint", "profileScope", "activeDocumentId", "pdfRegistryStatus"]) {
    if (!text(contract[field])) errors.push({ code: "pdf_contract_missing_field", field });
  }
  if (contract.contractVersion !== PDF_TARGET_CONTRACT_VERSION) errors.push({ code: "pdf_contract_version_invalid", field: "contractVersion" });
  if (!Number.isInteger(contract.registryVersion) || contract.registryVersion < 1) errors.push({ code: "pdf_contract_registry_version_invalid", field: "registryVersion" });
  if (!/^sha256:[a-f0-9]{64}$/.test(text(contract.registryFingerprint))) errors.push({ code: "pdf_contract_fingerprint_invalid", field: "registryFingerprint" });
  if (!PDF_REGISTRY_STATUSES.includes(contract.pdfRegistryStatus)) errors.push({ code: "pdf_contract_status_invalid", field: "pdfRegistryStatus" });
  if (!Array.isArray(contract.supportedOperations) || contract.supportedOperations.some((operation) => !PDF_TARGET_OPERATIONS.includes(operation))) {
    errors.push({ code: "pdf_contract_operations_invalid", field: "supportedOperations" });
  }
  if (!new Set(["margins", "none"]).has(contract.pageSettingsCapability)) errors.push({ code: "pdf_contract_page_settings_invalid", field: "pageSettingsCapability" });
  if (contract.previewCapability !== "nativePdf" || contract.regenerateCapability !== "explicit") {
    errors.push({ code: "pdf_contract_preview_invalid", field: "previewCapability" });
  }
  for (const field of findForbidden(contract)) errors.push({ code: "pdf_contract_domain_data_forbidden", field });
  return { ok: errors.length === 0, errors };
}

module.exports = Object.freeze({
  PDF_TARGET_CONTRACT_VERSION,
  PDF_REGISTRY_STATUSES,
  PDF_TARGET_OPERATIONS,
  canonicalPdfRegistry,
  createPdfRegistryFingerprint,
  validatePdfRegistry,
  validatePdfTargetContract,
});
