"use strict";

const { createNeutralMinimalRegistry, getNeutralMinimalHostAllowedOperations } = require("./neutral-minimal-host.cjs");
const {
  createTargetAppAdapterManifest,
  validateTargetAppAdapterManifest,
} = require("./target-app-adapter-manifest.cjs");

const NEUTRAL_MINIMAL_HOST_EXPECTATION = Object.freeze({
  targetAppId: "neutral-minimal-host",
  uiScope: "workspace",
  layoutScope: "workspace.layout",
  layoutProfileId: "neutral-minimal-layout",
  allowedExecutionModes: Object.freeze(["disabled", "dry-run", "test-host"]),
  allowedPersistenceModes: Object.freeze(["none", "memory-only"]),
});

const NEUTRAL_MINIMAL_HOST_MANIFEST_DEFAULTS = Object.freeze({
  adapterName: "neutral-minimal-host-adapter",
  adapterVersion: "1.0.0",
  persistenceMode: "none",
  executionMode: "test-host",
  riskClass: "low",
  rollbackStrategy: "test-host-record-only",
  testStrategy: "neutral-minimal-host-flow",
});

function cloneCheckValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneCheckValue(entry));
  }

  if (value && typeof value === "object") {
    const clone = {};
    Object.keys(value).forEach((key) => {
      clone[key] = cloneCheckValue(value[key]);
    });
    return clone;
  }

  return value;
}

function isCheckObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function uniqueSorted(values) {
  return Array.from(new Set(values)).sort();
}

function getNeutralMinimalHostElementExpectation() {
  const registry = createNeutralMinimalRegistry();
  const elements = registry.listElements();

  return {
    elementTypes: uniqueSorted(elements.map((element) => element.type)),
    roles: uniqueSorted(elements.map((element) => element.role)),
  };
}

function getNeutralMinimalHostOperationExpectation() {
  const operationsByElementId = getNeutralMinimalHostAllowedOperations();
  const supportedOperations = [];
  const lockedOperations = [];

  Object.keys(operationsByElementId).forEach((elementId) => {
    const operationSet = operationsByElementId[elementId];
    supportedOperations.push(...operationSet.allowedOps);
    lockedOperations.push(...operationSet.lockedOps);
  });

  return {
    supportedOperations: uniqueSorted(supportedOperations),
    lockedOperations: uniqueSorted(lockedOperations),
  };
}

function getNeutralMinimalHostManifestExpectation() {
  const elementExpectation = getNeutralMinimalHostElementExpectation();
  const operationExpectation = getNeutralMinimalHostOperationExpectation();

  return cloneCheckValue({
    targetAppId: NEUTRAL_MINIMAL_HOST_EXPECTATION.targetAppId,
    uiScope: NEUTRAL_MINIMAL_HOST_EXPECTATION.uiScope,
    layoutScope: NEUTRAL_MINIMAL_HOST_EXPECTATION.layoutScope,
    layoutProfileId: NEUTRAL_MINIMAL_HOST_EXPECTATION.layoutProfileId,
    elementTypes: elementExpectation.elementTypes,
    roles: elementExpectation.roles,
    supportedOperations: operationExpectation.supportedOperations,
    lockedOperations: operationExpectation.lockedOperations,
    allowedExecutionModes: NEUTRAL_MINIMAL_HOST_EXPECTATION.allowedExecutionModes,
    allowedPersistenceModes: NEUTRAL_MINIMAL_HOST_EXPECTATION.allowedPersistenceModes,
  });
}

function createNeutralMinimalHostAdapterManifest(values) {
  const safeValues = isCheckObject(values) ? cloneCheckValue(values) : {};
  const expectation = getNeutralMinimalHostManifestExpectation();

  return createTargetAppAdapterManifest({
    targetAppId: expectation.targetAppId,
    adapterName: NEUTRAL_MINIMAL_HOST_MANIFEST_DEFAULTS.adapterName,
    adapterVersion: NEUTRAL_MINIMAL_HOST_MANIFEST_DEFAULTS.adapterVersion,
    uiScope: expectation.uiScope,
    layoutScope: expectation.layoutScope,
    layoutProfileId: expectation.layoutProfileId,
    supportedElementTypes: expectation.elementTypes,
    supportedRoles: expectation.roles,
    supportedOperations: expectation.supportedOperations,
    lockedOperations: expectation.lockedOperations,
    persistenceMode: NEUTRAL_MINIMAL_HOST_MANIFEST_DEFAULTS.persistenceMode,
    executionMode: NEUTRAL_MINIMAL_HOST_MANIFEST_DEFAULTS.executionMode,
    riskClass: NEUTRAL_MINIMAL_HOST_MANIFEST_DEFAULTS.riskClass,
    rollbackStrategy: NEUTRAL_MINIMAL_HOST_MANIFEST_DEFAULTS.rollbackStrategy,
    testStrategy: NEUTRAL_MINIMAL_HOST_MANIFEST_DEFAULTS.testStrategy,
    ...safeValues,
  });
}

function createCheckError(code, message, field) {
  const error = { code, message };

  if (field !== undefined) {
    error.field = field;
  }

  return error;
}

function toStringArray(value) {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : [];
}

function includesAll(actualValues, expectedValues) {
  return expectedValues.every((expectedValue) => actualValues.includes(expectedValue));
}

function hasNoUnsupported(actualValues, expectedValues) {
  return actualValues.every((actualValue) => expectedValues.includes(actualValue));
}

function addMissingErrors(errors, code, field, actualValues, expectedValues, label) {
  expectedValues.forEach((expectedValue) => {
    if (!actualValues.includes(expectedValue)) {
      errors.push(createCheckError(code, `${label} ${expectedValue} fehlt im Adapter-Manifest.`, field));
    }
  });
}

function checkTargetAppAdapterManifestAgainstNeutralMinimalHost(manifest) {
  const manifestCopy = cloneCheckValue(manifest);
  const expectation = getNeutralMinimalHostManifestExpectation();
  const manifestValidation = validateTargetAppAdapterManifest(manifestCopy);
  const errors = [];

  if (!manifestValidation.ok) {
    errors.push(
      createCheckError(
        "invalid_manifest",
        "Adapter-Manifest besteht die technische Manifest-Validierung nicht.",
        undefined
      )
    );
  }

  const supportedElementTypes = toStringArray(manifestCopy && manifestCopy.supportedElementTypes);
  const supportedRoles = toStringArray(manifestCopy && manifestCopy.supportedRoles);
  const supportedOperations = toStringArray(manifestCopy && manifestCopy.supportedOperations);
  const lockedOperations = toStringArray(manifestCopy && manifestCopy.lockedOperations);

  const targetAppMatches = Boolean(manifestCopy && manifestCopy.targetAppId === expectation.targetAppId);
  const uiScopeMatches = Boolean(manifestCopy && manifestCopy.uiScope === expectation.uiScope);
  const layoutProfileMatches = Boolean(manifestCopy && manifestCopy.layoutProfileId === expectation.layoutProfileId);
  const elementTypesCovered = includesAll(supportedElementTypes, expectation.elementTypes);
  const rolesCovered = includesAll(supportedRoles, expectation.roles);
  const operationsCovered = includesAll(supportedOperations, expectation.supportedOperations);
  const lockedOperationsCovered = includesAll(lockedOperations, expectation.lockedOperations);
  const manifestOperationsSupported = hasNoUnsupported(supportedOperations, expectation.supportedOperations);
  const executionModeAllowed = Boolean(
    manifestCopy && expectation.allowedExecutionModes.includes(manifestCopy.executionMode)
  );
  const persistenceModeAllowed = Boolean(
    manifestCopy && expectation.allowedPersistenceModes.includes(manifestCopy.persistenceMode)
  );
  const productiveExecutionBlocked = executionModeAllowed;

  if (!targetAppMatches) {
    errors.push(createCheckError("target_app_mismatch", "targetAppId passt nicht zum neutralen Minimal-Host.", "targetAppId"));
  }

  if (!uiScopeMatches) {
    errors.push(createCheckError("ui_scope_mismatch", "uiScope passt nicht zum neutralen Minimal-Host.", "uiScope"));
  }

  if (!layoutProfileMatches) {
    errors.push(
      createCheckError(
        "layout_profile_mismatch",
        "layoutProfileId passt nicht zum neutralen Minimal-Host.",
        "layoutProfileId"
      )
    );
  }

  addMissingErrors(
    errors,
    "missing_element_type",
    "supportedElementTypes",
    supportedElementTypes,
    expectation.elementTypes,
    "Elementtyp"
  );
  addMissingErrors(errors, "missing_role", "supportedRoles", supportedRoles, expectation.roles, "Rolle");
  addMissingErrors(
    errors,
    "missing_supported_operation",
    "supportedOperations",
    supportedOperations,
    expectation.supportedOperations,
    "Operation"
  );

  supportedOperations.forEach((operation) => {
    if (!expectation.supportedOperations.includes(operation)) {
      errors.push(
        createCheckError(
          "unsupported_manifest_operation",
          `Operation ${operation} ist fuer den neutralen Minimal-Host nicht erlaubt.`,
          "supportedOperations"
        )
      );
    }
  });

  addMissingErrors(
    errors,
    "missing_locked_operation",
    "lockedOperations",
    lockedOperations,
    expectation.lockedOperations,
    "Sperroperation"
  );

  if (!executionModeAllowed) {
    errors.push(
      createCheckError(
        "invalid_execution_mode_for_neutral_host",
        "executionMode ist fuer diesen neutralen Minimal-Host-Check nicht erlaubt.",
        "executionMode"
      )
    );
  }

  if (!persistenceModeAllowed) {
    errors.push(
      createCheckError(
        "invalid_persistence_mode_for_neutral_host",
        "persistenceMode ist fuer diesen neutralen Minimal-Host-Check nicht erlaubt.",
        "persistenceMode"
      )
    );
  }

  if (!productiveExecutionBlocked) {
    errors.push(
      createCheckError(
        "productive_execution_not_allowed",
        "Produktive Ausfuehrung ist im neutralen Minimal-Host-Check nicht erlaubt.",
        "executionMode"
      )
    );
  }

  return cloneCheckValue({
    ok: manifestValidation.ok && errors.length === 0,
    errors,
    manifest: manifestCopy,
    expectation,
    compatibility: {
      manifestValid: Boolean(manifestValidation.ok),
      targetAppMatches,
      uiScopeMatches,
      layoutProfileMatches,
      elementTypesCovered,
      rolesCovered,
      operationsCovered,
      lockedOperationsCovered,
      executionModeAllowed,
      persistenceModeAllowed,
      productiveExecutionBlocked,
      manifestOperationsSupported,
    },
  });
}

function createNeutralMinimalHostManifestCheckReport(manifest) {
  const check = checkTargetAppAdapterManifestAgainstNeutralMinimalHost(manifest);

  return cloneCheckValue({
    ok: check.ok,
    summary: {
      targetAppId: check.expectation.targetAppId,
      uiScope: check.expectation.uiScope,
      layoutProfileId: check.expectation.layoutProfileId,
      manifestValid: check.compatibility.manifestValid,
      compatibleWithNeutralMinimalHost: check.ok,
      executionModeAllowed: check.compatibility.executionModeAllowed,
      persistenceModeAllowed: check.compatibility.persistenceModeAllowed,
      changesExecuted: false,
      storageUsed: false,
      externalTargetContacted: false,
    },
    errors: check.errors,
    compatibility: check.compatibility,
  });
}

module.exports = {
  createNeutralMinimalHostAdapterManifest,
  getNeutralMinimalHostManifestExpectation,
  checkTargetAppAdapterManifestAgainstNeutralMinimalHost,
  createNeutralMinimalHostManifestCheckReport,
};
