#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  createNeutralMinimalHostAdapterManifest,
  checkTargetAppAdapterManifestAgainstNeutralMinimalHost,
} = require("../../src/core/target-app-adapter-manifest-check.cjs");
const {
  getTargetAppAdapterReleaseGateRequiredInputs,
  getTargetAppAdapterReleaseGateOptionalInputs,
  getTargetAppAdapterReleaseGateAllowedSteps,
  evaluateTargetAppAdapterReleaseGate,
  createTargetAppAdapterReleaseGateReport,
} = require("../../src/core/target-app-adapter-release-gate.cjs");

const REPO_ROOT = path.resolve(__dirname, "../..");
const CORE_FILE = path.join(REPO_ROOT, "src/core/target-app-adapter-release-gate.cjs");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createStandardInputs(overrides) {
  const manifest = createNeutralMinimalHostAdapterManifest(overrides && overrides.manifestValues);
  const manifestCheck = checkTargetAppAdapterManifestAgainstNeutralMinimalHost(manifest);
  return {
    manifest,
    manifestCheck: overrides && overrides.manifestCheck ? overrides.manifestCheck(manifestCheck) : manifestCheck,
    ...(overrides && overrides.inputValues ? overrides.inputValues : {}),
  };
}

function findIssue(result, code, field) {
  return result.errors.concat(result.warnings).find((issue) => {
    if (field === undefined) {
      return issue.code === code;
    }
    return issue.code === code && issue.field === field;
  });
}

function readCore() {
  return fs.readFileSync(CORE_FILE, "utf8");
}

function assertDoesNotContainAny(text, forbiddenTerms, label) {
  forbiddenTerms.forEach((term) => {
    assert.equal(text.includes(term), false, `${label} enthaelt gesperrten Begriff oder gesperrte Abhaengigkeit: ${term}`);
  });
}

function run() {
  assert.equal(typeof getTargetAppAdapterReleaseGateRequiredInputs, "function");
  assert.equal(typeof getTargetAppAdapterReleaseGateOptionalInputs, "function");
  assert.equal(typeof getTargetAppAdapterReleaseGateAllowedSteps, "function");
  assert.equal(typeof evaluateTargetAppAdapterReleaseGate, "function");
  assert.equal(typeof createTargetAppAdapterReleaseGateReport, "function");

  const requiredInputs = getTargetAppAdapterReleaseGateRequiredInputs();
  assert.deepEqual(requiredInputs, ["manifest", "manifestCheck"]);
  requiredInputs.push("mutated");
  assert.deepEqual(getTargetAppAdapterReleaseGateRequiredInputs(), ["manifest", "manifestCheck"]);

  const optionalInputs = getTargetAppAdapterReleaseGateOptionalInputs();
  assert.deepEqual(optionalInputs, ["requestedStep", "riskAcceptance", "notes"]);
  optionalInputs.push("mutated");
  assert.deepEqual(getTargetAppAdapterReleaseGateOptionalInputs(), ["requestedStep", "riskAcceptance", "notes"]);

  const allowedSteps = getTargetAppAdapterReleaseGateAllowedSteps();
  assert.deepEqual(allowedSteps, ["none", "prepare-adapter-plan", "prepare-test-adapter", "manual-review"]);
  allowedSteps.push("mutated");
  assert.deepEqual(getTargetAppAdapterReleaseGateAllowedSteps(), [
    "none",
    "prepare-adapter-plan",
    "prepare-test-adapter",
    "manual-review",
  ]);
  assert.equal(getTargetAppAdapterReleaseGateAllowedSteps().includes("execute"), false);
  assert.equal(getTargetAppAdapterReleaseGateAllowedSteps().includes("production-approved"), false);
  assert.equal(getTargetAppAdapterReleaseGateAllowedSteps().includes("target-app-connected"), false);

  const standardInputs = createStandardInputs();
  const standardResult = evaluateTargetAppAdapterReleaseGate(standardInputs);
  assert.equal(standardResult.ok, true);
  assert.equal(standardResult.decision, "adapter-planning-allowed");
  assert.equal(standardResult.gate.canPlanAdapter, true);
  assert.equal(standardResult.gate.canExecute, false);
  assert.equal(standardResult.gate.canConnectRealTarget, false);
  assert.equal(standardResult.nextStep, "prepare-adapter-plan");
  assert.deepEqual(standardResult.manifestSummary, {
    targetAppId: standardInputs.manifest.targetAppId,
    adapterName: standardInputs.manifest.adapterName,
    adapterVersion: standardInputs.manifest.adapterVersion,
    uiScope: standardInputs.manifest.uiScope,
    layoutProfileId: standardInputs.manifest.layoutProfileId,
    executionMode: standardInputs.manifest.executionMode,
    persistenceMode: standardInputs.manifest.persistenceMode,
    riskClass: standardInputs.manifest.riskClass,
  });
  assert.equal(standardResult.checkSummary.productiveExecutionBlocked, true);

  const missingManifest = evaluateTargetAppAdapterReleaseGate({ manifestCheck: standardInputs.manifestCheck });
  assert.equal(missingManifest.ok, false);
  assert.equal(missingManifest.decision, "blocked");
  assert.ok(findIssue(missingManifest, "missing_manifest", "manifest"));

  const missingCheck = evaluateTargetAppAdapterReleaseGate({ manifest: standardInputs.manifest });
  assert.equal(missingCheck.ok, false);
  assert.equal(missingCheck.decision, "blocked");
  assert.ok(findIssue(missingCheck, "missing_manifest_check", "manifestCheck"));

  const failedCheck = createStandardInputs({
    manifestCheck: (manifestCheck) => ({ ...manifestCheck, ok: false }),
  });
  const failedCheckResult = evaluateTargetAppAdapterReleaseGate(failedCheck);
  assert.equal(failedCheckResult.ok, false);
  assert.equal(failedCheckResult.decision, "blocked");
  assert.ok(findIssue(failedCheckResult, "manifest_not_compatible", "manifestCheck.ok"));

  const notBlockedExecution = createStandardInputs({
    manifestCheck: (manifestCheck) => ({
      ...manifestCheck,
      compatibility: { ...manifestCheck.compatibility, productiveExecutionBlocked: false },
    }),
  });
  const notBlockedExecutionResult = evaluateTargetAppAdapterReleaseGate(notBlockedExecution);
  assert.equal(notBlockedExecutionResult.ok, false);
  assert.equal(notBlockedExecutionResult.decision, "blocked");
  assert.equal(notBlockedExecutionResult.gate.canExecute, false);
  assert.ok(
    findIssue(
      notBlockedExecutionResult,
      "productive_execution_not_blocked",
      "manifestCheck.compatibility.productiveExecutionBlocked"
    )
  );

  const unsafePersistence = createStandardInputs({
    manifestCheck: (manifestCheck) => ({
      ...manifestCheck,
      compatibility: { ...manifestCheck.compatibility, persistenceModeAllowed: false },
    }),
  });
  const unsafePersistenceResult = evaluateTargetAppAdapterReleaseGate(unsafePersistence);
  assert.equal(unsafePersistenceResult.ok, false);
  assert.equal(unsafePersistenceResult.decision, "blocked");
  assert.ok(findIssue(unsafePersistenceResult, "persistence_mode_not_safe", "manifestCheck.compatibility.persistenceModeAllowed"));

  const blockedRisk = createStandardInputs({ manifestValues: { riskClass: "blocked" } });
  const blockedRiskResult = evaluateTargetAppAdapterReleaseGate(blockedRisk);
  assert.equal(blockedRiskResult.ok, false);
  assert.equal(blockedRiskResult.decision, "blocked");
  assert.equal(blockedRiskResult.gate.canPlanAdapter, false);
  assert.ok(findIssue(blockedRiskResult, "risk_blocked", "manifest.riskClass"));

  const highRisk = createStandardInputs({ manifestValues: { riskClass: "high" } });
  const highRiskResult = evaluateTargetAppAdapterReleaseGate(highRisk);
  assert.equal(highRiskResult.ok, false);
  assert.equal(highRiskResult.decision, "manual-review-required");
  assert.equal(highRiskResult.gate.canExecute, false);
  assert.equal(highRiskResult.gate.canConnectRealTarget, false);
  assert.ok(findIssue(highRiskResult, "high_risk_class", "manifest.riskClass"));
  assert.ok(findIssue(highRiskResult, "manual_review_required", "manifest.riskClass"));

  const invalidStep = evaluateTargetAppAdapterReleaseGate({ ...standardInputs, requestedStep: "connect-real-target" });
  assert.equal(invalidStep.ok, false);
  assert.equal(invalidStep.decision, "blocked");
  assert.ok(findIssue(invalidStep, "invalid_requested_step", "requestedStep"));

  const planStep = evaluateTargetAppAdapterReleaseGate({ ...standardInputs, requestedStep: "prepare-adapter-plan" });
  assert.equal(planStep.ok, true);
  assert.equal(planStep.nextStep, "prepare-adapter-plan");
  assert.equal(planStep.gate.canExecute, false);
  assert.equal(planStep.gate.canConnectRealTarget, false);
  assert.ok(findIssue(planStep, "adapter_planning_only", "requestedStep"));

  const testStep = evaluateTargetAppAdapterReleaseGate({ ...standardInputs, requestedStep: "prepare-test-adapter" });
  assert.equal(testStep.ok, true);
  assert.equal(testStep.nextStep, "prepare-test-adapter");
  assert.equal(testStep.gate.canExecute, false);
  assert.equal(testStep.gate.canConnectRealTarget, false);
  assert.ok(findIssue(testStep, "adapter_planning_only", "requestedStep"));

  const report = createTargetAppAdapterReleaseGateReport(standardInputs);
  assert.equal(typeof report.summary, "object");
  assert.equal(Array.isArray(report.errors), true);
  assert.equal(Array.isArray(report.warnings), true);
  assert.equal(typeof report.gate, "object");
  assert.equal(report.nextStep, "prepare-adapter-plan");
  assert.equal(report.summary.realTargetAppConnected, false);
  assert.equal(report.summary.productiveExecutionApproved, false);
  assert.ok(report.summary.statements.includes("Keine echte Ziel-App wurde angebunden."));
  assert.ok(report.summary.statements.includes("Keine produktive Ausfuehrung wurde freigegeben."));
  assert.ok(report.summary.statements.includes("Keine Aenderung wurde ausgefuehrt."));
  assert.ok(report.summary.statements.includes("Nur Adapter-Planung ist moeglich, wenn das Gate ok ist."));

  const mutationInputs = createStandardInputs({ inputValues: { notes: { marker: "before" } } });
  const beforeMutation = clone(mutationInputs);
  const mutationResult = evaluateTargetAppAdapterReleaseGate(mutationInputs);
  assert.deepEqual(mutationInputs, beforeMutation);
  mutationResult.errors.push({ code: "mutated", message: "mutated" });
  mutationResult.warnings.push({ code: "mutated", message: "mutated" });
  mutationResult.gate.canExecute = true;
  mutationResult.gate.canConnectRealTarget = true;
  mutationResult.manifestSummary.targetAppId = "mutated";
  mutationResult.checkSummary.productiveExecutionBlocked = false;
  const freshMutationResult = evaluateTargetAppAdapterReleaseGate(mutationInputs);
  assert.equal(freshMutationResult.errors.length, 0);
  assert.equal(freshMutationResult.gate.canExecute, false);
  assert.equal(freshMutationResult.gate.canConnectRealTarget, false);
  assert.equal(freshMutationResult.manifestSummary.targetAppId, mutationInputs.manifest.targetAppId);
  assert.equal(freshMutationResult.checkSummary.productiveExecutionBlocked, true);

  const coreText = readCore();
  assertDoesNotContainAny(
    coreText,
    ["http", "https", "fetch", "XMLHttpRequest", "WebSocket", "net.", "node:net", "node:http", "node:https"],
    "Release-Gate-Core"
  );
  assertDoesNotContainAny(
    coreText,
    ["executeChange", "applyChange", "commitChange", "writeFile", "appendFile", "createWriteStream"],
    "Release-Gate-Core"
  );
  assertDoesNotContainAny(coreText, ["layout-state-store.cjs", "createLayoutStateStore", "saveLayout"], "Release-Gate-Core");
  assertDoesNotContainAny(coreText, ["database", "sql", "sqlite", "postgres", "mysql"], "Release-Gate-Core");
  assertDoesNotContainAny(coreText, ["createElement", "render", "mount", "component"], "Release-Gate-Core");
  assertDoesNotContainAny(
    coreText,
    ["B" + "BM", "Pro" + "tokoll", "Rest" + "arbeiten", "T" + "OP", "Bau" + "vorhaben"],
    "Release-Gate-Core"
  );
  assertDoesNotContainAny(
    coreText,
    ["Browser", "browser", "HTML", "html", "DOM", "Mini-Inspector", "Host-App-Demo", "Layoutdiagnose", "data-ui", "Demo"],
    "Release-Gate-Core"
  );

  console.log("TESTS OK: target-app-adapter-release-gate");
}

run();
