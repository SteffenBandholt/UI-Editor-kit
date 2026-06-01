#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const manifestModule = require("../../src/core/target-app-adapter-manifest.cjs");

const REPO_ROOT = path.resolve(__dirname, "../..");
const CORE_FILE = "src/core/target-app-adapter-manifest.cjs";
const TEST_FILE = "scripts/tests/target-app-adapter-manifest.test.cjs";

const {
  getTargetAppAdapterManifestRequiredFields,
  getTargetAppAdapterManifestOptionalFields,
  getForbiddenTargetAppAdapterManifestFields,
  getTargetAppAdapterManifestAllowedModes,
  normalizeTargetAppAdapterManifest,
  createTargetAppAdapterManifest,
  validateTargetAppAdapterManifest,
} = manifestModule;

function read(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

function createCompleteValues() {
  return {
    targetAppId: "neutral-target",
    adapterName: "neutral-adapter",
    adapterVersion: "1.0.0",
    uiScope: "neutral-workspace",
    layoutProfileId: "neutral-layout-profile",
    supportedElementTypes: ["root", "container", "area"],
    supportedRoles: ["root", "layout"],
    supportedOperations: ["inspect", "move", "resize"],
    lockedOperations: ["remove"],
    persistenceMode: "memory-only",
    executionMode: "dry-run",
    riskClass: "low",
    rollbackStrategy: "neutral-rollback-check",
    testStrategy: "neutral-manifest-test",
    description: "Neutral adapter manifest",
    manifestVersion: "1",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    notes: { scope: "neutral" },
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function findError(result, code, field) {
  return result.errors.find((error) => error.code === code && (field === undefined || error.field === field));
}

function assertNoTerms(text, terms, label) {
  terms.forEach((term) => {
    assert.equal(text.includes(term), false, `${label} enthaelt gesperrten Begriff: ${term}`);
  });
}

function run() {
  assert.equal(typeof getTargetAppAdapterManifestRequiredFields, "function");
  assert.equal(typeof getTargetAppAdapterManifestOptionalFields, "function");
  assert.equal(typeof getForbiddenTargetAppAdapterManifestFields, "function");
  assert.equal(typeof getTargetAppAdapterManifestAllowedModes, "function");
  assert.equal(typeof normalizeTargetAppAdapterManifest, "function");
  assert.equal(typeof createTargetAppAdapterManifest, "function");
  assert.equal(typeof validateTargetAppAdapterManifest, "function");

  const requiredFields = getTargetAppAdapterManifestRequiredFields();
  requiredFields.push("mutated");
  assert.equal(getTargetAppAdapterManifestRequiredFields().includes("mutated"), false);
  assert.deepEqual(getTargetAppAdapterManifestRequiredFields(), [
    "targetAppId",
    "adapterName",
    "adapterVersion",
    "uiScope",
    "layoutProfileId",
    "supportedElementTypes",
    "supportedRoles",
    "supportedOperations",
    "lockedOperations",
    "persistenceMode",
    "executionMode",
    "riskClass",
    "rollbackStrategy",
    "testStrategy",
  ]);

  const optionalFields = getTargetAppAdapterManifestOptionalFields();
  optionalFields.push("mutated");
  assert.equal(getTargetAppAdapterManifestOptionalFields().includes("mutated"), false);
  assert.deepEqual(getTargetAppAdapterManifestOptionalFields(), [
    "description",
    "manifestVersion",
    "createdAt",
    "updatedAt",
    "notes",
  ]);

  const forbiddenFields = getForbiddenTargetAppAdapterManifestFields();
  forbiddenFields.push("mutated");
  assert.equal(getForbiddenTargetAppAdapterManifestFields().includes("mutated"), false);
  assert.equal(getForbiddenTargetAppAdapterManifestFields().includes("recordId"), true);
  assert.equal(getForbiddenTargetAppAdapterManifestFields().includes("database"), true);

  const allowedModes = getTargetAppAdapterManifestAllowedModes();
  allowedModes.persistenceModes.push("mutated");
  allowedModes.executionModes.push("production");
  allowedModes.riskClasses.push("mutated");
  assert.deepEqual(getTargetAppAdapterManifestAllowedModes(), {
    persistenceModes: ["none", "memory-only", "layout-state-store"],
    executionModes: ["disabled", "dry-run", "test-host", "manual-gated"],
    riskClasses: ["low", "medium", "high", "blocked"],
  });

  const completeValues = createCompleteValues();
  const manifest = createTargetAppAdapterManifest(completeValues);
  assert.deepEqual(manifest, completeValues);

  const normalized = normalizeTargetAppAdapterManifest({
    ...createCompleteValues(),
    unknownField: "remove me",
    recordId: "forbidden-record",
    database: "forbidden-storage",
  });
  assert.equal(Object.prototype.hasOwnProperty.call(normalized, "targetAppId"), true);
  assert.equal(Object.prototype.hasOwnProperty.call(normalized, "unknownField"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(normalized, "recordId"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(normalized, "database"), false);

  const partial = normalizeTargetAppAdapterManifest({ targetAppId: "neutral-target" });
  assert.deepEqual(partial, { targetAppId: "neutral-target" });

  const valuesWithArrays = createCompleteValues();
  const manifestWithArrays = createTargetAppAdapterManifest(valuesWithArrays);
  assert.notEqual(manifestWithArrays.supportedOperations, valuesWithArrays.supportedOperations);
  assert.notEqual(manifestWithArrays.notes, valuesWithArrays.notes);
  valuesWithArrays.supportedOperations.push("mutated");
  valuesWithArrays.notes.scope = "mutated";
  assert.deepEqual(manifestWithArrays.supportedOperations, ["inspect", "move", "resize"]);
  assert.deepEqual(manifestWithArrays.notes, { scope: "neutral" });

  const validResult = validateTargetAppAdapterManifest(createTargetAppAdapterManifest(createCompleteValues()));
  assert.deepEqual(validResult, { ok: true, errors: [] });

  assert.equal(validateTargetAppAdapterManifest(null).ok, false);
  assert.equal(findError(validateTargetAppAdapterManifest("invalid"), "invalid_manifest") !== undefined, true);
  assert.equal(findError(validateTargetAppAdapterManifest([]), "invalid_manifest") !== undefined, true);

  const missingRequired = createTargetAppAdapterManifest(createCompleteValues());
  delete missingRequired.targetAppId;
  assert.equal(findError(validateTargetAppAdapterManifest(missingRequired), "missing_required_field", "targetAppId") !== undefined, true);

  const emptyString = createTargetAppAdapterManifest({ ...createCompleteValues(), adapterName: "   " });
  assert.equal(findError(validateTargetAppAdapterManifest(emptyString), "invalid_string_field", "adapterName") !== undefined, true);

  const invalidArray = createTargetAppAdapterManifest({ ...createCompleteValues(), supportedOperations: "inspect" });
  assert.equal(
    findError(validateTargetAppAdapterManifest(invalidArray), "invalid_array_field", "supportedOperations") !== undefined,
    true
  );

  const invalidArrayEntry = createTargetAppAdapterManifest({ ...createCompleteValues(), supportedRoles: ["layout", ""] });
  assert.equal(
    findError(validateTargetAppAdapterManifest(invalidArrayEntry), "invalid_array_field", "supportedRoles") !== undefined,
    true
  );

  const invalidPersistenceMode = createTargetAppAdapterManifest({ ...createCompleteValues(), persistenceMode: "external" });
  assert.equal(
    findError(validateTargetAppAdapterManifest(invalidPersistenceMode), "invalid_mode", "persistenceMode") !== undefined,
    true
  );

  const invalidExecutionMode = createTargetAppAdapterManifest({ ...createCompleteValues(), executionMode: "production" });
  assert.equal(
    findError(validateTargetAppAdapterManifest(invalidExecutionMode), "invalid_mode", "executionMode") !== undefined,
    true
  );

  const invalidRiskClass = createTargetAppAdapterManifest({ ...createCompleteValues(), riskClass: "critical" });
  assert.equal(findError(validateTargetAppAdapterManifest(invalidRiskClass), "invalid_mode", "riskClass") !== undefined, true);

  const forbiddenRecordId = { ...createTargetAppAdapterManifest(createCompleteValues()), recordId: "record" };
  assert.equal(
    findError(validateTargetAppAdapterManifest(forbiddenRecordId), "forbidden_field", "recordId") !== undefined,
    true
  );

  const forbiddenDatabase = { ...createTargetAppAdapterManifest(createCompleteValues()), database: "storage" };
  assert.equal(
    findError(validateTargetAppAdapterManifest(forbiddenDatabase), "forbidden_field", "database") !== undefined,
    true
  );

  const modes = getTargetAppAdapterManifestAllowedModes();
  assert.equal(modes.executionModes.includes("production"), false);
  assert.equal(modes.executionModes.includes("productive"), false);
  assert.equal(modes.executionModes.includes("manual-gated"), true);

  const immutableManifest = createTargetAppAdapterManifest(createCompleteValues());
  const beforeValidate = clone(immutableManifest);
  validateTargetAppAdapterManifest(immutableManifest);
  assert.deepEqual(immutableManifest, beforeValidate);

  let contacted = false;
  let executed = false;
  const sideEffectProbe = {
    ...createCompleteValues(),
    get contactExternalTarget() {
      contacted = true;
      return true;
    },
    get executeChange() {
      executed = true;
      return true;
    },
  };
  const sideEffectManifest = createTargetAppAdapterManifest(sideEffectProbe);
  validateTargetAppAdapterManifest(sideEffectManifest);
  assert.equal(contacted, false);
  assert.equal(executed, false);

  const coreSource = read(CORE_FILE);
  const testSource = read(TEST_FILE);
  assert.equal(coreSource.includes("require(\"node:fs\")"), false);
  assert.equal(coreSource.includes("require(\"fs\")"), false);
  assert.equal(coreSource.includes("writeFile"), false);
  assert.equal(coreSource.includes("readFile"), false);
  assert.equal(coreSource.includes("createWriteStream"), false);
  assert.equal(coreSource.includes("connect"), false);
  assert.equal(coreSource.includes("query"), false);
  assert.equal(coreSource.includes("document."), false);
  assert.equal(coreSource.includes("window."), false);
  assert.equal(coreSource.includes("HTMLElement"), false);

  assertNoTerms(coreSource, [
    "Browser",
    "HTML",
    "DOM",
    "Mini-Inspector",
    "Host-App-Demo",
    "Layoutdiagnose",
    "data-ui",
    "Demo",
    "BBM",
    "Protokoll",
    "Restarbeiten",
    "TOP",
    "Bauvorhaben",
  ], CORE_FILE);

  assert.equal(testSource.includes("js" + "dom"), false);
  assert.equal(testSource.includes("puppe" + "teer"), false);
  assert.equal(testSource.includes("play" + "wright"), false);

  console.log("TESTS OK: target-app-adapter-manifest");
}

run();
