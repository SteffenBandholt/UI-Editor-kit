"use strict";

const TARGET_APP_ADAPTER_PLAN_REQUIRED_INPUTS = Object.freeze(["manifest", "manifestCheck", "releaseGate"]);
const TARGET_APP_ADAPTER_PLAN_OPTIONAL_INPUTS = Object.freeze([
  "planId",
  "requestedAdapterKind",
  "ownerNote",
  "constraints",
  "assumptions",
]);
const TARGET_APP_ADAPTER_PLAN_ALLOWED_ADAPTER_KINDS = Object.freeze([
  "neutral-test-adapter",
  "controlled-real-adapter-plan",
  "manual-review-plan",
]);

const TARGET_APP_ADAPTER_PLAN_ALLOWED_STEPS = Object.freeze([
  "review-manifest",
  "review-element-allowlist",
  "review-operation-allowlist",
  "review-locked-operations",
  "review-risk-class",
  "define-adapter-test-strategy",
]);

const TARGET_APP_ADAPTER_PLAN_BLOCKED_ACTIONS = Object.freeze([
  "create-real-adapter",
  "connect-real-target-app",
  "execute-change-request",
  "write-productive-data",
  "store-domain-data",
  "bypass-release-gate",
]);

const TARGET_APP_ADAPTER_PLAN_REQUIRED_CONFIRMATIONS = Object.freeze([
  "manifest-reviewed",
  "manifest-check-reviewed",
  "release-gate-reviewed",
  "no-productive-execution",
  "no-domain-data",
  "no-real-target-connection",
]);

const TARGET_APP_ADAPTER_PLAN_REQUIRED_TESTS = Object.freeze([
  "adapter-contract-test",
  "manifest-validation-test",
  "manifest-check-test",
  "release-gate-test",
  "no-execution-regression-test",
]);

const TARGET_APP_ADAPTER_PLAN_REQUIRED_DOCUMENTS = Object.freeze([
  "docs/ZIEL_APP_AUSWAHL.md",
  "docs/ZIEL_APP_ADAPTER_REGELN.md",
]);

function clonePlanValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => clonePlanValue(entry));
  }

  if (value && typeof value === "object") {
    const clone = {};
    Object.keys(value).forEach((key) => {
      clone[key] = clonePlanValue(value[key]);
    });
    return clone;
  }

  return value;
}

function isPlanObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function createPlanIssue(code, message, field) {
  const issue = { code, message };

  if (field !== undefined) {
    issue.field = field;
  }

  return issue;
}

function getTargetAppAdapterPlanRequiredInputs() {
  return TARGET_APP_ADAPTER_PLAN_REQUIRED_INPUTS.slice();
}

function getTargetAppAdapterPlanOptionalInputs() {
  return TARGET_APP_ADAPTER_PLAN_OPTIONAL_INPUTS.slice();
}

function getTargetAppAdapterPlanAllowedAdapterKinds() {
  return TARGET_APP_ADAPTER_PLAN_ALLOWED_ADAPTER_KINDS.slice();
}

function createManifestSummary(manifest) {
  const source = isPlanObject(manifest) ? manifest : {};

  return clonePlanValue({
    targetAppId: source.targetAppId,
    adapterName: source.adapterName,
    adapterVersion: source.adapterVersion,
    uiScope: source.uiScope,
    layoutProfileId: source.layoutProfileId,
    executionMode: source.executionMode,
    persistenceMode: source.persistenceMode,
    riskClass: source.riskClass,
  });
}

function createCheckSummary(manifestCheck) {
  const source = isPlanObject(manifestCheck) ? manifestCheck : {};
  const compatibility = isPlanObject(source.compatibility) ? source.compatibility : {};

  return clonePlanValue({
    ok: Boolean(source.ok),
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

function createGateSummary(releaseGate) {
  const source = isPlanObject(releaseGate) ? releaseGate : {};
  const gate = isPlanObject(source.gate) ? source.gate : {};

  return clonePlanValue({
    decision: source.decision,
    nextStep: source.nextStep,
    manifestPresent: Boolean(gate.manifestPresent),
    manifestCheckPresent: Boolean(gate.manifestCheckPresent),
    manifestValid: Boolean(gate.manifestValid),
    manifestCompatible: Boolean(gate.manifestCompatible),
    productiveExecutionBlocked: Boolean(gate.productiveExecutionBlocked),
    persistenceSafe: Boolean(gate.persistenceSafe),
    riskAcceptable: Boolean(gate.riskAcceptable),
    canPlanAdapter: Boolean(gate.canPlanAdapter),
    canExecute: gate.canExecute,
    canConnectRealTarget: gate.canConnectRealTarget,
  });
}

function resolveRequestedAdapterKind(inputs, errors) {
  const requestedAdapterKind = Object.prototype.hasOwnProperty.call(inputs, "requestedAdapterKind")
    ? inputs.requestedAdapterKind
    : "neutral-test-adapter";

  if (!TARGET_APP_ADAPTER_PLAN_ALLOWED_ADAPTER_KINDS.includes(requestedAdapterKind)) {
    errors.push(
      createPlanIssue(
        "invalid_requested_adapter_kind",
        "requestedAdapterKind ist fuer die Adapter-Planungsgrundlage nicht erlaubt.",
        "requestedAdapterKind"
      )
    );
    return requestedAdapterKind;
  }

  return requestedAdapterKind;
}

function resolvePlanningStatus(releaseGate) {
  if (!isPlanObject(releaseGate)) {
    return "blocked";
  }

  if (releaseGate.decision === "manual-review-required") {
    return "manual-review-required";
  }

  if (releaseGate.decision === "adapter-planning-allowed") {
    return "planning-allowed";
  }

  return "blocked";
}

function createPlan(inputs, requestedAdapterKind, planningStatus) {
  const manifest = isPlanObject(inputs.manifest) ? inputs.manifest : {};

  return clonePlanValue({
    planId: typeof inputs.planId === "string" && inputs.planId.trim() !== "" ? inputs.planId : "target-app-adapter-plan",
    targetAppId: manifest.targetAppId,
    adapterName: manifest.adapterName,
    adapterVersion: manifest.adapterVersion,
    uiScope: manifest.uiScope,
    layoutProfileId: manifest.layoutProfileId,
    requestedAdapterKind,
    planningStatus,
    allowedPlanningSteps: TARGET_APP_ADAPTER_PLAN_ALLOWED_STEPS.slice(),
    blockedActions: TARGET_APP_ADAPTER_PLAN_BLOCKED_ACTIONS.slice(),
    requiredConfirmations: TARGET_APP_ADAPTER_PLAN_REQUIRED_CONFIRMATIONS.slice(),
    requiredTests: TARGET_APP_ADAPTER_PLAN_REQUIRED_TESTS.slice(),
    requiredDocuments: TARGET_APP_ADAPTER_PLAN_REQUIRED_DOCUMENTS.slice(),
    riskClass: manifest.riskClass,
    executionMode: "planning-only",
    persistenceMode: "none",
    canCreateAdapterFiles: false,
    canExecute: false,
    canConnectRealTarget: false,
    canTouchProductiveData: false,
  });
}

function appendInputErrors(originalInputs, inputs, errors) {
  if (!isPlanObject(originalInputs)) {
    errors.push(createPlanIssue("invalid_adapter_plan_inputs", "Adapter-Planungsgrundlage erwartet ein Eingabeobjekt."));
  }

  if (!isPlanObject(inputs.manifest)) {
    errors.push(createPlanIssue("missing_manifest", "Adapter-Manifest fehlt.", "manifest"));
  }

  if (!isPlanObject(inputs.manifestCheck)) {
    errors.push(createPlanIssue("missing_manifest_check", "Adapter-Manifest-Check fehlt.", "manifestCheck"));
  }

  if (!isPlanObject(inputs.releaseGate)) {
    errors.push(createPlanIssue("missing_release_gate", "Release-Gate fehlt.", "releaseGate"));
  }
}

function appendSafetyErrors(inputs, errors) {
  if (isPlanObject(inputs.manifestCheck) && inputs.manifestCheck.ok !== true) {
    errors.push(createPlanIssue("manifest_check_failed", "Adapter-Manifest-Check ist nicht erfolgreich.", "manifestCheck.ok"));
  }

  if (isPlanObject(inputs.releaseGate) && inputs.releaseGate.decision === "blocked") {
    errors.push(createPlanIssue("release_gate_blocked", "Release-Gate blockiert die Adapter-Planungsgrundlage.", "releaseGate.decision"));
  }

  const gate = isPlanObject(inputs.releaseGate) && isPlanObject(inputs.releaseGate.gate) ? inputs.releaseGate.gate : {};

  if (gate.canExecute !== false) {
    errors.push(createPlanIssue("execution_not_blocked", "Ausfuehrung ist im Release-Gate nicht sicher gesperrt.", "releaseGate.gate.canExecute"));
  }

  if (gate.canConnectRealTarget !== false) {
    errors.push(
      createPlanIssue(
        "real_target_connection_not_blocked",
        "Verbindung zur echten Ziel-App ist im Release-Gate nicht sicher gesperrt.",
        "releaseGate.gate.canConnectRealTarget"
      )
    );
  }
}

function appendWarnings(requestedAdapterKind, planningStatus, warnings) {
  warnings.push(createPlanIssue("planning_only", "Es wird nur eine Adapter-Planungsgrundlage erzeugt."));

  if (planningStatus === "manual-review-required") {
    warnings.push(createPlanIssue("manual_review_required", "Die Adapter-Planungsgrundlage verlangt manuelle Pruefung."));
  }

  if (requestedAdapterKind === "controlled-real-adapter-plan") {
    warnings.push(
      createPlanIssue(
        "controlled_real_adapter_plan_is_not_implementation",
        "controlled-real-adapter-plan ist nur eine Planungsgrundlage und keine Umsetzung.",
        "requestedAdapterKind"
      )
    );
  }

  if (requestedAdapterKind === "manual-review-plan") {
    warnings.push(
      createPlanIssue(
        "manual_review_required",
        "manual-review-plan ist nur eine manuelle Pruefgrundlage und keine Umsetzung.",
        "requestedAdapterKind"
      )
    );
  }
}

function createTargetAppAdapterPlan(inputs) {
  const errors = [];
  const warnings = [];
  const safeInputs = isPlanObject(inputs) ? clonePlanValue(inputs) : {};

  appendInputErrors(inputs, safeInputs, errors);
  const requestedAdapterKind = resolveRequestedAdapterKind(safeInputs, errors);
  appendSafetyErrors(safeInputs, errors);

  const basePlanningStatus = resolvePlanningStatus(safeInputs.releaseGate);
  const planningStatus = errors.length === 0 ? basePlanningStatus : "blocked";
  appendWarnings(requestedAdapterKind, planningStatus, warnings);

  const plan = createPlan(safeInputs, requestedAdapterKind, planningStatus);

  return clonePlanValue({
    ok: planningStatus !== "blocked",
    errors,
    warnings,
    plan,
    gateSummary: createGateSummary(safeInputs.releaseGate),
    manifestSummary: createManifestSummary(safeInputs.manifest),
    checkSummary: createCheckSummary(safeInputs.manifestCheck),
  });
}

function createTargetAppAdapterPlanReport(inputs) {
  const result = createTargetAppAdapterPlan(inputs);

  return clonePlanValue({
    ok: result.ok,
    planningStatus: result.plan.planningStatus,
    summary: {
      realTargetAppConnected: false,
      adapterFilesCreated: false,
      productiveExecutionApproved: false,
      changeExecuted: false,
      domainDataProcessed: false,
      planningBasisCreated: true,
      statements: [
        "Keine echte Ziel-App wurde angebunden.",
        "Keine Adapterdateien wurden erzeugt.",
        "Keine produktive Ausfuehrung wurde freigegeben.",
        "Keine Aenderung wurde ausgefuehrt.",
        "Keine Fachdaten wurden verarbeitet.",
        "Nur eine Planungsgrundlage wurde erzeugt.",
      ],
    },
    errors: result.errors,
    warnings: result.warnings,
    plan: result.plan,
  });
}

module.exports = {
  getTargetAppAdapterPlanRequiredInputs,
  getTargetAppAdapterPlanOptionalInputs,
  getTargetAppAdapterPlanAllowedAdapterKinds,
  createTargetAppAdapterPlan,
  createTargetAppAdapterPlanReport,
};
