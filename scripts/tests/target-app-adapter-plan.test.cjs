#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  getTargetAppAdapterPlanRequiredInputs,
  getTargetAppAdapterPlanOptionalInputs,
  getTargetAppAdapterPlanAllowedAdapterKinds,
  createTargetAppAdapterPlan,
  createTargetAppAdapterPlanReport,
} = require("../../src/core/target-app-adapter-plan.cjs");
const {
  createNeutralMinimalHostAdapterManifest,
  checkTargetAppAdapterManifestAgainstNeutralMinimalHost,
} = require("../../src/core/target-app-adapter-manifest-check.cjs");
const { evaluateTargetAppAdapterReleaseGate } = require("../../src/core/target-app-adapter-release-gate.cjs");

const REPO_ROOT = path.resolve(__dirname, "../..");
const CORE_FILE = "src/core/target-app-adapter-plan.cjs";
const TEST_FILE = "scripts/tests/target-app-adapter-plan.test.cjs";

function read(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createInputs(overrides = {}) {
  const manifest = Object.prototype.hasOwnProperty.call(overrides, "manifest")
    ? overrides.manifest
    : createNeutralMinimalHostAdapterManifest();
  const manifestCheck = Object.prototype.hasOwnProperty.call(overrides, "manifestCheck")
    ? overrides.manifestCheck
    : checkTargetAppAdapterManifestAgainstNeutralMinimalHost(manifest);
  const releaseGate = Object.prototype.hasOwnProperty.call(overrides, "releaseGate")
    ? overrides.releaseGate
    : evaluateTargetAppAdapterReleaseGate({ manifest, manifestCheck, requestedStep: "prepare-adapter-plan" });

  const inputs = { manifest, manifestCheck, releaseGate };
  Object.keys(overrides).forEach((key) => {
    inputs[key] = overrides[key];
  });
  return inputs;
}

function findIssue(result, code, field) {
  return result.errors.find((error) => error.code === code && (field === undefined || error.field === field));
}

function assertIncludesAll(actual, expected, label) {
  expected.forEach((entry) => {
    assert.ok(actual.includes(entry), `${label} enthaelt ${entry}`);
  });
}

function assertNoFragments(text, fragments, label) {
  fragments.forEach((fragment) => {
    assert.equal(text.includes(fragment), false, `${label} enthaelt gesperrten Fragmenttext: ${fragment}`);
  });
}

function run() {
  assert.equal(typeof getTargetAppAdapterPlanRequiredInputs, "function");
  assert.equal(typeof getTargetAppAdapterPlanOptionalInputs, "function");
  assert.equal(typeof getTargetAppAdapterPlanAllowedAdapterKinds, "function");
  assert.equal(typeof createTargetAppAdapterPlan, "function");
  assert.equal(typeof createTargetAppAdapterPlanReport, "function");

  const requiredInputs = getTargetAppAdapterPlanRequiredInputs();
  assert.deepEqual(requiredInputs, ["manifest", "manifestCheck", "releaseGate"]);
  requiredInputs.push("mutated");
  assert.deepEqual(getTargetAppAdapterPlanRequiredInputs(), ["manifest", "manifestCheck", "releaseGate"]);

  const optionalInputs = getTargetAppAdapterPlanOptionalInputs();
  assert.deepEqual(optionalInputs, ["planId", "requestedAdapterKind", "ownerNote", "constraints", "assumptions"]);
  optionalInputs.push("mutated");
  assert.deepEqual(getTargetAppAdapterPlanOptionalInputs(), [
    "planId",
    "requestedAdapterKind",
    "ownerNote",
    "constraints",
    "assumptions",
  ]);

  const allowedKinds = getTargetAppAdapterPlanAllowedAdapterKinds();
  assert.deepEqual(allowedKinds, ["neutral-test-adapter", "controlled-real-adapter-plan", "manual-review-plan"]);
  allowedKinds.push("mutated");
  assert.deepEqual(getTargetAppAdapterPlanAllowedAdapterKinds(), [
    "neutral-test-adapter",
    "controlled-real-adapter-plan",
    "manual-review-plan",
  ]);

  const inputs = createInputs();
  const inputSnapshot = clone(inputs);
  const planResult = createTargetAppAdapterPlan(inputs);
  assert.equal(planResult.ok, true);
  assert.equal(planResult.plan.planningStatus, "planning-allowed");
  assert.equal(planResult.plan.targetAppId, inputs.manifest.targetAppId);
  assert.equal(planResult.plan.uiScope, inputs.manifest.uiScope);
  assert.equal(planResult.plan.layoutProfileId, inputs.manifest.layoutProfileId);
  assert.equal(planResult.plan.canCreateAdapterFiles, false);
  assert.equal(planResult.plan.canExecute, false);
  assert.equal(planResult.plan.canConnectRealTarget, false);
  assert.equal(planResult.plan.canTouchProductiveData, false);

  const blockedGate = clone(inputs.releaseGate);
  blockedGate.decision = "blocked";
  const blockedResult = createTargetAppAdapterPlan(createInputs({ releaseGate: blockedGate }));
  assert.equal(blockedResult.ok, false);
  assert.equal(blockedResult.plan.planningStatus, "blocked");
  assert.ok(findIssue(blockedResult, "release_gate_blocked", "releaseGate.decision"));

  const manualGate = clone(inputs.releaseGate);
  manualGate.decision = "manual-review-required";
  manualGate.ok = false;
  manualGate.gate.canPlanAdapter = false;
  const manualResult = createTargetAppAdapterPlan(createInputs({ releaseGate: manualGate }));
  assert.equal(manualResult.ok, true);
  assert.equal(manualResult.plan.planningStatus, "manual-review-required");

  const missingManifestResult = createTargetAppAdapterPlan({
    manifestCheck: inputs.manifestCheck,
    releaseGate: inputs.releaseGate,
  });
  assert.equal(missingManifestResult.ok, false);
  assert.equal(missingManifestResult.plan.planningStatus, "blocked");
  assert.ok(findIssue(missingManifestResult, "missing_manifest", "manifest"));

  const missingCheckResult = createTargetAppAdapterPlan({ manifest: inputs.manifest, releaseGate: inputs.releaseGate });
  assert.equal(missingCheckResult.ok, false);
  assert.equal(missingCheckResult.plan.planningStatus, "blocked");
  assert.ok(findIssue(missingCheckResult, "missing_manifest_check", "manifestCheck"));

  const missingGateResult = createTargetAppAdapterPlan({ manifest: inputs.manifest, manifestCheck: inputs.manifestCheck });
  assert.equal(missingGateResult.ok, false);
  assert.equal(missingGateResult.plan.planningStatus, "blocked");
  assert.ok(findIssue(missingGateResult, "missing_release_gate", "releaseGate"));

  const failedCheck = clone(inputs.manifestCheck);
  failedCheck.ok = false;
  const failedCheckResult = createTargetAppAdapterPlan(createInputs({ manifestCheck: failedCheck }));
  assert.equal(failedCheckResult.ok, false);
  assert.equal(failedCheckResult.plan.planningStatus, "blocked");
  assert.ok(findIssue(failedCheckResult, "manifest_check_failed", "manifestCheck.ok"));

  const executableGate = clone(inputs.releaseGate);
  executableGate.gate.canExecute = true;
  const executableResult = createTargetAppAdapterPlan(createInputs({ releaseGate: executableGate }));
  assert.equal(executableResult.ok, false);
  assert.equal(executableResult.plan.planningStatus, "blocked");
  assert.ok(findIssue(executableResult, "execution_not_blocked", "releaseGate.gate.canExecute"));
  assert.equal(executableResult.plan.canExecute, false);

  const connectingGate = clone(inputs.releaseGate);
  connectingGate.gate.canConnectRealTarget = true;
  const connectingResult = createTargetAppAdapterPlan(createInputs({ releaseGate: connectingGate }));
  assert.equal(connectingResult.ok, false);
  assert.equal(connectingResult.plan.planningStatus, "blocked");
  assert.ok(findIssue(connectingResult, "real_target_connection_not_blocked", "releaseGate.gate.canConnectRealTarget"));
  assert.equal(connectingResult.plan.canConnectRealTarget, false);

  const unknownKindResult = createTargetAppAdapterPlan(createInputs({ requestedAdapterKind: "unknown-kind" }));
  assert.equal(unknownKindResult.ok, false);
  assert.equal(unknownKindResult.plan.planningStatus, "blocked");
  assert.ok(findIssue(unknownKindResult, "invalid_requested_adapter_kind", "requestedAdapterKind"));

  const controlledPlanResult = createTargetAppAdapterPlan(
    createInputs({ requestedAdapterKind: "controlled-real-adapter-plan" })
  );
  assert.equal(controlledPlanResult.ok, true);
  assert.equal(controlledPlanResult.plan.requestedAdapterKind, "controlled-real-adapter-plan");
  assert.equal(controlledPlanResult.plan.canCreateAdapterFiles, false);
  assert.equal(controlledPlanResult.plan.canExecute, false);
  assert.equal(controlledPlanResult.plan.canConnectRealTarget, false);
  assert.ok(
    controlledPlanResult.warnings.find(
      (warning) => warning.code === "controlled_real_adapter_plan_is_not_implementation"
    )
  );

  assert.deepEqual(planResult.plan.allowedPlanningSteps, [
    "review-manifest",
    "review-element-allowlist",
    "review-operation-allowlist",
    "review-locked-operations",
    "review-risk-class",
    "define-adapter-test-strategy",
  ]);
  assertIncludesAll(
    planResult.plan.blockedActions,
    ["create-real-adapter", "connect-real-target-app", "execute-change-request"],
    "blockedActions"
  );
  assertIncludesAll(
    planResult.plan.requiredConfirmations,
    ["no-productive-execution", "no-domain-data"],
    "requiredConfirmations"
  );
  assert.ok(planResult.plan.requiredTests.includes("no-execution-regression-test"));
  assertIncludesAll(planResult.plan.requiredDocuments, [
    "docs/ZIEL_APP_AUSWAHL.md",
    "docs/ZIEL_APP_ADAPTER_REGELN.md",
  ], "requiredDocuments");

  const report = createTargetAppAdapterPlanReport(inputs);
  assert.equal(report.ok, true);
  assert.equal(report.planningStatus, "planning-allowed");
  assert.equal(typeof report.summary, "object");
  assert.ok(Array.isArray(report.errors));
  assert.ok(Array.isArray(report.warnings));
  assert.equal(typeof report.plan, "object");
  assert.equal(report.summary.realTargetAppConnected, false);
  assert.equal(report.summary.adapterFilesCreated, false);
  assert.equal(report.summary.productiveExecutionApproved, false);
  assert.equal(report.summary.changeExecuted, false);
  assert.equal(report.summary.domainDataProcessed, false);
  assert.equal(report.summary.planningBasisCreated, true);
  assert.ok(report.summary.statements.includes("Keine echte Ziel-App wurde angebunden."));
  assert.ok(report.summary.statements.includes("Keine Adapterdateien wurden erzeugt."));
  assert.ok(report.summary.statements.includes("Keine produktive Ausfuehrung wurde freigegeben."));

  assert.deepEqual(inputs, inputSnapshot);
  planResult.plan.allowedPlanningSteps.push("mutated");
  planResult.plan.blockedActions.push("mutated");
  planResult.plan.requiredConfirmations.push("mutated");
  planResult.plan.requiredTests.push("mutated");
  planResult.plan.requiredDocuments.push("mutated");
  const nextPlanResult = createTargetAppAdapterPlan(inputs);
  assert.equal(nextPlanResult.plan.allowedPlanningSteps.includes("mutated"), false);
  assert.equal(nextPlanResult.plan.blockedActions.includes("mutated"), false);
  assert.equal(nextPlanResult.plan.requiredConfirmations.includes("mutated"), false);
  assert.equal(nextPlanResult.plan.requiredTests.includes("mutated"), false);
  assert.equal(nextPlanResult.plan.requiredDocuments.includes("mutated"), false);

  assert.equal(nextPlanResult.gateSummary.canExecute, false);
  assert.equal(nextPlanResult.gateSummary.canConnectRealTarget, false);
  assert.equal(nextPlanResult.checkSummary.productiveExecutionBlocked, true);
  assert.equal(nextPlanResult.plan.persistenceMode, "none");
  assert.equal(nextPlanResult.plan.executionMode, "planning-only");
  assert.equal(nextPlanResult.plan.canCreateAdapterFiles, false);
  assert.equal(nextPlanResult.plan.canExecute, false);
  assert.equal(nextPlanResult.plan.canConnectRealTarget, false);
  assert.equal(nextPlanResult.plan.canTouchProductiveData, false);
  assert.equal(report.summary.realTargetAppConnected, false);
  assert.equal(report.summary.changeExecuted, false);
  assert.equal(report.summary.adapterFilesCreated, false);
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
      "sqlite",
      "database",
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
  assert.equal(testText.includes("target-app-adapter-plan.cjs"), true);

  console.log("TESTS OK: target-app-adapter-plan");
}

run();
