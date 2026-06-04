"use strict";

const fs = require("node:fs");
const path = require("node:path");

const { validateTargetAppInstallerPlan } = require("./target-app-installer-plan.cjs");
const {
  TARGET_APP_INSTALLER_AGENTS_RELATIVE_PATH,
  buildTargetAppInstallerManagedFiles,
  getTargetAppInstallerInstallableFiles,
  createAgentsFileContent,
  appendAgentsBlock,
  hasMarkedAgentsBlock,
  isSafeRelativePath,
  createTargetAppInstallerReport,
} = require("./target-app-installer-artifacts.cjs");

const TARGET_APP_INSTALLER_EXECUTION_REQUIRED_INPUTS = Object.freeze(["installerPlan", "confirmation"]);

const TARGET_APP_INSTALLER_EXECUTION_ALLOWED_FILES = Object.freeze(getTargetAppInstallerInstallableFiles());

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

  const agentsWriteResult = writeAgentsFile(plan.targetAppPath);
  const writtenFiles = filesToWrite.map((file) => file.relativePath);

  if (agentsWriteResult.written) {
    writtenFiles.push(TARGET_APP_INSTALLER_AGENTS_RELATIVE_PATH);
  }

  return {
    ok: true,
    errors: [],
    writtenFiles,
    report: createTargetAppInstallerReport(plan, {
      phase: "install",
      affectedFiles: TARGET_APP_INSTALLER_EXECUTION_ALLOWED_FILES,
      writtenFiles,
    }),
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
    agentsFile: TARGET_APP_INSTALLER_AGENTS_RELATIVE_PATH,
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
    report: createTargetAppInstallerReport(safePlan, {
      phase: "preview",
      affectedFiles: TARGET_APP_INSTALLER_EXECUTION_ALLOWED_FILES,
      writtenFiles: [],
    }),
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
    if (!isSafeRelativePath(installableFile)) {
      errors.push(
        createInstallerExecutionIssue(
          "invalid_installable_file_path",
          "installableFiles darf nur nicht leere relative Dateipfade enthalten.",
          "installableFiles"
        )
      );
      if (path.isAbsolute(installableFile)) {
        errors.push(
          createInstallerExecutionIssue(
            "absolute_installable_file_path",
            "Absolute Dateipfade sind in installableFiles nicht erlaubt.",
            "installableFiles"
          )
        );
      }

      const segments = typeof installableFile === "string" ? installableFile.split(/[\\/]+/u) : [];
      if (segments.includes("..")) {
        errors.push(
          createInstallerExecutionIssue(
            "traversal_installable_file_path",
            "Pfade mit .. sind in installableFiles nicht erlaubt.",
            "installableFiles"
          )
        );
      }

      return;
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
  const agentsPath = path.resolve(targetRoot, TARGET_APP_INSTALLER_AGENTS_RELATIVE_PATH);

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

  if (!isPathInsideTargetRoot(agentsPath, targetRoot)) {
    errors.push(
      createInstallerExecutionIssue(
        "target_file_outside_target_app_path",
        "Zielpfade ausserhalb von targetAppPath sind nicht erlaubt.",
        TARGET_APP_INSTALLER_AGENTS_RELATIVE_PATH
      )
    );
  }

  if (fs.existsSync(agentsPath) && fs.statSync(agentsPath).isDirectory()) {
    errors.push(
      createInstallerExecutionIssue(
        "target_file_is_directory",
        "AGENTS.md muss als Datei vorliegen oder fehlen.",
        TARGET_APP_INSTALLER_AGENTS_RELATIVE_PATH
      )
    );
  }

  return { errors };
}

function isPathInsideTargetRoot(candidatePath, targetRoot) {
  const relative = path.relative(targetRoot, candidatePath);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function buildTargetFiles(targetAppPath) {
  return buildTargetAppInstallerManagedFiles(targetAppPath);
}

function writeAgentsFile(targetAppPath) {
  const targetRoot = path.resolve(targetAppPath);
  const absolutePath = path.resolve(targetRoot, TARGET_APP_INSTALLER_AGENTS_RELATIVE_PATH);

  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });

  if (!fs.existsSync(absolutePath)) {
    fs.writeFileSync(absolutePath, createAgentsFileContent(), "utf8");
    return { written: true, action: "created" };
  }

  const currentContent = fs.readFileSync(absolutePath, "utf8");
  if (hasMarkedAgentsBlock(currentContent)) {
    return { written: false, action: "already-present" };
  }

  fs.writeFileSync(absolutePath, appendAgentsBlock(currentContent), "utf8");
  return { written: true, action: "appended" };
}

module.exports = {
  getTargetAppInstallerExecutionRequiredInputs,
  createTargetAppInstallerExecutionPreview,
  executeTargetAppInstallerPlan,
};
