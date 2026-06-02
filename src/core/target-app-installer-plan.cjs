"use strict";

const TARGET_APP_INSTALLER_REQUIRED_INPUTS = Object.freeze([
  "targetAppPath",
  "targetAppId",
  "targetAppName",
  "selectedMode",
]);

const TARGET_APP_INSTALLER_ALLOWED_MODES = Object.freeze(["prepare-registry-structure"]);

const TARGET_APP_INSTALLER_INSTALLABLE_FILES = Object.freeze([
  "uiEditor/README.md",
  "uiEditor/uiEditorRegistry.js",
  "uiEditor/uiEditorRules.md",
  "uiEditor/tests/uiEditorRegistry.test.cjs",
]);

const TARGET_APP_INSTALLER_BLOCKED_ACTIONS = Object.freeze([
  "scan-ui",
  "auto-detect-elements",
  "auto-register-elements",
  "modify-target-ui",
  "write-domain-data",
  "execute-target-app-action",
]);

const TARGET_APP_INSTALLER_REQUIRED_CONFIRMATIONS = Object.freeze([
  "target-app-selected",
  "install-path-confirmed",
  "no-auto-scan",
  "no-auto-register",
  "registry-structure-only",
]);

function cloneInstallerValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneInstallerValue(entry));
  }

  if (value && typeof value === "object") {
    const clone = {};
    Object.keys(value).forEach((key) => {
      clone[key] = cloneInstallerValue(value[key]);
    });
    return clone;
  }

  return value;
}

function isInstallerObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function createInstallerPlanIssue(code, message, field) {
  const issue = { code, message };

  if (field !== undefined) {
    issue.field = field;
  }

  return issue;
}

function getTargetAppInstallerRequiredInputs() {
  return TARGET_APP_INSTALLER_REQUIRED_INPUTS.slice();
}

function getTargetAppInstallerInstallableFiles() {
  return TARGET_APP_INSTALLER_INSTALLABLE_FILES.slice();
}

function normalizeInstallerInputs(inputs) {
  if (!isInstallerObject(inputs)) {
    return {
      ok: false,
      errors: [
        createInstallerPlanIssue(
          "invalid_target_app_installer_inputs",
          "Ziel-App-Installer-Eingaben muessen ein Objekt sein."
        ),
      ],
    };
  }

  const errors = [];

  TARGET_APP_INSTALLER_REQUIRED_INPUTS.forEach((field) => {
    if (typeof inputs[field] !== "string" || inputs[field].trim() === "") {
      errors.push(
        createInstallerPlanIssue(
          "missing_required_input",
          `${field} muss als nicht leere Zeichenkette uebergeben werden.`,
          field
        )
      );
    }
  });

  if (
    typeof inputs.selectedMode === "string" &&
    inputs.selectedMode.trim() !== "" &&
    !TARGET_APP_INSTALLER_ALLOWED_MODES.includes(inputs.selectedMode)
  ) {
    errors.push(
      createInstallerPlanIssue(
        "unsupported_selected_mode",
        "selectedMode ist fuer den Ziel-App-Installer nicht erlaubt.",
        "selectedMode"
      )
    );
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    errors: [],
    value: {
      targetAppPath: inputs.targetAppPath,
      targetAppId: inputs.targetAppId,
      targetAppName: inputs.targetAppName,
      selectedMode: inputs.selectedMode,
    },
  };
}

function createTargetAppInstallerPlan(inputs) {
  const inputResult = normalizeInstallerInputs(inputs);

  if (!inputResult.ok) {
    const error = new Error("Ziel-App-Installer-Plan konnte nicht erzeugt werden.");
    error.code = "invalid_target_app_installer_plan_inputs";
    error.errors = inputResult.errors.map((issue) => cloneInstallerValue(issue));
    throw error;
  }

  const normalizedInputs = inputResult.value;

  return {
    targetAppId: cloneInstallerValue(normalizedInputs.targetAppId),
    targetAppName: cloneInstallerValue(normalizedInputs.targetAppName),
    targetAppPath: cloneInstallerValue(normalizedInputs.targetAppPath),
    selectedMode: cloneInstallerValue(normalizedInputs.selectedMode),
    installableFiles: getTargetAppInstallerInstallableFiles(),
    blockedActions: TARGET_APP_INSTALLER_BLOCKED_ACTIONS.slice(),
    requiresConfirmation: TARGET_APP_INSTALLER_REQUIRED_CONFIRMATIONS.slice(),
  };
}

function validateStringField(plan, field, errors) {
  if (typeof plan[field] !== "string" || plan[field].trim() === "") {
    errors.push(
      createInstallerPlanIssue(
        "missing_required_plan_field",
        `${field} muss im Ziel-App-Installer-Plan vorhanden sein.`,
        field
      )
    );
  }
}

function validateRequiredArrayEntries(plan, field, requiredEntries, errors) {
  if (!Array.isArray(plan[field])) {
    errors.push(
      createInstallerPlanIssue(
        "missing_required_plan_field",
        `${field} muss im Ziel-App-Installer-Plan als Liste vorhanden sein.`,
        field
      )
    );
    return;
  }

  requiredEntries.forEach((entry) => {
    if (!plan[field].includes(entry)) {
      errors.push(
        createInstallerPlanIssue(
          "missing_required_plan_entry",
          `${field} enthaelt den Pflichtwert ${entry} nicht.`,
          field
        )
      );
    }
  });
}

function validateTargetAppInstallerPlan(plan) {
  if (!isInstallerObject(plan)) {
    return {
      ok: false,
      errors: [
        createInstallerPlanIssue(
          "invalid_target_app_installer_plan",
          "Ziel-App-Installer-Plan muss ein Objekt sein."
        ),
      ],
    };
  }

  const errors = [];

  validateStringField(plan, "targetAppId", errors);
  validateStringField(plan, "targetAppName", errors);
  validateStringField(plan, "targetAppPath", errors);
  validateStringField(plan, "selectedMode", errors);

  if (
    typeof plan.selectedMode === "string" &&
    plan.selectedMode.trim() !== "" &&
    !TARGET_APP_INSTALLER_ALLOWED_MODES.includes(plan.selectedMode)
  ) {
    errors.push(
      createInstallerPlanIssue(
        "unsupported_selected_mode",
        "selectedMode ist fuer den Ziel-App-Installer-Plan nicht erlaubt.",
        "selectedMode"
      )
    );
  }

  validateRequiredArrayEntries(plan, "installableFiles", TARGET_APP_INSTALLER_INSTALLABLE_FILES, errors);
  validateRequiredArrayEntries(plan, "blockedActions", TARGET_APP_INSTALLER_BLOCKED_ACTIONS, errors);
  validateRequiredArrayEntries(plan, "requiresConfirmation", TARGET_APP_INSTALLER_REQUIRED_CONFIRMATIONS, errors);

  return {
    ok: errors.length === 0,
    errors: errors.map((issue) => cloneInstallerValue(issue)),
  };
}

module.exports = {
  getTargetAppInstallerRequiredInputs,
  getTargetAppInstallerInstallableFiles,
  createTargetAppInstallerPlan,
  validateTargetAppInstallerPlan,
};
