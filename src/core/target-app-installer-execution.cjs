"use strict";

const fs = require("node:fs");
const path = require("node:path");

const { validateTargetAppInstallerPlan } = require("./target-app-installer-plan.cjs");

const TARGET_APP_INSTALLER_EXECUTION_REQUIRED_INPUTS = Object.freeze(["installerPlan", "confirmation"]);

const TARGET_APP_INSTALLER_EXECUTION_ALLOWED_FILES = Object.freeze([
  "uiEditor/README.md",
  "uiEditor/uiEditorRegistry.js",
  "uiEditor/uiEditorLauncherButton.js",
  "uiEditor/uiEditorLauncherButton.css",
  "uiEditor/uiEditorRules.md",
  "uiEditor/tests/uiEditorRegistry.test.cjs",
]);

const TARGET_APP_INSTALLER_EXECUTION_CONFIRMATION_FIELDS = Object.freeze([
  "installationConfirmed",
  "targetAppSelected",
  "installPathConfirmed",
  "noAutoScan",
  "noAutoRegister",
  "registryStructureOnly",
]);

function cloneInstallerExecutionValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneInstallerExecutionValue(entry));
  }

  if (value && typeof value === "object") {
    const clone = {};
    Object.keys(value).forEach((key) => {
      clone[key] = cloneInstallerExecutionValue(value[key]);
    });
    return clone;
  }

  return value;
}

function isInstallerExecutionObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function createInstallerExecutionIssue(code, message, field) {
  const issue = { code, message };

  if (field !== undefined) {
    issue.field = field;
  }

  return issue;
}

function getTargetAppInstallerExecutionRequiredInputs() {
  return TARGET_APP_INSTALLER_EXECUTION_REQUIRED_INPUTS.slice();
}

function createTargetAppInstallerExecutionPreview(inputs) {
  const normalized = normalizeExecutionInputs(inputs);
  const plan = normalized.installerPlan;
  const planValidation = validateTargetAppInstallerPlan(plan);
  const safetyValidation = validateInstallableFileSafety(plan);
  const errors = normalized.errors.concat(planValidation.errors || [], safetyValidation.errors);

  return {
    ok: errors.length === 0,
    errors: errors.map((issue) => cloneInstallerExecutionValue(issue)),
    preview: createExecutionPreview(plan),
  };
}

function executeTargetAppInstallerPlan(inputs) {
  const normalized = normalizeExecutionInputs(inputs);
  const plan = normalized.installerPlan;
  const planValidation = validateTargetAppInstallerPlan(plan);
  const confirmationValidation = validateExecutionConfirmation(normalized.confirmation);
  const safetyValidation = validateInstallableFileSafety(plan);
  const targetValidation = validateTargetWriteSet(plan);
  const errors = normalized.errors
    .concat(planValidation.errors || [])
    .concat(confirmationValidation.errors)
    .concat(safetyValidation.errors)
    .concat(targetValidation.errors);

  if (errors.length > 0) {
    return {
      ok: false,
      errors: errors.map((issue) => cloneInstallerExecutionValue(issue)),
      writtenFiles: [],
    };
  }

  const filesToWrite = buildTargetFiles(plan.targetAppPath);

  filesToWrite.forEach((file) => {
    fs.mkdirSync(path.dirname(file.absolutePath), { recursive: true });
    fs.writeFileSync(file.absolutePath, file.content, "utf8");
  });

  return {
    ok: true,
    errors: [],
    writtenFiles: filesToWrite.map((file) => file.relativePath),
  };
}

function normalizeExecutionInputs(inputs) {
  if (!isInstallerExecutionObject(inputs)) {
    return {
      errors: [
        createInstallerExecutionIssue(
          "invalid_target_app_installer_execution_inputs",
          "Ziel-App-Installer-Ausfuehrungseingaben muessen ein Objekt sein."
        ),
      ],
      installerPlan: undefined,
      confirmation: undefined,
    };
  }

  const errors = [];

  TARGET_APP_INSTALLER_EXECUTION_REQUIRED_INPUTS.forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(inputs, field)) {
      errors.push(
        createInstallerExecutionIssue(
          "missing_required_execution_input",
          `${field} muss fuer die Ziel-App-Installer-Ausfuehrung uebergeben werden.`,
          field
        )
      );
    }
  });

  return {
    errors,
    installerPlan: inputs.installerPlan,
    confirmation: inputs.confirmation,
  };
}

function createExecutionPreview(plan) {
  const safePlan = isInstallerExecutionObject(plan) ? plan : {};

  return {
    targetAppPath: typeof safePlan.targetAppPath === "string" ? safePlan.targetAppPath : undefined,
    targetAppId: typeof safePlan.targetAppId === "string" ? safePlan.targetAppId : undefined,
    selectedMode: typeof safePlan.selectedMode === "string" ? safePlan.selectedMode : undefined,
    filesToCreate: TARGET_APP_INSTALLER_EXECUTION_ALLOWED_FILES.slice(),
    blockedActions: Array.isArray(safePlan.blockedActions)
      ? safePlan.blockedActions.map((entry) => cloneInstallerExecutionValue(entry))
      : [],
    requiresConfirmation: Array.isArray(safePlan.requiresConfirmation)
      ? safePlan.requiresConfirmation.map((entry) => cloneInstallerExecutionValue(entry))
      : [],
    willWriteFiles: false,
    willScanUi: false,
    willModifyTargetUi: false,
    willRegisterElements: false,
  };
}

function validateExecutionConfirmation(confirmation) {
  if (!isInstallerExecutionObject(confirmation)) {
    return {
      errors: [
        createInstallerExecutionIssue(
          "missing_execution_confirmation",
          "Ziel-App-Installer-Ausfuehrung benoetigt eine ausdrueckliche Bestaetigung.",
          "confirmation"
        ),
      ],
    };
  }

  const errors = [];

  TARGET_APP_INSTALLER_EXECUTION_CONFIRMATION_FIELDS.forEach((field) => {
    if (confirmation[field] !== true) {
      errors.push(
        createInstallerExecutionIssue(
          "missing_execution_confirmation_flag",
          `${field} muss ausdruecklich true sein, bevor Dateien geschrieben werden.`,
          `confirmation.${field}`
        )
      );
    }
  });

  return { errors };
}

function validateInstallableFileSafety(plan) {
  if (!isInstallerExecutionObject(plan) || !Array.isArray(plan.installableFiles)) {
    return { errors: [] };
  }

  const errors = [];

  plan.installableFiles.forEach((installableFile) => {
    if (typeof installableFile !== "string" || installableFile.trim() === "") {
      errors.push(
        createInstallerExecutionIssue(
          "invalid_installable_file_path",
          "installableFiles darf nur nicht leere relative Dateipfade enthalten.",
          "installableFiles"
        )
      );
      return;
    }

    if (path.isAbsolute(installableFile)) {
      errors.push(
        createInstallerExecutionIssue(
          "absolute_installable_file_path",
          "Absolute Dateipfade sind in installableFiles nicht erlaubt.",
          "installableFiles"
        )
      );
    }

    const segments = installableFile.split(/[\\/]+/u);
    if (segments.includes("..")) {
      errors.push(
        createInstallerExecutionIssue(
          "traversal_installable_file_path",
          "Pfade mit .. sind in installableFiles nicht erlaubt.",
          "installableFiles"
        )
      );
    }

    if (!TARGET_APP_INSTALLER_EXECUTION_ALLOWED_FILES.includes(installableFile)) {
      errors.push(
        createInstallerExecutionIssue(
          "unsupported_installable_file_path",
          "Der Ziel-App-Installer darf nur die erlaubte Grundstruktur schreiben.",
          "installableFiles"
        )
      );
    }
  });

  return { errors };
}

function validateTargetWriteSet(plan) {
  if (!isInstallerExecutionObject(plan) || typeof plan.targetAppPath !== "string" || plan.targetAppPath.trim() === "") {
    return { errors: [] };
  }

  const errors = [];
  const overwrite = plan.overwrite === true;
  const targetRoot = path.resolve(plan.targetAppPath);
  const filesToWrite = buildTargetFiles(targetRoot);

  filesToWrite.forEach((file) => {
    if (!isPathInsideTargetRoot(file.absolutePath, targetRoot)) {
      errors.push(
        createInstallerExecutionIssue(
          "target_file_outside_target_app_path",
          "Zielpfade ausserhalb von targetAppPath sind nicht erlaubt.",
          file.relativePath
        )
      );
    }

    if (!overwrite && fs.existsSync(file.absolutePath)) {
      errors.push(
        createInstallerExecutionIssue(
          "target_file_already_exists",
          "Bestehende Dateien werden ohne overwrite === true nicht ueberschrieben.",
          file.relativePath
        )
      );
    }
  });

  return { errors };
}

function isPathInsideTargetRoot(candidatePath, targetRoot) {
  const relative = path.relative(targetRoot, candidatePath);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function buildTargetFiles(targetAppPath) {
  const targetRoot = path.resolve(targetAppPath);

  return TARGET_APP_INSTALLER_EXECUTION_ALLOWED_FILES.map((relativePath) => ({
    relativePath,
    absolutePath: path.resolve(targetRoot, relativePath),
    content: createTargetFileContent(relativePath),
  }));
}

function createTargetFileContent(relativePath) {
  if (relativePath === "uiEditor/README.md") {
    return `# UI-Editor Registry-Struktur\n\nDiese vorbereitete Grundstruktur ermoeglicht einer Ziel-App, UI-Elemente explizit fuer den UI-Editor zu registrieren.\n\nDer UI-Editor bringt einen eigenen Launcher-Button als Artefakt mit und registriert ihn als verschiebbares UI-Editor-Element.\n\nDie Struktur enthaelt keine automatisch erkannten Elemente, keine Fachdaten und keine Ziel-App-Fachlogik.\n`;
  }

  if (relativePath === "uiEditor/uiEditorRegistry.js") {
    return `"use strict";\n\nconst uiEditorRegistry = Object.freeze({\n  uiScopes: Object.freeze([\n    Object.freeze({\n      uiScopeId: "uiEditor.global",\n      label: "UI-Editor globale Elemente",\n      elements: Object.freeze([\n        Object.freeze({\n          id: "uiEditor.launcherButton",\n          type: "button",\n          role: "editor-launcher",\n          area: "overlay",\n          position: Object.freeze({ x: 24, y: 24 }),\n          editable: true,\n          allowedOps: Object.freeze(["move", "hide", "show"]),\n          lockedOps: Object.freeze(["delete", "executeTargetAction", "modifyDomainData"]),\n        }),\n      ]),\n    }),\n  ]),\n});\n\nmodule.exports = { uiEditorRegistry };\n`;
  }

  if (relativePath === "uiEditor/uiEditorLauncherButton.js") {
    return `"use strict";\n\nconst UI_EDITOR_LAUNCHER_BUTTON_DEFAULTS = Object.freeze({\n  id: "uiEditor.launcherButton",\n  type: "button",\n  role: "editor-launcher",\n  area: "overlay",\n  label: "UI-Editor",\n  cssClassName: "ui-editor-launcher-button",\n  position: Object.freeze({ x: 24, y: 24 }),\n});\n\nfunction cloneLauncherButtonDefaults() {\n  return {\n    id: UI_EDITOR_LAUNCHER_BUTTON_DEFAULTS.id,\n    type: UI_EDITOR_LAUNCHER_BUTTON_DEFAULTS.type,\n    role: UI_EDITOR_LAUNCHER_BUTTON_DEFAULTS.role,\n    area: UI_EDITOR_LAUNCHER_BUTTON_DEFAULTS.area,\n    label: UI_EDITOR_LAUNCHER_BUTTON_DEFAULTS.label,\n    cssClassName: UI_EDITOR_LAUNCHER_BUTTON_DEFAULTS.cssClassName,\n    position: {\n      x: UI_EDITOR_LAUNCHER_BUTTON_DEFAULTS.position.x,\n      y: UI_EDITOR_LAUNCHER_BUTTON_DEFAULTS.position.y,\n    },\n  };\n}\n\nfunction createUiEditorLauncherButton(options) {\n  const normalizedOptions = options && typeof options === "object" ? options : {};\n  const position = normalizedOptions.position && typeof normalizedOptions.position === "object"\n    ? normalizedOptions.position\n    : UI_EDITOR_LAUNCHER_BUTTON_DEFAULTS.position;\n\n  return {\n    ...cloneLauncherButtonDefaults(),\n    label: typeof normalizedOptions.label === "string" && normalizedOptions.label.trim() !== ""\n      ? normalizedOptions.label\n      : UI_EDITOR_LAUNCHER_BUTTON_DEFAULTS.label,\n    position: {\n      x: Number.isFinite(position.x) ? position.x : UI_EDITOR_LAUNCHER_BUTTON_DEFAULTS.position.x,\n      y: Number.isFinite(position.y) ? position.y : UI_EDITOR_LAUNCHER_BUTTON_DEFAULTS.position.y,\n    },\n  };\n}\n\nmodule.exports = {\n  UI_EDITOR_LAUNCHER_BUTTON_DEFAULTS,\n  createUiEditorLauncherButton,\n};\n`;
  }

  if (relativePath === "uiEditor/uiEditorLauncherButton.css") {
    return `.ui-editor-launcher-button {\n  position: fixed;\n  left: 24px;\n  top: 24px;\n  z-index: 2147483000;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  min-width: 44px;\n  min-height: 44px;\n  padding: 0 14px;\n  border: 1px solid #64748b;\n  border-radius: 999px;\n  background: #0f172a;\n  color: #f8fafc;\n  font: 600 14px/1.2 system-ui, sans-serif;\n  box-shadow: 0 8px 24px rgb(15 23 42 / 24%);\n  cursor: pointer;\n}\n\n.ui-editor-launcher-button[hidden] {\n  display: none;\n}\n`;
  }

  if (relativePath === "uiEditor/uiEditorRules.md") {
    return `# UI-Editor Regeln\n\n- Kein Scan.\n- Keine automatische Elementerkennung.\n- Keine automatische Freigabe.\n- Jede UI muss ihre Elemente explizit registrieren.\n- Fachlogik und Fachdaten bleiben in der Ziel-App.\n`;
  }

  if (relativePath === "uiEditor/tests/uiEditorRegistry.test.cjs") {
    return `#!/usr/bin/env node\n\nconst assert = require("node:assert/strict");\nconst path = require("node:path");\n\nconst { uiEditorRegistry } = require(path.resolve(__dirname, "../uiEditorRegistry.js"));\n\nassert.equal(Boolean(uiEditorRegistry), true);\nassert.equal(Array.isArray(uiEditorRegistry.uiScopes), true);\nassert.equal(uiEditorRegistry.uiScopes.length, 1);\nassert.equal(uiEditorRegistry.uiScopes[0].uiScopeId, "uiEditor.global");\nassert.equal(Array.isArray(uiEditorRegistry.uiScopes[0].elements), true);\nassert.equal(uiEditorRegistry.uiScopes[0].elements.length, 1);\nassert.equal(uiEditorRegistry.uiScopes[0].elements[0].id, "uiEditor.launcherButton");\nassert.deepEqual(uiEditorRegistry.uiScopes[0].elements[0].position, { x: 24, y: 24 });\nassert.equal(uiEditorRegistry.uiScopes[0].elements[0].editable, true);\nassert.deepEqual(uiEditorRegistry.uiScopes[0].elements[0].allowedOps, ["move", "hide", "show"]);\nassert.equal(uiEditorRegistry.uiScopes[0].elements[0].lockedOps.includes("delete"), true);\nassert.equal(uiEditorRegistry.uiScopes[0].elements[0].lockedOps.includes("executeTargetAction"), true);\n\nconsole.log("TESTS OK: uiEditorRegistry contract");\n`;
  }

  throw new Error(`Unsupported target file: ${relativePath}`);
}

module.exports = {
  getTargetAppInstallerExecutionRequiredInputs,
  createTargetAppInstallerExecutionPreview,
  executeTargetAppInstallerPlan,
};
