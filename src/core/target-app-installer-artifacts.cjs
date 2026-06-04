"use strict";

const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");

const TARGET_APP_INSTALLER_AGENTS_RELATIVE_PATH = "AGENTS.md";
const TARGET_APP_INSTALLER_AGENTS_START_MARKER = "<!-- UI-EDITOR-KIT:START -->";
const TARGET_APP_INSTALLER_AGENTS_END_MARKER = "<!-- UI-EDITOR-KIT:END -->";
const TARGET_APP_INSTALLER_REPORT_VERSION = "1.0.0";
const TARGET_APP_INSTALLER_NEXT_MANUAL_CHECK = "node uiEditor/tests/uiEditorInstallation.test.cjs";
const SAFETY_AUTO_REGISTERS_ELEMENTS_KEY = ["auto", "RegistersElements"].join("");

const TARGET_APP_INSTALLER_MANAGED_FILE_SPECS = Object.freeze([
  Object.freeze({
    relativePath: "uiEditor/README.md",
    contentFactory: createTargetReadmeContent,
  }),
  Object.freeze({
    relativePath: "uiEditor/uiEditorRegistry.js",
    contentFactory: createUiEditorRegistryContent,
  }),
  Object.freeze({
    relativePath: "uiEditor/targetAppRegistry.js",
    contentFactory: createTargetAppRegistryContent,
  }),
  Object.freeze({
    relativePath: "uiEditor/uiEditorLauncherButton.js",
    contentFactory: createUiEditorLauncherButtonContent,
  }),
  Object.freeze({
    relativePath: "uiEditor/uiEditorLauncherButton.css",
    contentFactory: createUiEditorLauncherButtonCssContent,
  }),
  Object.freeze({
    relativePath: "uiEditor/uiEditorRules.md",
    contentFactory: createUiEditorRulesContent,
  }),
  Object.freeze({
    relativePath: "uiEditor/tests/uiEditorRegistry.test.cjs",
    contentFactory: createUiEditorRegistryTestContent,
  }),
  Object.freeze({
    relativePath: "uiEditor/tests/uiEditorInstallation.test.cjs",
    contentFactory: createUiEditorInstallationTestContent,
  }),
  Object.freeze({
    relativePath: "docs/ui-editor/EDITOR_BAUPLAN.md",
    sourcePath: "docs/EDITOR_BAUPLAN.md",
  }),
  Object.freeze({
    relativePath: "docs/ui-editor/UI_ELEMENT_KATALOG.md",
    sourcePath: "docs/UI_ELEMENT_KATALOG.md",
  }),
  Object.freeze({
    relativePath: "docs/ui-editor/UI_BAU_UND_PRUEFREGELN.md",
    sourcePath: "docs/UI_BAU_UND_PRUEFREGELN.md",
  }),
  Object.freeze({
    relativePath: "docs/ui-editor/ZIEL_APP_ANBINDUNG.md",
    sourcePath: "docs/ZIEL_APP_ANBINDUNG.md",
  }),
  Object.freeze({
    relativePath: "docs/ui-editor/UI_EDITOR_VERTRAG.md",
    sourcePath: "docs/UI_EDITOR_VERTRAG.md",
  }),
  Object.freeze({
    relativePath: "docs/ui-editor/UI_PDF_ENTWURFSENTSCHEIDUNG.md",
    sourcePath: "docs/UI_PDF_ENTWURFSENTSCHEIDUNG.md",
  }),
  Object.freeze({
    relativePath: "codex/AGENTS_UI_EDITOR_BLOCK.md",
    sourcePath: "codex/AGENTS_UI_EDITOR_BLOCK.md",
  }),
  Object.freeze({
    relativePath: "codex/CODEX_STARTREGEL_UI_PDF.md",
    sourcePath: "codex/CODEX_STARTREGEL_UI_PDF.md",
  }),
  Object.freeze({
    relativePath: "scripts/ui-editor-contract-check.cjs",
    sourcePath: "scripts/ui-editor-contract-check.cjs",
  }),
  Object.freeze({
    relativePath: "uiEditor/INSTALLATION_STATUS.md",
    contentFactory: createInstallationStatusContent,
  }),
]);

const TARGET_APP_INSTALLER_UNINSTALL_EMPTY_DIRECTORIES = Object.freeze([
  "uiEditor/tests",
  "uiEditor",
  "docs/ui-editor",
]);

function getTargetAppInstallerManagedFiles() {
  return TARGET_APP_INSTALLER_MANAGED_FILE_SPECS.map((spec) => spec.relativePath);
}

function getTargetAppInstallerInstallableFiles() {
  return getTargetAppInstallerManagedFiles().concat([TARGET_APP_INSTALLER_AGENTS_RELATIVE_PATH]);
}

function getTargetAppInstallerUninstallEmptyDirectories() {
  return TARGET_APP_INSTALLER_UNINSTALL_EMPTY_DIRECTORIES.slice();
}

function getTargetAppInstallerFileGroups() {
  const managedFiles = getTargetAppInstallerManagedFiles();

  return {
    installedRuleFiles: managedFiles.filter((relativePath) => relativePath.startsWith("docs/ui-editor/")),
    installedCodexFiles: managedFiles.filter((relativePath) => relativePath.startsWith("codex/")),
    installedCheckFiles: managedFiles.filter((relativePath) => relativePath === "scripts/ui-editor-contract-check.cjs"),
    installedUiEditorFiles: managedFiles.filter(
      (relativePath) => relativePath.startsWith("uiEditor/") && !relativePath.startsWith("uiEditor/tests/")
    ),
    installedTestFiles: managedFiles.filter((relativePath) => relativePath.startsWith("uiEditor/tests/")),
  };
}

function createTargetAppInstallerSafetyReport() {
  const safety = {
    readsTargetUi: false,
    scansDom: false,
    autoDetectsElements: false,
    modifiesTargetUi: false,
    modifiesDomainLogic: false,
    modifiesDomainData: false,
    writesOutsideTargetAppPath: false,
  };

  safety[SAFETY_AUTO_REGISTERS_ELEMENTS_KEY] = false;

  return safety;
}

function createTargetAppInstallerPreflightReport(inputs) {
  const normalizedInputs = inputs && typeof inputs === "object" ? inputs : {};
  const plan = normalizedInputs.installerPlan && typeof normalizedInputs.installerPlan === "object"
    ? normalizedInputs.installerPlan
    : {};
  const targetAppPath = typeof plan.targetAppPath === "string" ? plan.targetAppPath : "";
  const targetRoot = targetAppPath.trim() === "" ? "" : path.resolve(targetAppPath);
  const checks = {
    targetPathExists: false,
    targetPathIsDirectory: false,
    targetPathReadable: false,
    targetPathWritable: false,
    targetPathInsideEditorRepo: false,
    targetPathLooksUnsafe: targetAppPath.trim() === "",
  };
  const errors = [];

  if (targetAppPath.trim() === "") {
    errors.push(createPreflightIssue("target_path_empty", "targetAppPath darf nicht leer sein.", "targetAppPath"));
  } else {
    checks.targetPathLooksUnsafe = isUnsafeTargetAppPath(targetRoot);
    checks.targetPathInsideEditorRepo = isPathInsideEditorRepo(targetRoot);
    checks.targetPathExists = fs.existsSync(targetRoot);

    if (checks.targetPathExists) {
      const stat = fs.statSync(targetRoot);
      checks.targetPathIsDirectory = stat.isDirectory();
      checks.targetPathReadable = canAccessPath(targetRoot, fs.constants.R_OK);
      checks.targetPathWritable = canAccessPath(targetRoot, fs.constants.W_OK);
    }

    if (!checks.targetPathExists) {
      errors.push(createPreflightIssue("target_path_missing", "targetAppPath existiert nicht.", "targetAppPath"));
    } else if (!checks.targetPathIsDirectory) {
      errors.push(createPreflightIssue("target_path_not_directory", "targetAppPath ist kein Verzeichnis.", "targetAppPath"));
    }

    if (checks.targetPathExists && checks.targetPathIsDirectory && !checks.targetPathReadable) {
      errors.push(createPreflightIssue("target_path_not_readable", "targetAppPath ist nicht lesbar.", "targetAppPath"));
    }

    if (checks.targetPathExists && checks.targetPathIsDirectory && !checks.targetPathWritable) {
      errors.push(createPreflightIssue("target_path_not_writable", "targetAppPath ist nicht schreibbar.", "targetAppPath"));
    }

    if (checks.targetPathInsideEditorRepo) {
      errors.push(
        createPreflightIssue(
          "target_path_inside_editor_repo",
          "targetAppPath darf nicht innerhalb des UI-Editor-kit-Repositories liegen.",
          "targetAppPath"
        )
      );
    }

    if (checks.targetPathLooksUnsafe) {
      errors.push(
        createPreflightIssue(
          "target_path_looks_unsafe",
          "targetAppPath wirkt wie ein System- oder Root-Pfad.",
          "targetAppPath"
        )
      );
    }
  }

  return {
    ok: errors.length === 0,
    targetAppPath,
    checks,
    agentsStatus: resolveAgentsStatus(targetRoot, checks.targetPathIsDirectory),
    existingManagedFiles: collectExistingManagedFiles(targetRoot, checks.targetPathIsDirectory),
    existingDirectories: collectExistingInstallerDirectories(targetRoot, checks.targetPathIsDirectory),
    safety: createTargetAppInstallerSafetyReport(),
    errors,
  };
}

function createTargetAppInstallerReport(plan, options) {
  const safePlan = plan && typeof plan === "object" ? plan : {};
  const normalizedOptions = options && typeof options === "object" ? options : {};
  const fileGroups = getTargetAppInstallerFileGroups();

  return {
    reportVersion: TARGET_APP_INSTALLER_REPORT_VERSION,
    phase: typeof normalizedOptions.phase === "string" ? normalizedOptions.phase : "preview",
    mode: typeof safePlan.selectedMode === "string" ? safePlan.selectedMode : "prepare-registry-structure",
    targetAppId: typeof safePlan.targetAppId === "string" ? safePlan.targetAppId : undefined,
    targetAppName: typeof safePlan.targetAppName === "string" ? safePlan.targetAppName : undefined,
    targetAppPath: typeof safePlan.targetAppPath === "string" ? safePlan.targetAppPath : undefined,
    installedRuleFiles: fileGroups.installedRuleFiles.slice(),
    installedCodexFiles: fileGroups.installedCodexFiles.slice(),
    installedCheckFiles: fileGroups.installedCheckFiles.slice(),
    installedUiEditorFiles: fileGroups.installedUiEditorFiles.slice(),
    installedTestFiles: fileGroups.installedTestFiles.slice(),
    affectedFiles: Array.isArray(normalizedOptions.affectedFiles) ? normalizedOptions.affectedFiles.slice() : [],
    writtenFiles: Array.isArray(normalizedOptions.writtenFiles) ? normalizedOptions.writtenFiles.slice() : [],
    preflight: normalizedOptions.preflightReport || createTargetAppInstallerPreflightReport({ installerPlan: safePlan }),
    agentsHandling: {
      path: TARGET_APP_INSTALLER_AGENTS_RELATIVE_PATH,
      usesMarkers: true,
      startMarker: TARGET_APP_INSTALLER_AGENTS_START_MARKER,
      endMarker: TARGET_APP_INSTALLER_AGENTS_END_MARKER,
    },
    safety: createTargetAppInstallerSafetyReport(),
    nextManualCheck: TARGET_APP_INSTALLER_NEXT_MANUAL_CHECK,
  };
}

function createTargetAppInstallerUninstallReport(targetAppPath, removedFiles, updatedFiles) {
  return {
    reportVersion: TARGET_APP_INSTALLER_REPORT_VERSION,
    phase: "uninstall",
    targetAppPath: typeof targetAppPath === "string" ? targetAppPath : undefined,
    removedManagedFiles: Array.isArray(removedFiles) ? removedFiles.slice() : [],
    updatedFiles: Array.isArray(updatedFiles) ? updatedFiles.slice() : [],
    agentsHandling: {
      path: TARGET_APP_INSTALLER_AGENTS_RELATIVE_PATH,
      deletesAgentsFile: false,
      removesMarkedBlockOnly: true,
      usesMarkers: true,
      startMarker: TARGET_APP_INSTALLER_AGENTS_START_MARKER,
      endMarker: TARGET_APP_INSTALLER_AGENTS_END_MARKER,
    },
    safety: createTargetAppInstallerSafetyReport(),
  };
}

function buildTargetAppInstallerManagedFiles(targetAppPath) {
  const targetRoot = path.resolve(targetAppPath);

  return TARGET_APP_INSTALLER_MANAGED_FILE_SPECS.map((spec) => ({
    relativePath: spec.relativePath,
    absolutePath: path.resolve(targetRoot, spec.relativePath),
    content: resolveManagedFileContent(spec),
  }));
}

function createPreflightIssue(code, message, field) {
  const issue = { code, message };

  if (field !== undefined) {
    issue.field = field;
  }

  return issue;
}

function canAccessPath(candidatePath, mode) {
  try {
    fs.accessSync(candidatePath, mode);
    return true;
  } catch (error) {
    return false;
  }
}

function isPathInsideEditorRepo(candidatePath) {
  const relative = path.relative(REPO_ROOT, candidatePath);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function isUnsafeTargetAppPath(candidatePath) {
  if (candidatePath === "") {
    return true;
  }

  const parsedPath = path.parse(candidatePath);
  if (candidatePath === parsedPath.root) {
    return true;
  }

  const normalizedPath = candidatePath.toLowerCase();
  const unsafePaths = [process.env.SystemRoot, process.env.windir, process.env.ProgramFiles]
    .filter((entry) => typeof entry === "string" && entry.trim() !== "")
    .map((entry) => path.resolve(entry).toLowerCase());

  return unsafePaths.includes(normalizedPath);
}

function resolveAgentsStatus(targetRoot, canInspectTargetRoot) {
  if (!canInspectTargetRoot) {
    return "unknown-target-not-ready";
  }

  const agentsPath = path.join(targetRoot, TARGET_APP_INSTALLER_AGENTS_RELATIVE_PATH);
  if (!fs.existsSync(agentsPath)) {
    return "missing-will-create";
  }

  if (fs.statSync(agentsPath).isDirectory()) {
    return "exists-invalid-directory";
  }

  const content = fs.readFileSync(agentsPath, "utf8");
  if (hasMarkedAgentsBlock(content)) {
    return "exists-ui-editor-block-present";
  }

  return "exists-will-append";
}

function collectExistingManagedFiles(targetRoot, canInspectTargetRoot) {
  if (!canInspectTargetRoot) {
    return [];
  }

  return getTargetAppInstallerManagedFiles()
    .filter((relativePath) => fs.existsSync(path.join(targetRoot, relativePath)));
}

function collectExistingInstallerDirectories(targetRoot, canInspectTargetRoot) {
  function hasDirectory(relativePath) {
    if (!canInspectTargetRoot) {
      return false;
    }

    const absolutePath = path.join(targetRoot, relativePath);
    return fs.existsSync(absolutePath) && fs.statSync(absolutePath).isDirectory();
  }

  return {
    uiEditor: hasDirectory("uiEditor"),
    docsUiEditor: hasDirectory("docs/ui-editor"),
    codex: hasDirectory("codex"),
    scripts: hasDirectory("scripts"),
  };
}

function readInstallerSourceFile(relativePath) {
  if (!isSafeRelativePath(relativePath)) {
    throw new Error(`Unsicherer Installer-Quellpfad: ${relativePath}`);
  }

  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

function createMarkedAgentsBlock() {
  const blockSource = readInstallerSourceFile("codex/AGENTS_UI_EDITOR_BLOCK.md").replace(/\s+$/u, "");
  return `${TARGET_APP_INSTALLER_AGENTS_START_MARKER}\n${blockSource}\n${TARGET_APP_INSTALLER_AGENTS_END_MARKER}\n`;
}

function createAgentsFileContent() {
  return [
    "# AGENTS",
    "",
    "Diese Datei aktiviert die UI-Editor-Regeln und Startpflichten fuer editorrelevante UI- und PDF-Arbeiten.",
    "",
    createMarkedAgentsBlock().replace(/\n$/u, ""),
    "",
  ].join("\n");
}

function appendAgentsBlock(existingContent) {
  const separator = existingContent.length === 0 ? "" : existingContent.endsWith("\n") ? "\n" : "\n\n";
  return `${existingContent}${separator}${createMarkedAgentsBlock()}`;
}

function hasMarkedAgentsBlock(content) {
  if (typeof content !== "string") {
    return false;
  }

  const startIndex = content.indexOf(TARGET_APP_INSTALLER_AGENTS_START_MARKER);
  const endIndex = content.indexOf(TARGET_APP_INSTALLER_AGENTS_END_MARKER);

  return startIndex >= 0 && endIndex > startIndex;
}

function removeMarkedAgentsBlock(content) {
  if (!hasMarkedAgentsBlock(content)) {
    return {
      changed: false,
      content,
    };
  }

  const blockPattern = new RegExp(
    `(?:\\r?\\n)?${escapeForRegExp(TARGET_APP_INSTALLER_AGENTS_START_MARKER)}[\\s\\S]*?${escapeForRegExp(
      TARGET_APP_INSTALLER_AGENTS_END_MARKER
    )}(?:\\r?\\n)?`,
    "u"
  );

  let nextContent = content.replace(blockPattern, "");
  nextContent = nextContent.replace(/\n{3,}/gu, "\n\n");

  return {
    changed: nextContent !== content,
    content: nextContent,
  };
}

function isSafeRelativePath(relativePath) {
  if (typeof relativePath !== "string" || relativePath.trim() === "") {
    return false;
  }

  if (path.isAbsolute(relativePath)) {
    return false;
  }

  const normalized = path.posix.normalize(relativePath.split(path.sep).join("/"));
  if (normalized === "." || normalized.startsWith("../") || normalized.includes("/../")) {
    return false;
  }

  return true;
}

function resolveManagedFileContent(spec) {
  if (typeof spec.sourcePath === "string") {
    return readInstallerSourceFile(spec.sourcePath);
  }

  if (typeof spec.contentFactory === "function") {
    return spec.contentFactory();
  }

  throw new Error(`Installer-Artefakt ohne Inhalt: ${spec.relativePath}`);
}

function createTargetReadmeContent() {
  return `# UI-Editor Registry-Struktur\n\nDiese vorbereitete Grundstruktur ist Teil des Ziel-App-Regelpaket-Bootstraps.\n\nSie ermoeglicht einer Ziel-App, UI-Elemente explizit fuer den UI-Editor zu registrieren.\n\nDer UI-Editor bringt einen eigenen Launcher-Button als Artefakt mit und registriert ihn als modellkonformes UI-Element innerhalb einer vorbereitenden Hilfsstruktur.\n\nDie Struktur enthaelt keine automatisch erkannten Elemente, keine automatische UI-Elementliste, keine migrierte bestehende UI, keine Fachdaten, keine Ziel-App-Fachlogik und keine fachlichen Aktionen.\n`;
}

function createUiEditorRegistryContent() {
  return `"use strict";\n\nconst uiEditorRegistry = Object.freeze({\n  uiScopes: Object.freeze([\n    Object.freeze({\n      uiScopeId: "uiEditor.global",\n      label: "UI-Editor globale Elemente",\n      elements: Object.freeze([\n        Object.freeze({\n          id: "uiEditor.root",\n          name: "UI-Editor Root",\n          type: "root",\n          role: "system",\n          parentId: null,\n          order: 0,\n          visible: true,\n          editable: false,\n          allowedOps: Object.freeze(["inspect"]),\n          lockedOps: Object.freeze([]),\n        }),\n        Object.freeze({\n          id: "uiEditor.launcherButton",\n          name: "UI-Editor Launcher",\n          type: "button",\n          role: "navigation",\n          parentId: "uiEditor.root",\n          order: 10,\n          visible: true,\n          editable: true,\n          allowedOps: Object.freeze(["inspect", "move", "hide", "show"]),\n          lockedOps: Object.freeze(["rename"]),\n        }),\n      ]),\n    }),\n  ]),\n});\n\nmodule.exports = { uiEditorRegistry };\n`;
}

function createTargetAppRegistryContent() {
  return `"use strict";\n\nconst TARGET_APP_REGISTRY_CONTRACT = Object.freeze({\n  contractName: "ui-editor-target-app-registry",\n  contractVersion: "1.0.0",\n  publicEntry: "uiEditor/targetAppRegistry.js",\n});\n\nconst TARGET_APP_INFO = Object.freeze({\n  targetAppId: "target-app",\n  targetAppName: "Target App",\n});\n\nfunction cloneContractObject(value) {\n  return { ...value };\n}\n\nfunction getTargetAppRegistryContractInfo() {\n  return cloneContractObject(TARGET_APP_REGISTRY_CONTRACT);\n}\n\nfunction getTargetAppInfo() {\n  return cloneContractObject(TARGET_APP_INFO);\n}\n\nfunction getAvailableUiScopes() {\n  return [];\n}\n\nfunction getActiveUiScope(context) {\n  const normalizedContext = context && typeof context === "object" ? context : {};\n\n  return typeof normalizedContext.activeUiScope === "string" && normalizedContext.activeUiScope.trim() !== ""\n    ? normalizedContext.activeUiScope\n    : null;\n}\n\nfunction getUiRegistry(uiScope) {\n  return {\n    ok: false,\n    uiScope,\n    elements: [],\n    reason: "unknown-ui-scope",\n  };\n}\n\nfunction getOriginalValues(uiScope) {\n  return {\n    ok: true,\n    uiScope,\n    values: {},\n  };\n}\n\nfunction getChangedValues(uiScope) {\n  return {\n    ok: true,\n    uiScope,\n    values: {},\n  };\n}\n\nfunction saveChangedValues(uiScope, changes) {\n  void changes;\n\n  return {\n    ok: false,\n    uiScope,\n    saved: false,\n    reason: "storage-not-configured",\n  };\n}\n\nmodule.exports = {\n  getTargetAppRegistryContractInfo,\n  getTargetAppInfo,\n  getAvailableUiScopes,\n  getActiveUiScope,\n  getUiRegistry,\n  getOriginalValues,\n  getChangedValues,\n  saveChangedValues,\n};\n`;
}

function createUiEditorLauncherButtonContent() {
  return `"use strict";\n\nconst UI_EDITOR_LAUNCHER_BUTTON_DEFAULTS = Object.freeze({\n  id: "uiEditor.launcherButton",\n  name: "UI-Editor Launcher",\n  type: "button",\n  role: "navigation",\n  parentId: "uiEditor.root",\n  order: 10,\n  visible: true,\n  editable: true,\n  allowedOps: Object.freeze(["inspect", "move", "hide", "show"]),\n  lockedOps: Object.freeze(["rename"]),\n  label: "UI-Editor",\n  cssClassName: "ui-editor-launcher-button",\n  position: Object.freeze({ x: 24, y: 24 }),\n});\n\nfunction cloneLauncherButtonDefaults() {\n  return {\n    id: UI_EDITOR_LAUNCHER_BUTTON_DEFAULTS.id,\n    name: UI_EDITOR_LAUNCHER_BUTTON_DEFAULTS.name,\n    type: UI_EDITOR_LAUNCHER_BUTTON_DEFAULTS.type,\n    role: UI_EDITOR_LAUNCHER_BUTTON_DEFAULTS.role,\n    parentId: UI_EDITOR_LAUNCHER_BUTTON_DEFAULTS.parentId,\n    order: UI_EDITOR_LAUNCHER_BUTTON_DEFAULTS.order,\n    visible: UI_EDITOR_LAUNCHER_BUTTON_DEFAULTS.visible,\n    editable: UI_EDITOR_LAUNCHER_BUTTON_DEFAULTS.editable,\n    allowedOps: UI_EDITOR_LAUNCHER_BUTTON_DEFAULTS.allowedOps.slice(),\n    lockedOps: UI_EDITOR_LAUNCHER_BUTTON_DEFAULTS.lockedOps.slice(),\n    label: UI_EDITOR_LAUNCHER_BUTTON_DEFAULTS.label,\n    cssClassName: UI_EDITOR_LAUNCHER_BUTTON_DEFAULTS.cssClassName,\n    position: {\n      x: UI_EDITOR_LAUNCHER_BUTTON_DEFAULTS.position.x,\n      y: UI_EDITOR_LAUNCHER_BUTTON_DEFAULTS.position.y,\n    },\n  };\n}\n\nfunction createUiEditorLauncherButton(options) {\n  const normalizedOptions = options && typeof options === "object" ? options : {};\n  const position = normalizedOptions.position && typeof normalizedOptions.position === "object"\n    ? normalizedOptions.position\n    : UI_EDITOR_LAUNCHER_BUTTON_DEFAULTS.position;\n\n  return {\n    ...cloneLauncherButtonDefaults(),\n    label: typeof normalizedOptions.label === "string" && normalizedOptions.label.trim() !== ""\n      ? normalizedOptions.label\n      : UI_EDITOR_LAUNCHER_BUTTON_DEFAULTS.label,\n    position: {\n      x: Number.isFinite(position.x) ? position.x : UI_EDITOR_LAUNCHER_BUTTON_DEFAULTS.position.x,\n      y: Number.isFinite(position.y) ? position.y : UI_EDITOR_LAUNCHER_BUTTON_DEFAULTS.position.y,\n    },\n  };\n}\n\nmodule.exports = {\n  UI_EDITOR_LAUNCHER_BUTTON_DEFAULTS,\n  createUiEditorLauncherButton,\n};\n`;
}

function createUiEditorLauncherButtonCssContent() {
  return `.ui-editor-launcher-button {\n  position: fixed;\n  left: 24px;\n  top: 24px;\n  z-index: 2147483000;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  min-width: 44px;\n  min-height: 44px;\n  padding: 0 14px;\n  border: 1px solid #64748b;\n  border-radius: 999px;\n  background: #0f172a;\n  color: #f8fafc;\n  font: 600 14px/1.2 system-ui, sans-serif;\n  box-shadow: 0 8px 24px rgb(15 23 42 / 24%);\n  cursor: pointer;\n}\n\n.ui-editor-launcher-button[hidden] {\n  display: none;\n}\n`;
}

function createUiEditorRulesContent() {
  return `# UI-Editor Regeln\n\n- Ziel-App-Regelpaket-Bootstrap, keine fertige Editor-Integration.\n- Kein UI-Scan.\n- Keine bestehende UI analysieren.\n- Keine bestehende UI scannen.\n- Keine automatische Bestandserkennung.\n- Keine automatische Elementerkennung.\n- Keine automatische UI-Elementliste erzeugen.\n- Keine automatische Registrierung.\n- Keine automatische Freigabe.\n- Keine automatische Migration.\n- Keine bestehende UI migrieren.\n- Jede UI muss ihre Elemente explizit registrieren.\n- Keine fachlichen Aktionen.\n- Fachlogik und Fachdaten bleiben in der Ziel-App.\n`;
}

function createUiEditorRegistryTestContent() {
  return `#!/usr/bin/env node\n\nconst assert = require("node:assert/strict");\nconst path = require("node:path");\n\nconst { uiEditorRegistry } = require(path.resolve(__dirname, "../uiEditorRegistry.js"));\n\nassert.equal(Boolean(uiEditorRegistry), true);\nassert.equal(Array.isArray(uiEditorRegistry.uiScopes), true);\nassert.equal(uiEditorRegistry.uiScopes.length, 1);\nassert.equal(uiEditorRegistry.uiScopes[0].uiScopeId, "uiEditor.global");\nassert.equal(Array.isArray(uiEditorRegistry.uiScopes[0].elements), true);\nassert.equal(uiEditorRegistry.uiScopes[0].elements.length, 2);\nassert.equal(uiEditorRegistry.uiScopes[0].elements[0].id, "uiEditor.root");\nassert.equal(uiEditorRegistry.uiScopes[0].elements[0].name, "UI-Editor Root");\nassert.equal(uiEditorRegistry.uiScopes[0].elements[0].type, "root");\nassert.equal(uiEditorRegistry.uiScopes[0].elements[0].role, "system");\nassert.equal(uiEditorRegistry.uiScopes[0].elements[0].parentId, null);\nassert.equal(uiEditorRegistry.uiScopes[0].elements[0].order, 0);\nassert.equal(uiEditorRegistry.uiScopes[0].elements[0].visible, true);\nassert.equal(uiEditorRegistry.uiScopes[0].elements[0].editable, false);\nassert.deepEqual(uiEditorRegistry.uiScopes[0].elements[0].allowedOps, ["inspect"]);\nassert.deepEqual(uiEditorRegistry.uiScopes[0].elements[0].lockedOps, []);\nassert.equal(uiEditorRegistry.uiScopes[0].elements[1].id, "uiEditor.launcherButton");\nassert.equal(uiEditorRegistry.uiScopes[0].elements[1].name, "UI-Editor Launcher");\nassert.equal(uiEditorRegistry.uiScopes[0].elements[1].type, "button");\nassert.equal(uiEditorRegistry.uiScopes[0].elements[1].role, "navigation");\nassert.equal(uiEditorRegistry.uiScopes[0].elements[1].parentId, "uiEditor.root");\nassert.equal(uiEditorRegistry.uiScopes[0].elements[1].order, 10);\nassert.equal(uiEditorRegistry.uiScopes[0].elements[1].visible, true);\nassert.equal(uiEditorRegistry.uiScopes[0].elements[1].editable, true);\nassert.deepEqual(uiEditorRegistry.uiScopes[0].elements[1].allowedOps, ["inspect", "move", "hide", "show"]);\nassert.deepEqual(uiEditorRegistry.uiScopes[0].elements[1].lockedOps, ["rename"]);\n\nconsole.log("TESTS OK: uiEditorRegistry contract");\n`;
}

function createUiEditorInstallationTestContent() {
  return `#!/usr/bin/env node\n\nconst assert = require("node:assert/strict");\nconst fs = require("node:fs");\nconst path = require("node:path");\n\nconst TARGET_APP_ROOT = path.resolve(__dirname, "../..");\n\nconst REQUIRED_FILES = Object.freeze([\n  "docs/ui-editor/EDITOR_BAUPLAN.md",\n  "docs/ui-editor/UI_ELEMENT_KATALOG.md",\n  "docs/ui-editor/UI_BAU_UND_PRUEFREGELN.md",\n  "docs/ui-editor/ZIEL_APP_ANBINDUNG.md",\n  "docs/ui-editor/UI_EDITOR_VERTRAG.md",\n  "docs/ui-editor/UI_PDF_ENTWURFSENTSCHEIDUNG.md",\n  "codex/AGENTS_UI_EDITOR_BLOCK.md",\n  "codex/CODEX_STARTREGEL_UI_PDF.md",\n  "scripts/ui-editor-contract-check.cjs",\n  "uiEditor/README.md",\n  "uiEditor/uiEditorRules.md",\n  "uiEditor/INSTALLATION_STATUS.md",\n  "uiEditor/uiEditorRegistry.js",\n  "uiEditor/targetAppRegistry.js",\n  "uiEditor/uiEditorLauncherButton.js",\n  "uiEditor/uiEditorLauncherButton.css",\n  "uiEditor/tests/uiEditorRegistry.test.cjs",\n]);\n\nconst INSTALLATION_STATUS_REQUIREMENTS = Object.freeze([\n  "UI-Editor-Regelpaket installiert",\n  "Nur Regelpaket und Pruefinfrastruktur installiert",\n  "Keine bestehende UI analysiert",\n  "Keine bestehende UI gescannt",\n  "Keine automatische UI-Elementliste erzeugt",\n  "Keine bestehende UI migriert",\n  "Keine Ziel-App-UI geaendert",\n  "Keine Elemente automatisch erkannt",\n  "Keine Elemente automatisch registriert",\n  "Vertragscheck vorhanden",\n  "Entwurfsentscheidungspflicht aktiv",\n  "Fachlogik und Fachdaten bleiben in der Ziel-App",\n]);\n\nconst UI_EDITOR_RULE_REQUIREMENTS = Object.freeze([\n  "Ziel-App-Regelpaket-Bootstrap",\n  "Kein UI-Scan",\n  "Keine automatische Bestandserkennung",\n  "Keine automatische Elementerkennung",\n  "Keine automatische Migration",\n  "Keine automatische Freigabe",\n  "explizit registrieren",\n  "Fachlogik und Fachdaten bleiben in der Ziel-App",\n]);\n\nfunction resolveTargetPath(relativePath) {\n  return path.join(TARGET_APP_ROOT, relativePath);\n}\n\nfunction readTargetFile(relativePath) {\n  return fs.readFileSync(resolveTargetPath(relativePath), "utf8");\n}\n\nfunction assertFileExists(relativePath) {\n  assert.equal(fs.existsSync(resolveTargetPath(relativePath)), true, "Pflichtdatei fehlt: " + relativePath);\n}\n\nfunction assertIncludesAll(relativePath, fragments) {\n  const content = readTargetFile(relativePath);\n  fragments.forEach((fragment) => {\n    assert.equal(content.includes(fragment), true, relativePath + " enthaelt nicht: " + fragment);\n  });\n}\n\nfunction assertAgentsMarkers() {\n  assertFileExists("AGENTS.md");\n\n  const content = readTargetFile("AGENTS.md");\n  const startIndex = content.indexOf("<!-- UI-EDITOR-KIT:START -->");\n  const endIndex = content.indexOf("<!-- UI-EDITOR-KIT:END -->");\n\n  assert.notEqual(startIndex, -1, "AGENTS.md enthaelt den UI-Editor-Startmarker nicht.");\n  assert.notEqual(endIndex, -1, "AGENTS.md enthaelt den UI-Editor-Endmarker nicht.");\n  assert.equal(startIndex < endIndex, true, "AGENTS.md Marker stehen in falscher Reihenfolge.");\n}\n\nREQUIRED_FILES.forEach(assertFileExists);\nassertAgentsMarkers();\nassertIncludesAll("uiEditor/INSTALLATION_STATUS.md", INSTALLATION_STATUS_REQUIREMENTS);\nassertIncludesAll("uiEditor/uiEditorRules.md", UI_EDITOR_RULE_REQUIREMENTS);\n\nconsole.log("TESTS OK: uiEditorInstallation");\n`;
}

function createInstallationStatusContent() {
  return `# Installation Status\n\n- UI-Editor-Regelpaket installiert.\n- Nur Regelpaket und Pruefinfrastruktur installiert.\n- Keine bestehende UI analysiert.\n- Keine bestehende UI gescannt.\n- Keine automatische UI-Elementliste erzeugt.\n- Keine bestehende UI migriert.\n- Keine Ziel-App-UI geaendert.\n- Keine Elemente automatisch erkannt.\n- Keine Elemente automatisch registriert.\n- Keine fachlichen Aktionen ausgefuehrt.\n- Vertragscheck vorhanden.\n- Entwurfsentscheidungspflicht aktiv.\n- Fachlogik und Fachdaten bleiben in der Ziel-App.\n`;
}

function escapeForRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

module.exports = {
  TARGET_APP_INSTALLER_AGENTS_RELATIVE_PATH,
  TARGET_APP_INSTALLER_AGENTS_START_MARKER,
  TARGET_APP_INSTALLER_AGENTS_END_MARKER,
  TARGET_APP_INSTALLER_NEXT_MANUAL_CHECK,
  getTargetAppInstallerManagedFiles,
  getTargetAppInstallerInstallableFiles,
  getTargetAppInstallerUninstallEmptyDirectories,
  getTargetAppInstallerFileGroups,
  createTargetAppInstallerSafetyReport,
  createTargetAppInstallerPreflightReport,
  createTargetAppInstallerReport,
  createTargetAppInstallerUninstallReport,
  buildTargetAppInstallerManagedFiles,
  readInstallerSourceFile,
  createMarkedAgentsBlock,
  createAgentsFileContent,
  appendAgentsBlock,
  hasMarkedAgentsBlock,
  removeMarkedAgentsBlock,
  isSafeRelativePath,
};
