"use strict";

const TARGET_APP_ADAPTER_PLAN_SAFETY_REQUIRED_INPUTS = Object.freeze(["adapterPlan"]);
const TARGET_APP_ADAPTER_PLAN_SAFETY_OPTIONAL_INPUTS = Object.freeze([
  "safetyProfile",
  "reviewerNote",
  "acceptedWarnings",
]);
const TARGET_APP_ADAPTER_PLAN_SAFETY_REQUIRED_BLOCKED_ACTIONS = Object.freeze([
  "create-real-adapter",
  "connect-real-target-app",
  "execute-change-request",
  "write-productive-data",
  "store-domain-data",
  "bypass-release-gate",
]);
const TARGET_APP_ADAPTER_PLAN_SAFETY_REQUIRED_CONFIRMATIONS = Object.freeze([
  "manifest-reviewed",
  "manifest-check-reviewed",
  "release-gate-reviewed",
  "no-productive-execution",
  "no-domain-data",
  "no-real-target-connection",
]);
const TARGET_APP_ADAPTER_PLAN_SAFETY_REQUIRED_TESTS = Object.freeze([
  "adapter-contract-test",
  "manifest-validation-test",
  "manifest-check-test",
  "release-gate-test",
  "no-execution-regression-test",
]);
const TARGET_APP_ADAPTER_PLAN_SAFETY_REQUIRED_DOCUMENTS = Object.freeze([
  "docs/ZIEL_APP_AUSWAHL.md",
  "docs/ZIEL_APP_ADAPTER_REGELN.md",
]);

const TARGET_APP_ADAPTER_PLAN_SAFETY_ALLOWED_STATUSES = Object.freeze([
  "planning-allowed",
  "manual-review-required",
  "blocked",
]);
const TARGET_APP_ADAPTER_PLAN_SAFETY_SAFE_EXECUTION_MODES = Object.freeze(["planning-only", "none", "disabled"]);
const TARGET_APP_ADAPTER_PLAN_SAFETY_SAFE_PERSISTENCE_MODES = Object.freeze(["none", "planning-only", "disabled"]);
const TARGET_APP_ADAPTER_PLAN_SAFETY_ALLOWED_ADAPTER_KINDS = Object.freeze([
  "neutral-test-adapter",
  "controlled-real-adapter-plan",
  "manual-review-plan",
]);

function cloneSafetyValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneSafetyValue(entry));
  }

  if (value && typeof value === "object") {
    const clone = {};
    Object.keys(value).forEach((key) => {
      clone[key] = cloneSafetyValue(value[key]);
    });
    return clone;
  }

  return value;
}

function isSafetyObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function createSafetyIssue(code, message, field) {
  const issue = { code, message };

  if (field !== undefined) {
    issue.field = field;
  }

  return issue;
}

function hasEveryEntry(actual, required) {
  return required.every((entry) => actual.includes(entry));
}

function getTargetAppAdapterPlanSafetyRequiredInputs() {
  return TARGET_APP_ADAPTER_PLAN_SAFETY_REQUIRED_INPUTS.slice();
}

function getTargetAppAdapterPlanSafetyOptionalInputs() {
  return TARGET_APP_ADAPTER_PLAN_SAFETY_OPTIONAL_INPUTS.slice();
}

function getTargetAppAdapterPlanSafetyRequiredBlockedActions() {
  return TARGET_APP_ADAPTER_PLAN_SAFETY_REQUIRED_BLOCKED_ACTIONS.slice();
}

function getTargetAppAdapterPlanSafetyRequiredConfirmations() {
  return TARGET_APP_ADAPTER_PLAN_SAFETY_REQUIRED_CONFIRMATIONS.slice();
}

function getTargetAppAdapterPlanSafetyRequiredTests() {
  return TARGET_APP_ADAPTER_PLAN_SAFETY_REQUIRED_TESTS.slice();
}

function getTargetAppAdapterPlanSafetyRequiredDocuments() {
  return TARGET_APP_ADAPTER_PLAN_SAFETY_REQUIRED_DOCUMENTS.slice();
}

function createPlanSummary(plan) {
  const source = isSafetyObject(plan) ? plan : {};

  return cloneSafetyValue({
    planId: source.planId,
    targetAppId: source.targetAppId,
    requestedAdapterKind: source.requestedAdapterKind,
    planningStatus: source.planningStatus,
    riskClass: source.riskClass,
    executionMode: source.executionMode,
    persistenceMode: source.persistenceMode,
    canCreateAdapterFiles: source.canCreateAdapterFiles,
    canExecute: source.canExecute,
    canConnectRealTarget: source.canConnectRealTarget,
    canTouchProductiveData: source.canTouchProductiveData,
  });
}

function appendInputSafetyErrors(originalInputs, safeInputs, errors) {
  if (!isSafetyObject(originalInputs)) {
    errors.push(createSafetyIssue("invalid_plan_safety_inputs", "Adapter-Plan-Sicherheitspruefung erwartet ein Eingabeobjekt."));
  }

  if (!isSafetyObject(safeInputs.adapterPlan)) {
    errors.push(createSafetyIssue("missing_adapter_plan", "Adapter-Plan fehlt.", "adapterPlan"));
    return;
  }

  if (!isSafetyObject(safeInputs.adapterPlan.plan)) {
    errors.push(createSafetyIssue("missing_plan", "Adapter-Plan enthaelt kein plan-Objekt.", "adapterPlan.plan"));
  }
}

function appendPlanningStatusSafetyErrors(plan, errors) {
  if (!TARGET_APP_ADAPTER_PLAN_SAFETY_ALLOWED_STATUSES.includes(plan.planningStatus)) {
    errors.push(
      createSafetyIssue(
        "invalid_planning_status",
        "planningStatus ist fuer die Adapter-Plan-Sicherheitspruefung nicht erlaubt.",
        "adapterPlan.plan.planningStatus"
      )
    );
    return;
  }

  if (plan.planningStatus === "blocked") {
    errors.push(createSafetyIssue("planning_blocked", "Adapter-Plan ist blockiert.", "adapterPlan.plan.planningStatus"));
  }

  if (plan.planningStatus === "manual-review-required") {
    errors.push(
      createSafetyIssue(
        "manual_review_required",
        "Adapter-Plan benoetigt manuelle Pruefung und wird nicht freigegeben.",
        "adapterPlan.plan.planningStatus"
      )
    );
  }
}

function appendBooleanSafetyErrors(plan, errors) {
  if (plan.canCreateAdapterFiles !== false) {
    errors.push(
      createSafetyIssue(
        "adapter_file_creation_not_blocked",
        "Adapterdatei-Erzeugung ist nicht sicher gesperrt.",
        "adapterPlan.plan.canCreateAdapterFiles"
      )
    );
  }

  if (plan.canExecute !== false) {
    errors.push(createSafetyIssue("execution_not_blocked", "Ausfuehrung ist nicht sicher gesperrt.", "adapterPlan.plan.canExecute"));
  }

  if (plan.canConnectRealTarget !== false) {
    errors.push(
      createSafetyIssue(
        "real_target_connection_not_blocked",
        "Verbindung zu einer echten Ziel-App ist nicht sicher gesperrt.",
        "adapterPlan.plan.canConnectRealTarget"
      )
    );
  }

  if (plan.canTouchProductiveData !== false) {
    errors.push(
      createSafetyIssue(
        "productive_data_not_blocked",
        "Produktive Datenverarbeitung ist nicht sicher gesperrt.",
        "adapterPlan.plan.canTouchProductiveData"
      )
    );
  }
}

function appendMissingEntryErrors(actual, required, code, messagePrefix, fieldPrefix, errors) {
  required.forEach((entry) => {
    if (!actual.includes(entry)) {
      errors.push(createSafetyIssue(code, `${messagePrefix}: ${entry}.`, `${fieldPrefix}.${entry}`));
    }
  });
}

function appendListSafetyErrors(plan, errors) {
  const blockedActions = Array.isArray(plan.blockedActions) ? plan.blockedActions : [];
  const confirmations = Array.isArray(plan.requiredConfirmations) ? plan.requiredConfirmations : [];
  const tests = Array.isArray(plan.requiredTests) ? plan.requiredTests : [];
  const documents = Array.isArray(plan.requiredDocuments) ? plan.requiredDocuments : [];

  appendMissingEntryErrors(
    blockedActions,
    TARGET_APP_ADAPTER_PLAN_SAFETY_REQUIRED_BLOCKED_ACTIONS,
    "missing_blocked_action",
    "Pflicht-Sperraktion fehlt",
    "adapterPlan.plan.blockedActions",
    errors
  );
  appendMissingEntryErrors(
    confirmations,
    TARGET_APP_ADAPTER_PLAN_SAFETY_REQUIRED_CONFIRMATIONS,
    "missing_required_confirmation",
    "Pflichtbestaetigung fehlt",
    "adapterPlan.plan.requiredConfirmations",
    errors
  );
  appendMissingEntryErrors(
    tests,
    TARGET_APP_ADAPTER_PLAN_SAFETY_REQUIRED_TESTS,
    "missing_required_test",
    "Pflichttest fehlt",
    "adapterPlan.plan.requiredTests",
    errors
  );
  appendMissingEntryErrors(
    documents,
    TARGET_APP_ADAPTER_PLAN_SAFETY_REQUIRED_DOCUMENTS,
    "missing_required_document",
    "Pflichtdokument fehlt",
    "adapterPlan.plan.requiredDocuments",
    errors
  );

  if (!blockedActions.includes("bypass-release-gate")) {
    errors.push(
      createSafetyIssue(
        "release_gate_bypass_not_blocked",
        "Release-Gate-Umgehung ist nicht ausdruecklich gesperrt.",
        "adapterPlan.plan.blockedActions.bypass-release-gate"
      )
    );
  }
}

function appendModeSafetyErrors(plan, errors) {
  if (!TARGET_APP_ADAPTER_PLAN_SAFETY_SAFE_EXECUTION_MODES.includes(plan.executionMode)) {
    errors.push(
      createSafetyIssue(
        "productive_execution_not_allowed",
        "executionMode darf keine produktive Ausfuehrung bedeuten.",
        "adapterPlan.plan.executionMode"
      )
    );
  }

  if (!TARGET_APP_ADAPTER_PLAN_SAFETY_SAFE_PERSISTENCE_MODES.includes(plan.persistenceMode)) {
    errors.push(
      createSafetyIssue(
        "productive_persistence_not_allowed",
        "persistenceMode darf keine produktive Speicherung bedeuten.",
        "adapterPlan.plan.persistenceMode"
      )
    );
  }

  if (!TARGET_APP_ADAPTER_PLAN_SAFETY_ALLOWED_ADAPTER_KINDS.includes(plan.requestedAdapterKind)) {
    errors.push(
      createSafetyIssue(
        "adapter_kind_not_planning_only",
        "requestedAdapterKind muss eine reine Planungsform bleiben.",
        "adapterPlan.plan.requestedAdapterKind"
      )
    );
  }
}

function createSafetyState(plan, adapterPlanPresent) {
  const source = isSafetyObject(plan) ? plan : {};
  const blockedActions = Array.isArray(source.blockedActions) ? source.blockedActions : [];
  const confirmations = Array.isArray(source.requiredConfirmations) ? source.requiredConfirmations : [];
  const tests = Array.isArray(source.requiredTests) ? source.requiredTests : [];
  const documents = Array.isArray(source.requiredDocuments) ? source.requiredDocuments : [];

  const state = {
    planPresent: Boolean(adapterPlanPresent && isSafetyObject(plan)),
    planningStatusAllowed: source.planningStatus === "planning-allowed",
    adapterFileCreationBlocked: source.canCreateAdapterFiles === false,
    executionBlocked: source.canExecute === false,
    realTargetConnectionBlocked: source.canConnectRealTarget === false,
    productiveDataBlocked: source.canTouchProductiveData === false,
    requiredBlockedActionsPresent: hasEveryEntry(blockedActions, TARGET_APP_ADAPTER_PLAN_SAFETY_REQUIRED_BLOCKED_ACTIONS),
    requiredConfirmationsPresent: hasEveryEntry(confirmations, TARGET_APP_ADAPTER_PLAN_SAFETY_REQUIRED_CONFIRMATIONS),
    requiredTestsPresent: hasEveryEntry(tests, TARGET_APP_ADAPTER_PLAN_SAFETY_REQUIRED_TESTS),
    requiredDocumentsPresent: hasEveryEntry(documents, TARGET_APP_ADAPTER_PLAN_SAFETY_REQUIRED_DOCUMENTS),
    releaseGateBypassBlocked: blockedActions.includes("bypass-release-gate"),
    noRuntimeImplementation: true,
    noProductiveApproval: true,
    safeForPlanningOnly: false,
  };

  state.safeForPlanningOnly =
    state.planPresent &&
    state.planningStatusAllowed &&
    state.adapterFileCreationBlocked &&
    state.executionBlocked &&
    state.realTargetConnectionBlocked &&
    state.productiveDataBlocked &&
    state.requiredBlockedActionsPresent &&
    state.requiredConfirmationsPresent &&
    state.requiredTestsPresent &&
    state.requiredDocumentsPresent &&
    state.releaseGateBypassBlocked &&
    state.noRuntimeImplementation &&
    state.noProductiveApproval &&
    TARGET_APP_ADAPTER_PLAN_SAFETY_SAFE_EXECUTION_MODES.includes(source.executionMode) &&
    TARGET_APP_ADAPTER_PLAN_SAFETY_SAFE_PERSISTENCE_MODES.includes(source.persistenceMode) &&
    TARGET_APP_ADAPTER_PLAN_SAFETY_ALLOWED_ADAPTER_KINDS.includes(source.requestedAdapterKind);

  return state;
}

function createSafetyWarnings() {
  return [
    createSafetyIssue("planning_only", "Sicherheitspruefung bewertet nur die Adapter-Planung."),
    createSafetyIssue("no_runtime_implementation", "Sicherheitspruefung erzeugt keine Runtime-Implementierung."),
    createSafetyIssue("no_productive_approval", "Sicherheitspruefung gibt keine produktive Ausfuehrung frei."),
  ];
}

function checkTargetAppAdapterPlanSafety(inputs) {
  const errors = [];
  const safeInputs = isSafetyObject(inputs) ? cloneSafetyValue(inputs) : {};

  appendInputSafetyErrors(inputs, safeInputs, errors);

  const plan = isSafetyObject(safeInputs.adapterPlan) && isSafetyObject(safeInputs.adapterPlan.plan) ? safeInputs.adapterPlan.plan : {};

  if (isSafetyObject(plan)) {
    appendPlanningStatusSafetyErrors(plan, errors);
    appendBooleanSafetyErrors(plan, errors);
    appendListSafetyErrors(plan, errors);
    appendModeSafetyErrors(plan, errors);
  }

  const safety = createSafetyState(plan, isSafetyObject(safeInputs.adapterPlan));
  const planSummary = createPlanSummary(plan);
  const ok = errors.length === 0 && safety.safeForPlanningOnly === true && plan.planningStatus === "planning-allowed";

  return cloneSafetyValue({
    ok,
    errors,
    warnings: createSafetyWarnings(),
    safety,
    planSummary,
  });
}

function createTargetAppAdapterPlanSafetyReport(inputs) {
  const result = checkTargetAppAdapterPlanSafety(inputs);

  return cloneSafetyValue({
    ok: result.ok,
    summary: {
      realTargetAppConnected: false,
      adapterFilesCreated: false,
      productiveExecutionApproved: false,
      changeExecuted: false,
      domainDataProcessed: false,
      planningOnlyChecked: true,
      releaseGateRequired: true,
      statements: [
        "Keine echte Ziel-App wurde angebunden.",
        "Keine Adapterdateien wurden erzeugt.",
        "Keine produktive Ausfuehrung wurde freigegeben.",
        "Keine Aenderung wurde ausgefuehrt.",
        "Keine Fachdaten wurden verarbeitet.",
        "Nur Adapter-Planung wurde geprueft.",
        "Release-Gate bleibt verbindlich.",
      ],
    },
    errors: result.errors,
    warnings: result.warnings,
    safety: result.safety,
    planSummary: result.planSummary,
  });
}

module.exports = {
  getTargetAppAdapterPlanSafetyRequiredInputs,
  getTargetAppAdapterPlanSafetyOptionalInputs,
  getTargetAppAdapterPlanSafetyRequiredBlockedActions,
  getTargetAppAdapterPlanSafetyRequiredConfirmations,
  getTargetAppAdapterPlanSafetyRequiredTests,
  getTargetAppAdapterPlanSafetyRequiredDocuments,
  checkTargetAppAdapterPlanSafety,
  createTargetAppAdapterPlanSafetyReport,
};
