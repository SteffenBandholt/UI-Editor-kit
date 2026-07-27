#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const {
  PDF_TARGET_CONTRACT_VERSION,
  PDF_TARGET_OPERATIONS,
  createPdfRegistryFingerprint,
  validatePdfRegistry,
  validatePdfTargetContract,
  createElectronTargetContract,
  validateElectronTargetContract,
  LOCAL_TARGET_PROTOCOL_VERSION,
} = require("../../src/index.cjs");

const scopeId = "pdf.test.protocol";
const baseline = { x: 0, y: 0, width: 10, height: 10, visible: true };
const layoutBounds = { minX: 0, maxX: 210, minY: 0, maxY: 297, minWidth: 1, maxWidth: 210, minHeight: 1, maxHeight: 297 };
function entry(id, parentId, kind, order, capabilities = [], extra = {}) {
  return { id, name: `Name ${order}`, scopeId, parentId, kind, role: kind === "label" ? "fieldLabel" : "layout",
    pageArea: kind === "document" || kind === "page" ? "document" : kind === "header" ? "header" : kind === "footer" ? "footer" : "body",
    order, visible: true, editable: capabilities.length > 0, capabilities,
    allowedOps: capabilities, lockedOps: PDF_TARGET_OPERATIONS.filter((operation) => !capabilities.includes(operation)),
    baseline: { ...baseline }, layoutBounds: { ...layoutBounds }, refKey: `ref-${order}`, rendererKey: `.node-${order}`, ...extra };
}
const registry = {
  applicationId: "test-app", documentTypeId: "protocol", displayName: "Test", scopeId, unit: "mm",
  pageSettings: { format: "A4", orientation: "portrait", width: 210, height: 297, margins: { top: 10, right: 10, bottom: 10, left: 10 } },
  elements: [
    entry(scopeId, null, "document", 0), entry(`${scopeId}.page`, scopeId, "page", 1, ["setPageMargins"]),
    entry(`${scopeId}.header`, `${scopeId}.page`, "header", 2), entry(`${scopeId}.body`, `${scopeId}.page`, "area", 3),
    entry(`${scopeId}.footer`, `${scopeId}.page`, "footer", 4), entry(`${scopeId}.group`, `${scopeId}.body`, "group", 5),
    entry(`${scopeId}.label`, `${scopeId}.group`, "label", 6, ["textResize"]), entry(`${scopeId}.value`, `${scopeId}.group`, "value", 7, ["textResize"]),
    entry(`${scopeId}.table`, `${scopeId}.body`, "table", 8, ["resizeWidth"]),
    entry(`${scopeId}.column-a`, `${scopeId}.table`, "tableColumn", 9, ["resizeWidth"], { columnRole: "structureColumn" }),
    entry(`${scopeId}.column-b`, `${scopeId}.table`, "tableColumn", 10, ["resizeWidth"], { columnRole: "contentColumn" }),
    entry(`${scopeId}.rows`, `${scopeId}.table`, "repeatingArea", 11, ["setLineSpacing"]),
  ],
};
registry.registryVersion = 1;
registry.registryFingerprint = createPdfRegistryFingerprint(registry);

const checked = validatePdfRegistry(registry);
assert.equal(checked.ok, true, JSON.stringify(checked.errors));
assert.equal(createPdfRegistryFingerprint(registry), createPdfRegistryFingerprint({ ...registry, displayName: "Andere Anzeige",
  elements: registry.elements.map((item) => ({ ...item, name: `Andere Anzeige ${item.order}` })) }));
assert.notEqual(createPdfRegistryFingerprint(registry), createPdfRegistryFingerprint({ ...registry,
  elements: registry.elements.map((item, index) => index ? item : { ...item, baseline: { ...item.baseline, width: 11 } }) }));
assert.equal(validatePdfRegistry({ ...registry, values: { customer: "verboten" } }).ok, false);
assert.equal(validatePdfRegistry({ ...registry, elements: registry.elements.map((item, index) => index === 6 ? { ...item, parentId: "pdf.unknown" } : item) }).ok, false);

const pdfContract = { applicationId: "test-app", documentTypeId: "protocol", displayName: "Test-PDF", contractVersion: PDF_TARGET_CONTRACT_VERSION,
  registryVersion: 1, registryFingerprint: registry.registryFingerprint, profileScope: scopeId, supportedOperations: [...PDF_TARGET_OPERATIONS],
  pageSettingsCapability: "margins", previewCapability: "nativePdf", regenerateCapability: "explicit", activeDocumentId: "opaque-document-id", pdfRegistryStatus: "available" };
assert.equal(validatePdfTargetContract(pdfContract).ok, true);
assert.equal(validatePdfTargetContract({ ...pdfContract, activeDocumentId: "" }).ok, false);

const electron = createElectronTargetContract({ applicationId: "test-app", displayName: "Test", appVersion: "1.0.0", registryVersion: 1,
  registryFingerprint: `sha256:${"a".repeat(64)}`, registryStatus: "complete", activeScopes: ["ui.test"], profileRoot: "C:\\profiles",
  supportedOperations: ["move"], transportProtocolVersion: LOCAL_TARGET_PROTOCOL_VERSION, sessionId: "session", processId: 123,
  pdfCapability: "available", pdfContract });
assert.equal(validateElectronTargetContract(electron).ok, true);
assert.equal(validateElectronTargetContract({ ...electron, pdfContract: null }).ok, false);

console.log("TESTS OK: M81 PDF-Zielvertrag, Registry und deterministischer Fingerprint");
