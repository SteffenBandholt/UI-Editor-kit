"use strict";

const { createTestHostAdapter } = require("./test-host-adapter.cjs");
const { createTargetAppBootstrap } = require("./target-app-bootstrap.cjs");
const { createEditorTreeViewModel } = require("./editor-ui-tree-view-model.cjs");
const { createEditorDetailsViewModel } = require("./editor-ui-details-view-model.cjs");
const { createEditorChangeDraftViewModel } = require("./editor-ui-change-draft-view-model.cjs");

const TARGET_APP_TEST_HOST_FLOW_REQUIRED_OPTIONS = Object.freeze(["targetAppId", "registry", "changeRequest"]);
const TARGET_APP_TEST_HOST_FLOW_OPTIONAL_OPTIONS = Object.freeze([
  "layoutProfileId",
  "uiScope",
  "initialLayoutState",
  "initialUiState",
]);

function cloneNeutralValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneNeutralValue(entry));
  }

  if (value && typeof value === "object") {
    const clone = {};
    Object.keys(value).forEach((key) => {
      clone[key] = cloneNeutralValue(value[key]);
    });
    return clone;
  }

  return value;
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function createFlowError(code, message, field) {
  const error = { code, message };

  if (field !== undefined) {
    error.field = field;
  }

  return error;
}

function createCapabilities(values) {
  return {
    hasBootstrap: Boolean(values && values.hasBootstrap),
    hasTreeViewModel: Boolean(values && values.hasTreeViewModel),
    hasDetailsViewModel: Boolean(values && values.hasDetailsViewModel),
    hasChangeDraftViewModel: Boolean(values && values.hasChangeDraftViewModel),
    canSubmit: Boolean(values && values.canSubmit),
    didSubmitToTestHost: Boolean(values && values.didSubmitToTestHost),
    executed: Boolean(values && values.executed),
  };
}

function createFlowResult(values) {
  return {
    ok: Boolean(values.ok),
    errors: Array.isArray(values.errors) ? values.errors.map((error) => cloneNeutralValue(error)) : [],
    targetAppId: cloneNeutralValue(values.targetAppId),
    layoutProfileId: cloneNeutralValue(values.layoutProfileId),
    uiScope: cloneNeutralValue(values.uiScope),
    bootstrap: values.bootstrap || null,
    treeViewModel: cloneNeutralValue(values.treeViewModel || null),
    detailsViewModel: cloneNeutralValue(values.detailsViewModel || null),
    changeDraftViewModel: cloneNeutralValue(values.changeDraftViewModel || null),
    submitResult: cloneNeutralValue(values.submitResult || null),
    submittedChangeRequests: Array.isArray(values.submittedChangeRequests)
      ? values.submittedChangeRequests.map((request) => cloneNeutralValue(request))
      : [],
    capabilities: createCapabilities(values.capabilities),
  };
}

function createValidationFailure(options, errors) {
  return createFlowResult({
    ok: false,
    errors,
    targetAppId: isObject(options) ? options.targetAppId : undefined,
    layoutProfileId: isObject(options) ? options.layoutProfileId : undefined,
    uiScope: isObject(options) ? options.uiScope : undefined,
    bootstrap: null,
    treeViewModel: null,
    detailsViewModel: null,
    changeDraftViewModel: null,
    submitResult: null,
    submittedChangeRequests: [],
    capabilities: createCapabilities(),
  });
}

function validateOptions(options) {
  if (!isObject(options)) {
    return {
      ok: false,
      errors: [
        createFlowError(
          "invalid_target_app_test_host_flow_options",
          "Test-Host-Flow-Optionen muessen ein Objekt sein."
        ),
      ],
    };
  }

  const errors = [];

  if (typeof options.targetAppId !== "string" || options.targetAppId.trim() === "") {
    errors.push(createFlowError("invalid_target_app_test_host_flow_options", "targetAppId muss gesetzt sein.", "targetAppId"));
  }

  if (!Object.prototype.hasOwnProperty.call(options, "registry") || !options.registry) {
    errors.push(createFlowError("missing_registry", "registry muss gesetzt sein.", "registry"));
  }

  if (!Object.prototype.hasOwnProperty.call(options, "changeRequest") || !options.changeRequest) {
    errors.push(createFlowError("missing_change_request", "changeRequest muss gesetzt sein.", "changeRequest"));
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

function getTargetAppTestHostFlowRequiredOptions() {
  return TARGET_APP_TEST_HOST_FLOW_REQUIRED_OPTIONS.slice();
}

function getTargetAppTestHostFlowOptionalOptions() {
  return TARGET_APP_TEST_HOST_FLOW_OPTIONAL_OPTIONS.slice();
}

function createTargetAppTestHostFlow(options) {
  const validationResult = validateOptions(options);
  if (!validationResult.ok) {
    return createValidationFailure(options, validationResult.errors);
  }

  const testHostAdapter = createTestHostAdapter({
    registry: options.registry,
    layoutState: cloneNeutralValue(options.initialLayoutState),
  });

  const bootstrap = createTargetAppBootstrap({
    targetAppId: options.targetAppId,
    hostAdapter: testHostAdapter,
    layoutProfileId: cloneNeutralValue(options.layoutProfileId),
    uiScope: cloneNeutralValue(options.uiScope),
    initialUiState: cloneNeutralValue(options.initialUiState),
  });

  if (!bootstrap.ok) {
    return createFlowResult({
      ok: false,
      errors: [createFlowError("bootstrap_failed", "Bootstrap konnte nicht erzeugt werden."), ...bootstrap.errors],
      targetAppId: options.targetAppId,
      layoutProfileId: options.layoutProfileId,
      uiScope: options.uiScope,
      bootstrap,
      treeViewModel: null,
      detailsViewModel: null,
      changeDraftViewModel: null,
      submitResult: null,
      submittedChangeRequests: testHostAdapter.listSubmittedChangeRequests(),
      capabilities: createCapabilities({ hasBootstrap: true }),
    });
  }

  let treeViewModel = null;
  let detailsViewModel = null;
  let changeDraftViewModel = null;
  let submitResult = null;
  const errors = [];

  try {
    treeViewModel = createEditorTreeViewModel(bootstrap.editorCore);
    detailsViewModel = isObject(options.changeRequest)
      ? createEditorDetailsViewModel(bootstrap.editorCore, options.changeRequest.elementId)
      : null;
    changeDraftViewModel = createEditorChangeDraftViewModel(bootstrap.editorCore, options.changeRequest, {
      includeRawChangeRequest: true,
    });
  } catch (error) {
    return createFlowResult({
      ok: false,
      errors: [createFlowError("bootstrap_failed", error.message || "Flow konnte nicht erzeugt werden.")],
      targetAppId: options.targetAppId,
      layoutProfileId: options.layoutProfileId,
      uiScope: options.uiScope,
      bootstrap,
      treeViewModel,
      detailsViewModel,
      changeDraftViewModel,
      submitResult: null,
      submittedChangeRequests: testHostAdapter.listSubmittedChangeRequests(),
      capabilities: createCapabilities({
        hasBootstrap: true,
        hasTreeViewModel: Boolean(treeViewModel),
        hasDetailsViewModel: Boolean(detailsViewModel),
        hasChangeDraftViewModel: Boolean(changeDraftViewModel),
      }),
    });
  }

  const canSubmit = Boolean(changeDraftViewModel && changeDraftViewModel.canSubmit);

  if (canSubmit) {
    try {
      submitResult = testHostAdapter.submitChangeRequest(cloneNeutralValue(options.changeRequest));
    } catch (error) {
      errors.push(createFlowError("test_host_submit_failed", error.message || "Test-Host nahm den Auftrag nicht an."));
    }
  } else {
    errors.push(createFlowError("change_draft_not_submittable", "Aenderungsentwurf ist nicht submitfaehig."));
  }

  const executed = Boolean(submitResult && submitResult.executed);
  const submittedChangeRequests = testHostAdapter.listSubmittedChangeRequests();

  return createFlowResult({
    ok: errors.length === 0 && canSubmit && executed === false,
    errors,
    targetAppId: options.targetAppId,
    layoutProfileId: options.layoutProfileId,
    uiScope: options.uiScope,
    bootstrap,
    treeViewModel,
    detailsViewModel,
    changeDraftViewModel,
    submitResult,
    submittedChangeRequests,
    capabilities: createCapabilities({
      hasBootstrap: true,
      hasTreeViewModel: Boolean(treeViewModel),
      hasDetailsViewModel: Boolean(detailsViewModel),
      hasChangeDraftViewModel: Boolean(changeDraftViewModel),
      canSubmit,
      didSubmitToTestHost: submittedChangeRequests.length > 0,
      executed,
    }),
  });
}

module.exports = {
  createTargetAppTestHostFlow,
  getTargetAppTestHostFlowRequiredOptions,
  getTargetAppTestHostFlowOptionalOptions,
};
