"use strict";

const TARGET_APP_ADAPTER_RELEASE_GATE_REQUIRED_INPUTS = Object.freeze(["manifest", "manifestCheck"]);
const TARGET_APP_ADAPTER_RELEASE_GATE_OPTIONAL_INPUTS = Object.freeze(["requestedStep", "riskAcceptance", "notes"]);
const TARGET_APP_ADAPTER_RELEASE_GATE_ALLOWED_STEPS = Object.freeze([
  "none",
  "prepare-adapter-plan",
  "prepare-test-adapter",
  "manual-review",
]);

function cloneGateValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneGateValue(entry));
  }

  if (value && typeof value === "object") {
    const clone = {};
    Object.keys(value).forEach((key) => {
      clone[key] = cloneGateValue(value[key]);
    });
    return clone;
  }

  return value;
}

function isGateObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function createGateIssue(code, message, field) {
  const issue = { code, message };

  if (field !== undefined) {
    issue.field = field;
  }

  return issue;
}

function getTargetAppAdapterReleaseGateRequiredInputs() {
  return TARGET_APP_ADAPTER_RELEASE_GATE_REQUIRED_INPUTS.slice();
}

function getTargetAppAdapterReleaseGateOptionalInputs() {
  return TARGET_APP_ADAPTER_RELEASE_GATE_OPTIONAL_INPUTS.slice();
}

function getTargetAppAdapterReleaseGateAllowedSteps() {
  return TARGET_APP_ADAPTER_RELEASE_GATE_ALLOWED_STEPS.slice();
}

function createManifestSummary(manifest) {
  const manifestSource = isGateObject(manifest) ? manifest : {};

  return cloneGateValue({
    targetAppId: manifestSource.targetAppId,
    adapterName: manifestSource.adapterName,
    adapterVersion: manifestSource.adapterVersion,
    uiScope: manifestSource.uiScope,
    layoutProfileId: manifestSource.layoutProfileId,
    executionMode: manifestSource.executionMode,
    persistenceMode: manifestSource.persistenceMode,
    riskClass: manifestSource.riskClass,
  });
}

function createCheckSummary(manifestCheck) {
  const compatibility = isGateObject(manifestCheck) && isGateObject(manifestCheck.compatibility) ? manifestCheck.compatibility : {};

  return cloneGateValue({
    manifestValid: Boolean(compatibility.manifestValid),
    targetAppMatches: Boolean(compatibility.targetAppMatches),
    uiScopeMatches: Boolean(compatibility.uiScopeMatches),
    layoutProfileMatches: Boolean(compatibility.layoutProfileMatches),
    elementTypesCovered: Boolean(compatibility.elementTypesCovered),
    rolesCovered: Boolean(compatibility.rolesCovered),
    operationsCovered: Boolean(compatibility.operationsCovered),
    lockedOperationsCovered: Boolean(compatibility.lockedOperationsCovered),
    executionModeAllowed: Boolean(compatibility.executionModeAllowed),
    persistenceModeAllowed: Boolean(compatibility.persistenceModeAllowed),
    productiveExecutionBlocked: Boolean(compatibility.productiveExecutionBlocked),
  });
}

function allCheckSummaryFlagsSafe(checkSummary) {
  return (
    checkSummary.manifestValid &&
    checkSummary.targetAppMatches &&
    checkSummary.uiScopeMatches &&
    checkSummary.layoutProfileMatches &&
    checkSummary.elementTypesCovered &&
    checkSummary.rolesCovered &&
    checkSummary.operationsCovered &&
    checkSummary.lockedOperationsCovered &&
    checkSummary.executionModeAllowed &&
    checkSummary.persistenceModeAllowed &&
    checkSummary.productiveExecutionBlocked
  );
}

function resolveRequestedStep(inputs, errors) {
  const requestedStep = Object.prototype.hasOwnProperty.call(inputs, "requestedStep") ? inputs.requestedStep : "none";

  if (!TARGET_APP_ADAPTER_RELEASE_GATE_ALLOWED_STEPS.includes(requestedStep)) {
    errors.push(createGateIssue("invalid_requested_step", "requestedStep ist fuer das Adapter-Manifest-Gate nicht erlaubt.", "requestedStep"));
    return "none";
  }

  return requestedStep;
}

function resolveNextStep(decision, requestedStep) {
  if (decision === "blocked") {
    return "none";
  }

  if (decision === "manual-review-required") {
    return "manual-review";
  }

  if (requestedStep === "none" || requestedStep === "manual-review") {
    return "prepare-adapter-plan";
  }

  return requestedStep;
}

function evaluateTargetAppAdapterReleaseGate(inputs) {
  const errors = [];
  const warnings = [];
  const safeInputs = isGateObject(inputs) ? cloneGateValue(inputs) : {};

  if (!isGateObject(inputs)) {
    errors.push(createGateIssue("invalid_release_gate_inputs", "Adapter-Manifest-Gate erwartet ein Eingabeobjekt."));
  }

  const requestedStep = resolveRequestedStep(safeInputs, errors);
  const manifestPresent = isGateObject(safeInputs.manifest);
  const manifestCheckPresent = isGateObject(safeInputs.manifestCheck);

  if (!manifestPresent) {
    errors.push(createGateIssue("missing_manifest", "Adapter-Manifest fehlt.", "manifest"));
  }

  if (!manifestCheckPresent) {
    errors.push(createGateIssue("missing_manifest_check", "Adapter-Manifest-Check fehlt.", "manifestCheck"));
  }

  const manifestSummary = createManifestSummary(safeInputs.manifest);
  const checkSummary = createCheckSummary(safeInputs.manifestCheck);
  const manifestValid = manifestCheckPresent && checkSummary.manifestValid;
  const manifestCompatible = manifestCheckPresent && Boolean(safeInputs.manifestCheck.ok) && allCheckSummaryFlagsSafe(checkSummary);
  const productiveExecutionBlocked = manifestCheckPresent && checkSummary.productiveExecutionBlocked === true;
  const persistenceSafe = manifestCheckPresent && checkSummary.persistenceModeAllowed === true;
  const riskClass = manifestSummary.riskClass;
  const riskBlocked = riskClass === "blocked";
  const highRisk = riskClass === "high";
  const riskAcceptable = !riskBlocked && !highRisk;

  if (manifestCheckPresent && !manifestValid) {
    errors.push(createGateIssue("manifest_not_valid", "Adapter-Manifest ist technisch nicht gueltig.", "manifestCheck.compatibility.manifestValid"));
  }

  if (manifestCheckPresent && !Boolean(safeInputs.manifestCheck.ok)) {
    errors.push(createGateIssue("manifest_not_compatible", "Adapter-Manifest-Check ist nicht kompatibel.", "manifestCheck.ok"));
  } else if (manifestCheckPresent && !allCheckSummaryFlagsSafe(checkSummary)) {
    errors.push(createGateIssue("manifest_not_compatible", "Adapter-Manifest ist fuer dieses Gate formal nicht kompatibel.", "manifestCheck.compatibility"));
  }

  if (manifestCheckPresent && productiveExecutionBlocked !== true) {
    errors.push(createGateIssue("productive_execution_not_blocked", "Produktive Ausfuehrung ist nicht nachweislich gesperrt.", "manifestCheck.compatibility.productiveExecutionBlocked"));
  }

  if (manifestCheckPresent && persistenceSafe !== true) {
    errors.push(createGateIssue("persistence_mode_not_safe", "Persistence-Modus ist fuer dieses Gate nicht sicher.", "manifestCheck.compatibility.persistenceModeAllowed"));
  }

  if (riskBlocked) {
    errors.push(createGateIssue("risk_blocked", "RiskClass blockiert die Adapter-Planung.", "manifest.riskClass"));
  }

  if (highRisk) {
    warnings.push(createGateIssue("high_risk_class", "RiskClass high verlangt manuelle Pruefung.", "manifest.riskClass"));
    warnings.push(createGateIssue("manual_review_required", "Adapter-Planung benoetigt vorab manuelle Pruefung.", "manifest.riskClass"));
  }

  if (requestedStep !== "none") {
    warnings.push(createGateIssue("adapter_planning_only", "requestedStep erlaubt nur einen spaeteren Planungsschritt und keine Ausfuehrung.", "requestedStep"));
  }

  const baseCanPlanAdapter = Boolean(
    manifestPresent &&
      manifestCheckPresent &&
      manifestValid &&
      manifestCompatible &&
      productiveExecutionBlocked &&
      persistenceSafe &&
      !riskBlocked
  );

  const gate = {
    manifestPresent,
    manifestCheckPresent,
    manifestValid,
    manifestCompatible,
    productiveExecutionBlocked,
    persistenceSafe,
    riskAcceptable,
    canPlanAdapter: baseCanPlanAdapter && !highRisk && errors.length === 0,
    canExecute: false,
    canConnectRealTarget: false,
  };

  let decision = "blocked";
  if (errors.length === 0 && baseCanPlanAdapter && highRisk) {
    decision = "manual-review-required";
  } else if (errors.length === 0 && gate.canPlanAdapter) {
    decision = "adapter-planning-allowed";
  }

  const nextStep = resolveNextStep(decision, requestedStep);

  return cloneGateValue({
    ok: decision === "adapter-planning-allowed",
    decision,
    errors,
    warnings,
    gate,
    manifestSummary,
    checkSummary,
    nextStep,
  });
}

function createTargetAppAdapterReleaseGateReport(inputs) {
  const evaluation = evaluateTargetAppAdapterReleaseGate(inputs);

  return cloneGateValue({
    ok: evaluation.ok,
    decision: evaluation.decision,
    summary: {
      manifestPresent: evaluation.gate.manifestPresent,
      manifestCheckPresent: evaluation.gate.manifestCheckPresent,
      adapterPlanningPossible: evaluation.ok,
      realTargetAppConnected: false,
      productiveExecutionApproved: false,
      changeExecuted: false,
      statements: [
        "Keine echte Ziel-App wurde angebunden.",
        "Keine produktive Ausfuehrung wurde freigegeben.",
        "Keine Aenderung wurde ausgefuehrt.",
        "Nur Adapter-Planung ist moeglich, wenn das Gate ok ist.",
      ],
    },
    errors: evaluation.errors,
    warnings: evaluation.warnings,
    gate: evaluation.gate,
    nextStep: evaluation.nextStep,
  });
}

module.exports = {
  getTargetAppAdapterReleaseGateRequiredInputs,
  getTargetAppAdapterReleaseGateOptionalInputs,
  getTargetAppAdapterReleaseGateAllowedSteps,
  evaluateTargetAppAdapterReleaseGate,
  createTargetAppAdapterReleaseGateReport,
};
