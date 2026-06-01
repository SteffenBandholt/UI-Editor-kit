#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  getTargetAppAdapterPlanSafetyRequiredInputs,
  getTargetAppAdapterPlanSafetyOptionalInputs,
  getTargetAppAdapterPlanSafetyRequiredBlockedActions,
  getTargetAppAdapterPlanSafetyRequiredConfirmations,
  getTargetAppAdapterPlanSafetyRequiredTests,
  getTargetAppAdapterPlanSafetyRequiredDocuments,
  checkTargetAppAdapterPlanSafety,
  createTargetAppAdapterPlanSafetyReport,
} = require("../../src/core/target-app-adapter-plan-safety-check.cjs");
const { createTargetAppAdapterPlan } = require("../../src/core/target-app-adapter-plan.cjs");
const {
  createNeutralMinimalHostAdapterManifest,
  checkTargetAppAdapterManifestAgainstNeutralMinimalHost,
} = require("../../src/core/target-app-adapter-manifest-check.cjs");
const { evaluateTargetAppAdapterReleaseGate } = require("../../src/core/target-app-adapter-release-gate.cjs");

const REPO_ROOT = path.resolve(__dirname, "../..");
const CORE_FILE = "src/core/target-app-adapter-plan-safety-check.cjs";
const TEST_FILE = "scripts/tests/target-app-adapter-plan-safety-check.test.cjs";

function read(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createAdapterPlan(overrides = {}) {
  const manifest = createNeutralMinimalHostAdapterManifest();
  const manifestCheck = checkTargetAppAdapterManifestAgainstNeutralMinimalHost(manifest);
  const releaseGate = evaluateTargetAppAdapterReleaseGate({ manifest, manifestCheck, requestedStep: "prepare-adapter-plan" });
  const adapterPlan = createTargetAppAdapterPlan({ manifest, manifestCheck, releaseGate });

  Object.keys(overrides).forEach((key) => {
    if (key === "plan") {
      adapterPlan.plan = Object.assign({}, adapterPlan.plan, overrides.plan);
      return;
    }
    adapterPlan[key] = overrides[key];
  });

  return adapterPlan;
}

function createInputs(overrides = {}) {
  return { adapterPlan: createAdapterPlan(overrides) };
}

function findError(result, code, fieldPart) {
  return result.errors.find(
    (error) => error.code === code && (fieldPart === undefined || String(error.field).includes(fieldPart))
  );
}

function assertArrayCopy(getter, expected) {
  const first = getter();
  assert.deepEqual(first, expected);
  first.push("mutated");
  assert.deepEqual(getter(), expected);
}

function assertMissingPlanEntry(listName, removedEntry, expectedCode) {
  const adapterPlan = createAdapterPlan();
  adapterPlan.plan[listName] = adapterPlan.plan[listName].filter((entry) => entry !== removedEntry);
  const result = checkTargetAppAdapterPlanSafety({ adapterPlan });
  assert.equal(result.ok, false);
  assert.ok(findError(result, expectedCode, removedEntry));
}

function assertNoFragments(text, fragments, label) {
  fragments.forEach((fragment) => {
    assert.equal(text.includes(fragment), false, `${label} enthaelt gesperrten Fragmenttext: ${fragment}`);
  });
}

function run() {
  assert.equal(typeof getTargetAppAdapterPlanSafetyRequiredInputs, "function");
  assert.equal(typeof getTargetAppAdapterPlanSafetyOptionalInputs, "function");
  assert.equal(typeof getTargetAppAdapterPlanSafetyRequiredBlockedActions, "function");
  assert.equal(typeof getTargetAppAdapterPlanSafetyRequiredConfirmations, "function");
  assert.equal(typeof getTargetAppAdapterPlanSafetyRequiredTests, "function");
  assert.equal(typeof getTargetAppAdapterPlanSafetyRequiredDocuments, "function");
  assert.equal(typeof checkTargetAppAdapterPlanSafety, "function");
  assert.equal(typeof createTargetAppAdapterPlanSafetyReport, "function");

  assertArrayCopy(getTargetAppAdapterPlanSafetyRequiredInputs, ["adapterPlan"]);
  assertArrayCopy(getTargetAppAdapterPlanSafetyOptionalInputs, ["safetyProfile", "reviewerNote", "acceptedWarnings"]);
  assertArrayCopy(getTargetAppAdapterPlanSafetyRequiredBlockedActions, [
    "create-real-adapter",
    "connect-real-target-app",
    "execute-change-request",
    "write-productive-data",
    "store-domain-data",
    "bypass-release-gate",
  ]);
  assertArrayCopy(getTargetAppAdapterPlanSafetyRequiredConfirmations, [
    "manifest-reviewed",
    "manifest-check-reviewed",
    "release-gate-reviewed",
    "no-productive-execution",
    "no-domain-data",
    "no-real-target-connection",
  ]);
  assertArrayCopy(getTargetAppAdapterPlanSafetyRequiredTests, [
    "adapter-contract-test",
    "manifest-validation-test",
    "manifest-check-test",
    "release-gate-test",
    "no-execution-regression-test",
  ]);
  assertArrayCopy(getTargetAppAdapterPlanSafetyRequiredDocuments, [
    "docs/ZIEL_APP_AUSWAHL.md",
    "docs/ZIEL_APP_ADAPTER_REGELN.md",
  ]);

  const inputs = createInputs();
  const inputSnapshot = clone(inputs);
  const result = checkTargetAppAdapterPlanSafety(inputs);
  assert.equal(result.ok, true);
  assert.equal(result.safety.safeForPlanningOnly, true);
  assert.equal(result.safety.planPresent, true);
  assert.equal(result.safety.planningStatusAllowed, true);
  assert.equal(result.safety.adapterFileCreationBlocked, true);
  assert.equal(result.safety.executionBlocked, true);
  assert.equal(result.safety.realTargetConnectionBlocked, true);
  assert.equal(result.safety.productiveDataBlocked, true);
  assert.equal(result.safety.requiredBlockedActionsPresent, true);
  assert.equal(result.safety.requiredConfirmationsPresent, true);
  assert.equal(result.safety.requiredTestsPresent, true);
  assert.equal(result.safety.requiredDocumentsPresent, true);
  assert.equal(result.safety.releaseGateBypassBlocked, true);
  assert.equal(result.safety.noRuntimeImplementation, true);
  assert.equal(result.safety.noProductiveApproval, true);
  assert.equal(result.planSummary.planningStatus, "planning-allowed");
  assert.equal(result.planSummary.canCreateAdapterFiles, false);
  assert.equal(result.planSummary.canExecute, false);
  assert.equal(result.planSummary.canConnectRealTarget, false);
  assert.equal(result.planSummary.canTouchProductiveData, false);

  const adapterFileResult = checkTargetAppAdapterPlanSafety(createInputs({ plan: { canCreateAdapterFiles: true } }));
  assert.equal(adapterFileResult.ok, false);
  assert.ok(findError(adapterFileResult, "adapter_file_creation_not_blocked", "canCreateAdapterFiles"));

  const executionResult = checkTargetAppAdapterPlanSafety(createInputs({ plan: { canExecute: true } }));
  assert.equal(executionResult.ok, false);
  assert.ok(findError(executionResult, "execution_not_blocked", "canExecute"));

  const connectionResult = checkTargetAppAdapterPlanSafety(createInputs({ plan: { canConnectRealTarget: true } }));
  assert.equal(connectionResult.ok, false);
  assert.ok(findError(connectionResult, "real_target_connection_not_blocked", "canConnectRealTarget"));

  const dataResult = checkTargetAppAdapterPlanSafety(createInputs({ plan: { canTouchProductiveData: true } }));
  assert.equal(dataResult.ok, false);
  assert.ok(findError(dataResult, "productive_data_not_blocked", "canTouchProductiveData"));

  assertMissingPlanEntry("blockedActions", "create-real-adapter", "missing_blocked_action");
  assertMissingPlanEntry("blockedActions", "connect-real-target-app", "missing_blocked_action");
  assertMissingPlanEntry("blockedActions", "execute-change-request", "missing_blocked_action");
  assertMissingPlanEntry("blockedActions", "bypass-release-gate", "missing_blocked_action");
  const missingGateBypass = createAdapterPlan();
  missingGateBypass.plan.blockedActions = missingGateBypass.plan.blockedActions.filter(
    (entry) => entry !== "bypass-release-gate"
  );
  const missingGateBypassResult = checkTargetAppAdapterPlanSafety({ adapterPlan: missingGateBypass });
  assert.ok(findError(missingGateBypassResult, "release_gate_bypass_not_blocked", "bypass-release-gate"));

  assertMissingPlanEntry("requiredConfirmations", "no-productive-execution", "missing_required_confirmation");
  assertMissingPlanEntry("requiredConfirmations", "no-domain-data", "missing_required_confirmation");
  assertMissingPlanEntry("requiredTests", "no-execution-regression-test", "missing_required_test");
  assertMissingPlanEntry("requiredDocuments", "docs/ZIEL_APP_ADAPTER_REGELN.md", "missing_required_document");

  const blockedResult = checkTargetAppAdapterPlanSafety(createInputs({ plan: { planningStatus: "blocked" } }));
  assert.equal(blockedResult.ok, false);
  assert.ok(findError(blockedResult, "planning_blocked", "planningStatus"));

  const manualResult = checkTargetAppAdapterPlanSafety(createInputs({ plan: { planningStatus: "manual-review-required" } }));
  assert.equal(manualResult.ok, false);
  assert.ok(findError(manualResult, "manual_review_required", "planningStatus"));

  const productiveExecutionResult = checkTargetAppAdapterPlanSafety(createInputs({ plan: { executionMode: "productive" } }));
  assert.equal(productiveExecutionResult.ok, false);
  assert.ok(findError(productiveExecutionResult, "productive_execution_not_allowed", "executionMode"));

  const productivePersistenceResult = checkTargetAppAdapterPlanSafety(createInputs({ plan: { persistenceMode: "productive" } }));
  assert.equal(productivePersistenceResult.ok, false);
  assert.ok(findError(productivePersistenceResult, "productive_persistence_not_allowed", "persistenceMode"));

  const report = createTargetAppAdapterPlanSafetyReport(inputs);
  assert.equal(report.ok, true);
  assert.equal(typeof report.summary, "object");
  assert.ok(Array.isArray(report.errors));
  assert.ok(Array.isArray(report.warnings));
  assert.equal(typeof report.safety, "object");
  assert.equal(typeof report.planSummary, "object");
  assert.equal(report.summary.realTargetAppConnected, false);
  assert.equal(report.summary.adapterFilesCreated, false);
  assert.equal(report.summary.productiveExecutionApproved, false);
  assert.equal(report.summary.changeExecuted, false);
  assert.equal(report.summary.domainDataProcessed, false);
  assert.equal(report.summary.planningOnlyChecked, true);
  assert.equal(report.summary.releaseGateRequired, true);
  assert.ok(report.summary.statements.includes("Keine echte Ziel-App wurde angebunden."));
  assert.ok(report.summary.statements.includes("Keine Adapterdateien wurden erzeugt."));
  assert.ok(report.summary.statements.includes("Keine produktive Ausfuehrung wurde freigegeben."));
  assert.ok(report.summary.statements.includes("Release-Gate bleibt verbindlich."));

  assert.deepEqual(inputs, inputSnapshot);
  result.errors.push({ code: "mutated" });
  result.warnings.push({ code: "mutated" });
  result.safety.safeForPlanningOnly = false;
  result.planSummary.planId = "mutated";
  const nextResult = checkTargetAppAdapterPlanSafety(inputs);
  assert.equal(nextResult.errors.find((error) => error.code === "mutated"), undefined);
  assert.equal(nextResult.warnings.find((warning) => warning.code === "mutated"), undefined);
  assert.equal(nextResult.safety.safeForPlanningOnly, true);
  assert.notEqual(nextResult.planSummary.planId, "mutated");

  assert.equal(nextResult.planSummary.canConnectRealTarget, false);
  assert.equal(nextResult.planSummary.canExecute, false);
  assert.equal(nextResult.planSummary.executionMode, "planning-only");
  assert.equal(nextResult.planSummary.persistenceMode, "none");
  assert.equal(report.summary.adapterFilesCreated, false);
  assert.equal(report.summary.changeExecuted, false);
  assert.equal(report.summary.realTargetAppConnected, false);
  assert.equal(report.summary.domainDataProcessed, false);

  const coreText = read(CORE_FILE);
  assertNoFragments(
    coreText,
    [
      "window",
      "document.",
      "querySelector",
      "localStorage",
      "fetch(",
      "XMLHttpRequest",
      "require(\"node:fs\")",
      "require('node:fs')",
      "require(\"fs\")",
      "require('fs')",
      "writeFile",
      "appendFile",
      "sqlite",
      "database",
      "layout-state-store",
      "data-ui",
      "Mini-Inspector",
      "Host-App-" + "Demo",
      "Layoutdiagnose",
      "De" + "mo",
      "BB" + "M",
      "Pro" + "tokoll",
      "Rest" + "arbeiten",
      "TO" + "P",
      "Bau" + "vorhaben",
      "HT" + "ML",
      "D" + "OM",
      "Browser",
    ],
    CORE_FILE
  );

  const testText = read(TEST_FILE);
  assert.equal(testText.includes("target-app-adapter-plan-safety-check.cjs"), true);

  console.log("TESTS OK: target-app-adapter-plan-safety-check");
}

run();
