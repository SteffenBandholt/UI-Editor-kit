#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  createNeutralMinimalHostAdapterManifest,
  getNeutralMinimalHostManifestExpectation,
  checkTargetAppAdapterManifestAgainstNeutralMinimalHost,
  createNeutralMinimalHostManifestCheckReport,
} = require("../../src/core/target-app-adapter-manifest-check.cjs");
const { validateTargetAppAdapterManifest } = require("../../src/core/target-app-adapter-manifest.cjs");

const REPO_ROOT = path.resolve(__dirname, "../..");
const CORE_FILE = "src/core/target-app-adapter-manifest-check.cjs";
const TEST_FILE = "scripts/tests/target-app-adapter-manifest-check.test.cjs";

function read(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function findError(result, code, field) {
  return result.errors.find((error) => error.code === code && (field === undefined || error.field === field));
}

function assertNoFragments(text, fragments, label) {
  fragments.forEach((fragment) => {
    assert.equal(text.includes(fragment), false, `${label} enthaelt gesperrten Fragmenttext: ${fragment}`);
  });
}

function run() {
  assert.equal(typeof createNeutralMinimalHostAdapterManifest, "function");
  assert.equal(typeof getNeutralMinimalHostManifestExpectation, "function");
  assert.equal(typeof checkTargetAppAdapterManifestAgainstNeutralMinimalHost, "function");
  assert.equal(typeof createNeutralMinimalHostManifestCheckReport, "function");

  const expectation = getNeutralMinimalHostManifestExpectation();
  assert.deepEqual(expectation, {
    targetAppId: "neutral-minimal-host",
    uiScope: "workspace",
    layoutProfileId: "neutral-minimal-layout",
    elementTypes: ["area", "root"],
    roles: ["layout"],
    supportedOperations: ["inspect", "move", "resize"],
    lockedOperations: ["hide", "move", "reset", "resize"],
    allowedExecutionModes: ["disabled", "dry-run", "test-host"],
    allowedPersistenceModes: ["none", "memory-only"],
  });
  expectation.elementTypes.push("mutated");
  expectation.roles.push("mutated");
  expectation.supportedOperations.push("mutated");
  expectation.lockedOperations.push("mutated");
  expectation.allowedExecutionModes.push("manual-gated");
  expectation.allowedPersistenceModes.push("layout-state-store");
  assert.deepEqual(getNeutralMinimalHostManifestExpectation(), {
    targetAppId: "neutral-minimal-host",
    uiScope: "workspace",
    layoutProfileId: "neutral-minimal-layout",
    elementTypes: ["area", "root"],
    roles: ["layout"],
    supportedOperations: ["inspect", "move", "resize"],
    lockedOperations: ["hide", "move", "reset", "resize"],
    allowedExecutionModes: ["disabled", "dry-run", "test-host"],
    allowedPersistenceModes: ["none", "memory-only"],
  });

  const manifest = createNeutralMinimalHostAdapterManifest();
  assert.deepEqual(manifest, {
    targetAppId: "neutral-minimal-host",
    adapterName: "neutral-minimal-host-adapter",
    adapterVersion: "1.0.0",
    uiScope: "workspace",
    layoutProfileId: "neutral-minimal-layout",
    supportedElementTypes: ["area", "root"],
    supportedRoles: ["layout"],
    supportedOperations: ["inspect", "move", "resize"],
    lockedOperations: ["hide", "move", "reset", "resize"],
    persistenceMode: "none",
    executionMode: "test-host",
    riskClass: "low",
    rollbackStrategy: "test-host-record-only",
    testStrategy: "neutral-minimal-host-flow",
  });
  assert.deepEqual(validateTargetAppAdapterManifest(manifest), { ok: true, errors: [] });

  const validCheck = checkTargetAppAdapterManifestAgainstNeutralMinimalHost(manifest);
  assert.equal(validCheck.ok, true);
  assert.deepEqual(validCheck.errors, []);
  assert.equal(typeof validCheck.compatibility, "object");
  assert.deepEqual(validCheck.compatibility, {
    manifestValid: true,
    targetAppMatches: true,
    uiScopeMatches: true,
    layoutProfileMatches: true,
    elementTypesCovered: true,
    rolesCovered: true,
    operationsCovered: true,
    lockedOperationsCovered: true,
    executionModeAllowed: true,
    persistenceModeAllowed: true,
    productiveExecutionBlocked: true,
    manifestOperationsSupported: true,
  });

  const report = createNeutralMinimalHostManifestCheckReport(manifest);
  assert.equal(report.ok, true);
  assert.equal(typeof report.summary, "object");
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.compatibility, validCheck.compatibility);
  assert.equal(report.summary.changesExecuted, false);
  assert.equal(report.summary.storageUsed, false);
  assert.equal(report.summary.externalTargetContacted, false);

  const wrongTarget = checkTargetAppAdapterManifestAgainstNeutralMinimalHost({
    ...manifest,
    targetAppId: "other-neutral-host",
  });
  assert.equal(wrongTarget.ok, false);
  assert.equal(wrongTarget.compatibility.targetAppMatches, false);
  assert.ok(findError(wrongTarget, "target_app_mismatch", "targetAppId"));

  const wrongScope = checkTargetAppAdapterManifestAgainstNeutralMinimalHost({ ...manifest, uiScope: "panel" });
  assert.equal(wrongScope.ok, false);
  assert.equal(wrongScope.compatibility.uiScopeMatches, false);
  assert.ok(findError(wrongScope, "ui_scope_mismatch", "uiScope"));

  const wrongLayout = checkTargetAppAdapterManifestAgainstNeutralMinimalHost({
    ...manifest,
    layoutProfileId: "other-layout",
  });
  assert.equal(wrongLayout.ok, false);
  assert.equal(wrongLayout.compatibility.layoutProfileMatches, false);
  assert.ok(findError(wrongLayout, "layout_profile_mismatch", "layoutProfileId"));

  const missingElementType = checkTargetAppAdapterManifestAgainstNeutralMinimalHost({
    ...manifest,
    supportedElementTypes: ["root"],
  });
  assert.equal(missingElementType.ok, false);
  assert.equal(missingElementType.compatibility.elementTypesCovered, false);
  assert.ok(findError(missingElementType, "missing_element_type", "supportedElementTypes"));

  const missingRole = checkTargetAppAdapterManifestAgainstNeutralMinimalHost({ ...manifest, supportedRoles: [] });
  assert.equal(missingRole.ok, false);
  assert.equal(missingRole.compatibility.rolesCovered, false);
  assert.ok(findError(missingRole, "missing_role", "supportedRoles"));

  const missingSupportedOperation = checkTargetAppAdapterManifestAgainstNeutralMinimalHost({
    ...manifest,
    supportedOperations: ["inspect", "move"],
  });
  assert.equal(missingSupportedOperation.ok, false);
  assert.equal(missingSupportedOperation.compatibility.operationsCovered, false);
  assert.ok(findError(missingSupportedOperation, "missing_supported_operation", "supportedOperations"));

  const unknownOperation = checkTargetAppAdapterManifestAgainstNeutralMinimalHost({
    ...manifest,
    supportedOperations: ["inspect", "move", "resize", "commit"],
  });
  assert.equal(unknownOperation.ok, false);
  assert.equal(unknownOperation.compatibility.manifestOperationsSupported, false);
  assert.ok(findError(unknownOperation, "unsupported_manifest_operation", "supportedOperations"));

  const missingLockedOperation = checkTargetAppAdapterManifestAgainstNeutralMinimalHost({
    ...manifest,
    lockedOperations: ["hide", "reset"],
  });
  assert.equal(missingLockedOperation.ok, false);
  assert.equal(missingLockedOperation.compatibility.lockedOperationsCovered, false);
  assert.ok(findError(missingLockedOperation, "missing_locked_operation", "lockedOperations"));

  const manualGated = checkTargetAppAdapterManifestAgainstNeutralMinimalHost({
    ...manifest,
    executionMode: "manual-gated",
  });
  assert.equal(manualGated.ok, false);
  assert.equal(manualGated.compatibility.executionModeAllowed, false);
  assert.equal(manualGated.compatibility.productiveExecutionBlocked, false);
  assert.ok(findError(manualGated, "invalid_execution_mode_for_neutral_host", "executionMode"));
  assert.ok(findError(manualGated, "productive_execution_not_allowed", "executionMode"));

  const productionLike = checkTargetAppAdapterManifestAgainstNeutralMinimalHost({
    ...manifest,
    executionMode: "production",
  });
  assert.equal(productionLike.ok, false);
  assert.equal(productionLike.compatibility.manifestValid, false);
  assert.equal(productionLike.compatibility.productiveExecutionBlocked, false);
  assert.ok(findError(productionLike, "invalid_manifest"));
  assert.ok(findError(productionLike, "productive_execution_not_allowed", "executionMode"));

  const layoutStateStore = checkTargetAppAdapterManifestAgainstNeutralMinimalHost({
    ...manifest,
    persistenceMode: "layout-state-store",
  });
  assert.equal(layoutStateStore.ok, false);
  assert.equal(layoutStateStore.compatibility.persistenceModeAllowed, false);
  assert.ok(findError(layoutStateStore, "invalid_persistence_mode_for_neutral_host", "persistenceMode"));

  const inputManifest = createNeutralMinimalHostAdapterManifest({ notes: { marker: "neutral" } });
  const inputBefore = clone(inputManifest);
  const inputCheck = checkTargetAppAdapterManifestAgainstNeutralMinimalHost(inputManifest);
  assert.deepEqual(inputManifest, inputBefore);
  inputCheck.manifest.supportedOperations.push("mutated");
  inputCheck.expectation.supportedOperations.push("mutated");
  inputCheck.compatibility.manifestValid = false;
  inputCheck.errors.push({ code: "mutated", message: "mutated" });
  const freshCheck = checkTargetAppAdapterManifestAgainstNeutralMinimalHost(inputManifest);
  assert.equal(freshCheck.ok, true);
  assert.deepEqual(freshCheck.errors, []);
  assert.equal(freshCheck.compatibility.manifestValid, true);
  assert.equal(freshCheck.manifest.supportedOperations.includes("mutated"), false);
  assert.equal(freshCheck.expectation.supportedOperations.includes("mutated"), false);

  assert.equal(report.summary.externalTargetContacted, false);
  assert.equal(report.summary.changesExecuted, false);
  assert.equal(report.summary.storageUsed, false);
  assert.equal(Object.prototype.hasOwnProperty.call(report.summary, "databaseUsed"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(report.summary, "uiAppBuilt"), false);

  const coreText = read(CORE_FILE);
  assertNoFragments(
    coreText,
    [
      ["B", "rowser"].join(""),
      "HTML",
      "DOM",
      ["Mini", "-Inspector"].join(""),
      ["Host", "-App-", "Demo"].join(""),
      ["Layout", "diagnose"].join(""),
      ["data", "-ui"].join(""),
      ["De", "mo"].join(""),
      ["B", "BM"].join(""),
      ["Proto", "koll"].join(""),
      ["Rest", "arbeiten"].join(""),
      ["T", "OP"].join(""),
      ["Bau", "vorhaben"].join(""),
      "http",
      "fetch",
      "XMLHttpRequest",
      "document.",
      "window.",
      "localStorage",
      "sessionStorage",
      "indexedDB",
      "sqlite",
      "postgres",
      "mysql",
      "mongodb",
      "writeFile",
      "appendFile",
    ],
    CORE_FILE
  );
  assert.equal(read(TEST_FILE).includes("target-app-adapter-manifest-check"), true);

  console.log("TESTS OK: target-app-adapter-manifest-check");
}

run();
