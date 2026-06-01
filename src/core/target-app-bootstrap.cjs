"use strict";

const { createEditorCore } = require("./editor-core.cjs");
const { createEditorTreeViewModel } = require("./editor-ui-tree-view-model.cjs");
const { createEditorUiState } = require("./editor-ui-state.cjs");
const { validateHostAdapterContract } = require("./host-adapter-contract.cjs");

const TARGET_APP_BOOTSTRAP_REQUIRED_OPTIONS = Object.freeze(["targetAppId", "hostAdapter"]);
const TARGET_APP_BOOTSTRAP_OPTIONAL_OPTIONS = Object.freeze(["layoutProfileId", "uiScope", "initialUiState"]);

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

function createBootstrapError(code, message, field) {
  const error = { code, message };

  if (field !== undefined) {
    error.field = field;
  }

  return error;
}

function createFailureResult(options, errors) {
  return {
    ok: false,
    errors: errors.map((error) => cloneNeutralValue(error)),
    targetAppId: isObject(options) ? cloneNeutralValue(options.targetAppId) : undefined,
    layoutProfileId: isObject(options) ? cloneNeutralValue(options.layoutProfileId) : undefined,
    uiScope: isObject(options) ? cloneNeutralValue(options.uiScope) : undefined,
    editorCore: null,
    uiState: null,
    treeViewModel: null,
    layoutState: null,
    capabilities: {
      hasRegistry: false,
      hasEditorCore: false,
      hasLayoutState: false,
      hasTreeViewModel: false,
      canCreateChangeDraft: false,
    },
  };
}

function getTargetAppBootstrapRequiredOptions() {
  return TARGET_APP_BOOTSTRAP_REQUIRED_OPTIONS.slice();
}

function getTargetAppBootstrapOptionalOptions() {
  return TARGET_APP_BOOTSTRAP_OPTIONAL_OPTIONS.slice();
}

function normalizeOptions(options) {
  if (!isObject(options)) {
    return {
      ok: false,
      errors: [
        createBootstrapError(
          "invalid_target_app_bootstrap_options",
          "Ziel-App-Bootstrap-Optionen muessen ein Objekt sein."
        ),
      ],
    };
  }

  const errors = [];

  if (typeof options.targetAppId !== "string" || options.targetAppId.trim() === "") {
    errors.push(
      createBootstrapError("invalid_target_app_id", "targetAppId muss eine nicht leere Zeichenkette sein.", "targetAppId")
    );
  }

  if (!Object.prototype.hasOwnProperty.call(options, "hostAdapter")) {
    errors.push(createBootstrapError("invalid_host_adapter", "hostAdapter muss uebergeben werden.", "hostAdapter"));
  }

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
    };
  }

  return {
    ok: true,
    errors: [],
    value: {
      targetAppId: options.targetAppId,
      hostAdapter: options.hostAdapter,
      layoutProfileId: cloneNeutralValue(options.layoutProfileId),
      uiScope: cloneNeutralValue(options.uiScope),
      initialUiState: cloneNeutralValue(options.initialUiState),
    },
  };
}

function normalizeHostAdapterErrors(contractResult) {
  const contractErrors = Array.isArray(contractResult && contractResult.errors) ? contractResult.errors : [];

  if (contractErrors.length === 0) {
    return [createBootstrapError("invalid_host_adapter", "Host-Adapter ist ungueltig.", "hostAdapter")];
  }

  return contractErrors.map((error) => ({
    code: error.code || "invalid_host_adapter",
    message: error.message || "Host-Adapter ist ungueltig.",
    field: "hostAdapter",
  }));
}

function createTargetAppBootstrap(options) {
  const optionsResult = normalizeOptions(options);
  if (!optionsResult.ok) {
    return createFailureResult(options, optionsResult.errors);
  }

  const normalizedOptions = optionsResult.value;
  const contractResult = validateHostAdapterContract(normalizedOptions.hostAdapter);
  if (!contractResult.ok) {
    return createFailureResult(normalizedOptions, normalizeHostAdapterErrors(contractResult));
  }

  let registry;
  try {
    registry = normalizedOptions.hostAdapter.getRegistry();
  } catch (error) {
    return createFailureResult(normalizedOptions, [
      createBootstrapError("bootstrap_failed", `Registry konnte nicht gelesen werden: ${error.message}`, "hostAdapter"),
    ]);
  }

  if (!registry) {
    return createFailureResult(normalizedOptions, [
      createBootstrapError("missing_registry", "Host-Adapter lieferte keine Registry.", "hostAdapter"),
    ]);
  }

  let editorCore;
  try {
    editorCore = createEditorCore(registry);
  } catch (error) {
    return createFailureResult(normalizedOptions, [
      createBootstrapError("invalid_registry", error.message || "Aus der Registry konnte kein Editor-Core erzeugt werden.", "hostAdapter"),
    ]);
  }

  let layoutState;
  try {
    layoutState = cloneNeutralValue(normalizedOptions.hostAdapter.getCurrentLayoutState());
  } catch (error) {
    return createFailureResult(normalizedOptions, [
      createBootstrapError("bootstrap_failed", `Layoutzustand konnte nicht gelesen werden: ${error.message}`, "hostAdapter"),
    ]);
  }

  try {
    const uiState = createEditorUiState(normalizedOptions.initialUiState);
    const treeViewModel = createEditorTreeViewModel(editorCore);

    return {
      ok: true,
      errors: [],
      targetAppId: cloneNeutralValue(normalizedOptions.targetAppId),
      layoutProfileId: cloneNeutralValue(normalizedOptions.layoutProfileId),
      uiScope: cloneNeutralValue(normalizedOptions.uiScope),
      editorCore,
      uiState,
      treeViewModel: cloneNeutralValue(treeViewModel),
      layoutState: cloneNeutralValue(layoutState),
      capabilities: {
        hasRegistry: true,
        hasEditorCore: true,
        hasLayoutState: layoutState !== undefined && layoutState !== null,
        hasTreeViewModel: true,
        canCreateChangeDraft: true,
      },
    };
  } catch (error) {
    return createFailureResult(normalizedOptions, [
      createBootstrapError("bootstrap_failed", error.message || "Ziel-App-Bootstrap konnte nicht erzeugt werden."),
    ]);
  }
}

module.exports = {
  createTargetAppBootstrap,
  getTargetAppBootstrapRequiredOptions,
  getTargetAppBootstrapOptionalOptions,
};
