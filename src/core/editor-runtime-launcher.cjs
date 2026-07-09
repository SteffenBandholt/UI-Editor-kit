"use strict";

const { createEditorCore } = require("./editor-core.cjs");
const { validateHostAdapterContract } = require("./host-adapter-contract.cjs");
const { validateTargetAppAdapterManifest } = require("./target-app-adapter-manifest.cjs");

function cloneRuntimeValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneRuntimeValue(entry));
  }

  if (value && typeof value === "object") {
    const clone = {};
    Object.keys(value).forEach((key) => {
      clone[key] = cloneRuntimeValue(value[key]);
    });
    return clone;
  }

  return value;
}

function createRuntimeError(code, message, details) {
  const error = { code, message };

  if (details !== undefined) {
    error.details = cloneRuntimeValue(details);
  }

  return error;
}

function createBlockedRuntimeStatus(values) {
  const safeValues = values && typeof values === "object" && !Array.isArray(values) ? values : {};
  const errors = Array.isArray(safeValues.errors) ? safeValues.errors.map((error) => cloneRuntimeValue(error)) : [];

  return {
    ok: false,
    targetAppId: safeValues.targetAppId || null,
    adapterName: safeValues.adapterName || null,
    uiScope: safeValues.uiScope || null,
    layoutScope: safeValues.layoutScope || null,
    registryElementCount: 0,
    selectedElementId: null,
    availableOperations: [],
    blocked: safeValues.blocked || false,
    errors,
  };
}

function createOkRuntimeStatus(values) {
  const safeValues = values && typeof values === "object" && !Array.isArray(values) ? values : {};

  return {
    ok: true,
    targetAppId: safeValues.targetAppId || null,
    adapterName: safeValues.adapterName || null,
    uiScope: safeValues.uiScope || null,
    layoutScope: safeValues.layoutScope || null,
    registryElementCount: safeValues.registryElementCount,
    selectedElementId: null,
    availableOperations: [],
    blocked: false,
    errors: [],
  };
}

function getAdapterManifest(hostAdapter) {
  if (!hostAdapter || typeof hostAdapter !== "object") {
    return null;
  }

  if (typeof hostAdapter.getAdapterManifest === "function") {
    return hostAdapter.getAdapterManifest();
  }

  if (Object.prototype.hasOwnProperty.call(hostAdapter, "adapterManifest")) {
    return hostAdapter.adapterManifest;
  }

  if (Object.prototype.hasOwnProperty.call(hostAdapter, "manifest")) {
    return hostAdapter.manifest;
  }

  return null;
}

function countRegistryElements(editorCore) {
  if (editorCore && typeof editorCore.size === "function") {
    return editorCore.size();
  }

  if (editorCore && typeof editorCore.listElements === "function") {
    return editorCore.listElements().length;
  }

  return 0;
}

function extractScopeValues(manifest) {
  return {
    targetAppId: manifest && typeof manifest.targetAppId === "string" ? manifest.targetAppId : null,
    adapterName: manifest && typeof manifest.adapterName === "string" ? manifest.adapterName : null,
    uiScope: manifest && typeof manifest.uiScope === "string" ? manifest.uiScope : null,
    layoutScope: manifest && typeof manifest.layoutScope === "string" ? manifest.layoutScope : null,
  };
}

function createEditorRuntimeLauncher(hostAdapter) {
  if (!hostAdapter) {
    return createBlockedRuntimeStatus({
      blocked: "missing_host_adapter",
      errors: [createRuntimeError("missing_host_adapter", "Runtime benoetigt einen HostAdapter.")],
    });
  }

  const hostValidation = validateHostAdapterContract(hostAdapter);
  if (!hostValidation.ok) {
    return createBlockedRuntimeStatus({
      blocked: "invalid_host_adapter",
      errors: [
        createRuntimeError("invalid_host_adapter", "HostAdapter erfuellt den Vertrag nicht.", hostValidation.errors),
      ],
    });
  }

  let manifest = null;
  let scopeValues = extractScopeValues(null);

  try {
    manifest = getAdapterManifest(hostAdapter);
  } catch (error) {
    return createBlockedRuntimeStatus({
      blocked: "invalid_manifest",
      errors: [createRuntimeError("invalid_manifest", "AdapterManifest konnte nicht gelesen werden.", error.message)],
    });
  }

  if (manifest !== null && manifest !== undefined) {
    scopeValues = extractScopeValues(manifest);
    const manifestValidation = validateTargetAppAdapterManifest(manifest);

    if (!manifestValidation.ok) {
      return createBlockedRuntimeStatus({
        ...scopeValues,
        blocked: "invalid_manifest",
        errors: [
          createRuntimeError("invalid_manifest", "AdapterManifest erfuellt den Vertrag nicht.", manifestValidation.errors),
        ],
      });
    }

    if (!scopeValues.uiScope || !scopeValues.layoutScope) {
      return createBlockedRuntimeStatus({
        ...scopeValues,
        blocked: "unknown_scope",
        errors: [createRuntimeError("unknown_scope", "AdapterManifest muss UI- und Layout-Scope bereitstellen.")],
      });
    }
  }

  let registry;
  try {
    registry = hostAdapter.getRegistry();
  } catch (error) {
    return createBlockedRuntimeStatus({
      ...scopeValues,
      blocked: "invalid_registry",
      errors: [createRuntimeError("invalid_registry", "Registry konnte nicht gelesen werden.", error.message)],
    });
  }

  let editorCore;
  try {
    editorCore = createEditorCore(registry);
  } catch (error) {
    return createBlockedRuntimeStatus({
      ...scopeValues,
      blocked: "invalid_registry",
      errors: [createRuntimeError("invalid_registry", "Registry ist fuer die Runtime ungueltig.", error.validationResult || error.message)],
    });
  }

  try {
    hostAdapter.getCurrentLayoutState();
  } catch (error) {
    return createBlockedRuntimeStatus({
      ...scopeValues,
      blocked: "layout_state_unavailable",
      errors: [createRuntimeError("layout_state_unavailable", "LayoutState konnte nicht gelesen werden.", error.message)],
    });
  }

  return createOkRuntimeStatus({
    ...scopeValues,
    registryElementCount: countRegistryElements(editorCore),
  });
}

module.exports = {
  createEditorRuntimeLauncher,
};
