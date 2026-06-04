"use strict";

const fs = require("node:fs");
const path = require("node:path");

const {
  TARGET_APP_INSTALLER_AGENTS_RELATIVE_PATH,
  getTargetAppInstallerManagedFiles,
  getTargetAppInstallerUninstallEmptyDirectories,
  isSafeRelativePath,
  hasMarkedAgentsBlock,
  removeMarkedAgentsBlock,
  createTargetAppInstallerUninstallReport,
} = require("./target-app-installer-artifacts.cjs");

const TARGET_APP_INSTALLER_UNINSTALL_REQUIRED_INPUTS = Object.freeze(["targetAppPath", "confirmation"]);

const TARGET_APP_INSTALLER_UNINSTALL_ALLOWED_FILES = Object.freeze(getTargetAppInstallerManagedFiles());

const TARGET_APP_INSTALLER_UNINSTALL_EMPTY_DIRECTORIES = Object.freeze(
  getTargetAppInstallerUninstallEmptyDirectories()
);

const TARGET_APP_INSTALLER_UNINSTALL_CONFIRMATION_FIELDS = Object.freeze([
  "uninstallConfirmed",
  "targetAppSelected",
  "installPathConfirmed",
  "removeUiEditorArtifactsOnly",
  "keepTargetAppSource",
]);

function cloneUninstallValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneUninstallValue(entry));
  }

  if (value && typeof value === "object") {
    const clone = {};
    Object.keys(value).forEach((key) => {
      clone[key] = cloneUninstallValue(value[key]);
    });
    return clone;
  }

  return value;
}

function isUninstallObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function createUninstallIssue(code, message, field, details) {
  const issue = { code, message };

  if (field !== undefined) {
    issue.field = field;
  }

  if (details !== undefined) {
    issue.details = cloneUninstallValue(details);
  }

  return issue;
}

function getTargetAppInstallerUninstallRequiredInputs() {
  return TARGET_APP_INSTALLER_UNINSTALL_REQUIRED_INPUTS.slice();
}

function createTargetAppInstallerUninstallPreview(inputs) {
  const validation = validateTargetAppInstallerUninstallRequest(inputs, { requireConfirmation: false });

  return {
    ok: validation.errors.length === 0,
    errors: validation.errors.map((issue) => cloneUninstallValue(issue)),
    preview: createUninstallPreview(validation.targetAppPath),
  };
}

function uninstallTargetAppInstallerArtifacts(inputs) {
  const validation = validateTargetAppInstallerUninstallRequest(inputs, { requireConfirmation: true });

  if (validation.errors.length > 0) {
    return {
      ok: false,
      errors: validation.errors.map((issue) => cloneUninstallValue(issue)),
      removedFiles: [],
      removedDirectories: [],
      report: createTargetAppInstallerUninstallReport(validation.targetAppPath, [], []),
    };
  }

  const removedFiles = [];
  const removedDirectories = [];
  const updatedFiles = [];

  TARGET_APP_INSTALLER_UNINSTALL_ALLOWED_FILES.forEach((relativePath) => {
    const absolutePath = resolveTargetPath(validation.targetAppPath, relativePath);
    if (fs.existsSync(absolutePath)) {
      fs.rmSync(absolutePath, { force: true });
      removedFiles.push(relativePath);
    }
  });

  if (removeAgentsBlock(validation.targetAppPath)) {
    updatedFiles.push(TARGET_APP_INSTALLER_AGENTS_RELATIVE_PATH);
  }

  TARGET_APP_INSTALLER_UNINSTALL_EMPTY_DIRECTORIES.forEach((relativePath) => {
    const absolutePath = resolveTargetPath(validation.targetAppPath, relativePath);
    if (fs.existsSync(absolutePath) && isDirectoryEmpty(absolutePath)) {
      fs.rmdirSync(absolutePath);
      removedDirectories.push(relativePath);
    }
  });

  return {
    ok: true,
    errors: [],
    removedFiles,
    removedDirectories,
    updatedFiles,
    report: createTargetAppInstallerUninstallReport(validation.targetAppPath, removedFiles, updatedFiles),
  };
}

function validateTargetAppInstallerUninstallRequest(inputs, options) {
  const normalizedOptions = isUninstallObject(options) ? options : {};
  const requireConfirmation = normalizedOptions.requireConfirmation !== false;
  const normalized = normalizeUninstallInputs(inputs);
  const errors = normalized.errors.slice();

  if (typeof normalized.targetAppPath === "string") {
    errors.push(...validateTargetAppPath(normalized.targetAppPath));
  }

  if (requireConfirmation) {
    errors.push(...validateUninstallConfirmation(normalized.confirmation));
  }

  errors.push(...validateKnownInstallerArtifactPaths());

  if (typeof normalized.targetAppPath === "string" && errors.length === 0) {
    errors.push(...validateNoUnknownUiEditorFiles(normalized.targetAppPath));
  }

  return {
    ok: errors.length === 0,
    errors: errors.map((issue) => cloneUninstallValue(issue)),
    targetAppPath: typeof normalized.targetAppPath === "string" ? normalized.targetAppPath : undefined,
  };
}

function normalizeUninstallInputs(inputs) {
  if (!isUninstallObject(inputs)) {
    return {
      errors: [
        createUninstallIssue(
          "invalid_target_app_installer_uninstall_inputs",
          "Ziel-App-Installer-Deinstallationseingaben muessen ein Objekt sein."
        ),
      ],
      targetAppPath: undefined,
      confirmation: undefined,
    };
  }

  const errors = [];

  TARGET_APP_INSTALLER_UNINSTALL_REQUIRED_INPUTS.forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(inputs, field)) {
      errors.push(
        createUninstallIssue(
          "missing_required_uninstall_input",
          `${field} muss fuer die Ziel-App-Installer-Deinstallation uebergeben werden.`,
          field
        )
      );
    }
  });

  return {
    errors,
    targetAppPath: inputs.targetAppPath,
    confirmation: inputs.confirmation,
  };
}

function validateTargetAppPath(targetAppPath) {
  if (typeof targetAppPath !== "string" || targetAppPath.trim() === "") {
    return [
      createUninstallIssue(
        "invalid_target_app_path",
        "targetAppPath muss ein nicht-leerer Pfad zur Ziel-App sein.",
        "targetAppPath"
      ),
    ];
  }

  const rawPathSegments = targetAppPath.split(/[\\/]+/u).filter((segment) => segment !== "");

  if (rawPathSegments.includes("..")) {
    return [
      createUninstallIssue(
        "path-traversal-rejected",
        "targetAppPath darf keine Pfad-Traversal-Segmente enthalten.",
        "targetAppPath"
      ),
    ];
  }

  return [];
}

function validateUninstallConfirmation(confirmation) {
  if (!isUninstallObject(confirmation)) {
    return [
      createUninstallIssue(
        "missing_uninstall_confirmation",
        "Ziel-App-Installer-Deinstallation benoetigt eine ausdrueckliche Bestaetigung.",
        "confirmation"
      ),
    ];
  }

  const errors = [];

  TARGET_APP_INSTALLER_UNINSTALL_CONFIRMATION_FIELDS.forEach((field) => {
    if (confirmation[field] !== true) {
      errors.push(
        createUninstallIssue(
          "missing_uninstall_confirmation_flag",
          `${field} muss ausdruecklich true sein, bevor UI-Editor-Artefakte entfernt werden.`,
          `confirmation.${field}`
        )
      );
    }
  });

  return errors;
}

function validateKnownInstallerArtifactPaths() {
  const errors = [];
  const relativePaths = TARGET_APP_INSTALLER_UNINSTALL_ALLOWED_FILES.concat(
    TARGET_APP_INSTALLER_UNINSTALL_EMPTY_DIRECTORIES
  );

  relativePaths.forEach((relativePath) => {
    if (!isSafeRelativeInstallerPath(relativePath)) {
      errors.push(
        createUninstallIssue(
          "unsafe_installer_artifact_path",
          "Installer-Artefaktpfade muessen relativ, fest definiert und innerhalb uiEditor/ sein.",
          "installerArtifacts",
          { relativePath }
        )
      );
    }
  });

  return errors;
}

function validateNoUnknownUiEditorFiles(targetAppPath) {
  const uiEditorPath = resolveTargetPath(targetAppPath, "uiEditor");

  if (!fs.existsSync(uiEditorPath)) {
    return [];
  }

  const knownFiles = new Set(TARGET_APP_INSTALLER_UNINSTALL_ALLOWED_FILES);
  const unknownFiles = collectUiEditorFiles(targetAppPath, uiEditorPath).filter((relativePath) => !knownFiles.has(relativePath));

  if (unknownFiles.length === 0) {
    return [];
  }

  return [
    createUninstallIssue(
      "unknown-ui-editor-files",
      "Unter uiEditor/ liegen unbekannte Dateien; die Deinstallation wird ohne Teil-Loeschung blockiert.",
      "uiEditor",
      { unknownFiles: unknownFiles.sort() }
    ),
  ];
}

function collectUiEditorFiles(targetAppPath, uiEditorPath) {
  const files = [];
  const pending = [uiEditorPath];

  while (pending.length > 0) {
    const currentPath = pending.pop();
    fs.readdirSync(currentPath, { withFileTypes: true }).forEach((entry) => {
      const entryPath = path.join(currentPath, entry.name);
      const relativePath = path.relative(targetAppPath, entryPath).split(path.sep).join("/");

      if (!isSafeRelativeInstallerPath(relativePath)) {
        files.push(relativePath);
        return;
      }

      if (entry.isDirectory()) {
        pending.push(entryPath);
        return;
      }

      files.push(relativePath);
    });
  }

  return files;
}

function createUninstallPreview(targetAppPath) {
  return {
    targetAppPath: typeof targetAppPath === "string" ? targetAppPath : undefined,
    filesToRemove: TARGET_APP_INSTALLER_UNINSTALL_ALLOWED_FILES.slice(),
    filesToUpdate: [TARGET_APP_INSTALLER_AGENTS_RELATIVE_PATH],
    directoriesToRemoveIfEmpty: TARGET_APP_INSTALLER_UNINSTALL_EMPTY_DIRECTORIES.slice(),
    willRemoveFiles: false,
    willRemoveSourceFiles: false,
    willRemoveUnknownFiles: false,
    report: createTargetAppInstallerUninstallReport(targetAppPath, [], []),
  };
}

function resolveTargetPath(targetAppPath, relativePath) {
  const absolutePath = path.resolve(targetAppPath, relativePath);

  if (!isSafeRelativeInstallerPath(relativePath) || !isPathInside(absolutePath, path.resolve(targetAppPath))) {
    throw new Error(`Unsicherer Installer-Artefaktpfad: ${relativePath}`);
  }

  return absolutePath;
}

function isSafeRelativeInstallerPath(relativePath) {
  return isSafeRelativePath(relativePath);
}

function isPathInside(candidatePath, rootPath) {
  const relative = path.relative(rootPath, candidatePath);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function isDirectoryEmpty(directoryPath) {
  return fs.readdirSync(directoryPath).length === 0;
}

function removeAgentsBlock(targetAppPath) {
  const absolutePath = resolveTargetPath(targetAppPath, TARGET_APP_INSTALLER_AGENTS_RELATIVE_PATH);

  if (!fs.existsSync(absolutePath)) {
    return false;
  }

  if (fs.statSync(absolutePath).isDirectory()) {
    return false;
  }

  const content = fs.readFileSync(absolutePath, "utf8");
  if (!hasMarkedAgentsBlock(content)) {
    return false;
  }

  const nextContent = removeMarkedAgentsBlock(content);
  if (!nextContent.changed) {
    return false;
  }

  fs.writeFileSync(absolutePath, nextContent.content, "utf8");
  return true;
}

module.exports = {
  getTargetAppInstallerUninstallRequiredInputs,
  createTargetAppInstallerUninstallPreview,
  uninstallTargetAppInstallerArtifacts,
  validateTargetAppInstallerUninstallRequest,
};
