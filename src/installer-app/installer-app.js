"use strict";

const SELECTED_MODE = "prepare-registry-structure";
const QUICK_TARGETS = Object.freeze({
  "Neutral Demo App": Object.freeze({ targetAppId: "neutral-demo-app", targetAppName: "Neutral Demo App" }),
  "UI-Editor-Testziel": Object.freeze({ targetAppId: "neutral-target-app", targetAppName: "Neutral Target App" }),
});
const CONFIRMATION_FLAGS = Object.freeze([
  "installationConfirmed",
  "targetAppSelected",
  "installPathConfirmed",
  "noAutoScan",
  "noAutoRegister",
  "registryStructureOnly",
]);
const UNINSTALL_CONFIRMATION_FLAGS = Object.freeze([
  "uninstallConfirmed",
  "targetAppSelected",
  "installPathConfirmed",
  "removeUiEditorArtifactsOnly",
  "keepTargetAppSource",
]);

const form = document.getElementById("installer-preview-form");
const targetAppPathInput = document.getElementById("targetAppPath");
const targetAppIdInput = document.getElementById("targetAppId");
const targetAppNameInput = document.getElementById("targetAppName");
const statusOutput = document.getElementById("status");
const resultStateOutput = document.getElementById("result-state-output");
const resultTargetPathOutput = document.getElementById("result-target-path-output");
const planOutput = document.getElementById("plan-output");
const previewOutput = document.getElementById("preview-output");
const filesOutput = document.getElementById("files-output");
const blockedActionsOutput = document.getElementById("blocked-actions-output");
const confirmationsOutput = document.getElementById("confirmations-output");
const errorsOutput = document.getElementById("errors-output");
const confirmationPanel = document.getElementById("installation-confirmation-panel");
const confirmationStatus = document.getElementById("confirmation-status");
const installButton = document.getElementById("install-button");
const writtenFilesOutput = document.getElementById("written-files-output");
const uninstallPreviewButton = document.getElementById("uninstall-preview-button");
const uninstallPanel = document.getElementById("uninstall-confirmation-panel");
const uninstallStatus = document.getElementById("uninstall-confirmation-status");
const uninstallButton = document.getElementById("uninstall-button");
const removedFilesOutput = document.getElementById("removed-files-output");
const selectFolderButton = document.getElementById("select-folder-button");
const folderDialogStatus = document.getElementById("folder-dialog-status");
const openPathPickerButton = document.getElementById("open-path-picker-button");
const pathPickerBrowser = document.getElementById("path-picker-browser");
const pathPickerCurrent = document.getElementById("path-picker-current");
const pathPickerError = document.getElementById("path-picker-error");
const pathPickerParentButton = document.getElementById("path-picker-parent-button");
const useCurrentPathButton = document.getElementById("use-current-path-button");
const pathRootsOutput = document.getElementById("path-roots-output");
const directoriesOutput = document.getElementById("directories-output");

let previewAccepted = false;
let uninstallPreviewAccepted = false;
let currentPickerPath = "";
let currentParentPath = null;

function getInputValue(id) {
  return document.getElementById(id).value.trim();
}

function getConfirmationCheckbox(flag) {
  return document.getElementById(`confirmation-${flag}`);
}

function getUninstallConfirmationCheckbox(flag) {
  return document.getElementById(`uninstall-confirmation-${flag}`);
}

function getPathName(targetPath) {
  const normalizedPath = String(targetPath || "").replace(/[/\\]+$/u, "");
  const parts = normalizedPath.split(/[/\\]+/u);
  return parts[parts.length - 1] || normalizedPath;
}

function createSlug(value) {
  return String(value || "ziel-app")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "") || "ziel-app";
}

function deriveTargetAppData(targetPath) {
  const folderName = getPathName(targetPath);
  const quickTarget = QUICK_TARGETS[folderName];

  if (quickTarget) {
    return { ...quickTarget };
  }

  return {
    targetAppId: createSlug(folderName),
    targetAppName: folderName || "Ziel-App",
  };
}

function setTargetAppData({ targetAppPath, targetAppId, targetAppName }) {
  targetAppPathInput.value = targetAppPath || "";
  targetAppIdInput.value = targetAppId || "";
  targetAppNameInput.value = targetAppName || "";
  updateResultTargetPath();
}

function setTargetAppPath(targetAppPath) {
  const derivedData = deriveTargetAppData(targetAppPath);
  setTargetAppData({ targetAppPath, ...derivedData });
}

function updateResultTargetPath() {
  resultTargetPathOutput.textContent = targetAppPathInput.value.trim() || "Noch nicht gesetzt.";
}

function renderJson(element, value) {
  element.textContent = JSON.stringify(value || {}, null, 2);
}

function renderList(element, entries, emptyText = "Keine Einträge.") {
  element.textContent = "";
  const safeEntries = Array.isArray(entries) ? entries : [];

  if (safeEntries.length === 0) {
    const item = document.createElement("li");
    item.textContent = emptyText;
    element.appendChild(item);
    return;
  }

  safeEntries.forEach((entry) => {
    const item = document.createElement("li");
    item.textContent = String(entry);
    element.appendChild(item);
  });
}

function renderErrorList(element, errors) {
  const safeErrors = Array.isArray(errors) ? errors : [];
  renderList(
    element,
    safeErrors.map((error) => `${error.code || "error"}: ${error.message || "Unbekannter Fehler"}`),
    "Keine Fehler."
  );
}

function setResultSummary({ ok, successText, failureText }) {
  resultStateOutput.textContent = ok ? `erfolgreich: ${successText}` : `fehlgeschlagen: ${failureText}`;
  updateResultTargetPath();
}

function readConfirmation() {
  const confirmation = {};

  CONFIRMATION_FLAGS.forEach((flag) => {
    confirmation[flag] = getConfirmationCheckbox(flag).checked;
  });

  return confirmation;
}

function readUninstallConfirmation() {
  const confirmation = {};

  UNINSTALL_CONFIRMATION_FLAGS.forEach((flag) => {
    confirmation[flag] = getUninstallConfirmationCheckbox(flag).checked;
  });

  return confirmation;
}

function allConfirmationsChecked() {
  return CONFIRMATION_FLAGS.every((flag) => getConfirmationCheckbox(flag).checked === true);
}

function allUninstallConfirmationsChecked() {
  return UNINSTALL_CONFIRMATION_FLAGS.every((flag) => getUninstallConfirmationCheckbox(flag).checked === true);
}

function resetConfirmations() {
  CONFIRMATION_FLAGS.forEach((flag) => {
    getConfirmationCheckbox(flag).checked = false;
  });
  updateInstallButtonState();
}

function resetUninstallConfirmations() {
  UNINSTALL_CONFIRMATION_FLAGS.forEach((flag) => {
    getUninstallConfirmationCheckbox(flag).checked = false;
  });
  updateUninstallButtonState();
}

function updateInstallButtonState() {
  const ready = previewAccepted && allConfirmationsChecked();
  installButton.disabled = !ready;
  confirmationStatus.textContent = ready
    ? "Alle Bestätigungen gesetzt. Die Grundstruktur kann geschrieben werden."
    : "Bitte alle Bestätigungen setzen, bevor Dateien geschrieben werden.";
}

function updateUninstallButtonState() {
  const ready = uninstallPreviewAccepted && allUninstallConfirmationsChecked();
  uninstallButton.disabled = !ready;
  uninstallStatus.textContent = ready
    ? "Alle Bestätigungen gesetzt. Die bekannten UI-Editor-Artefakte können entfernt werden."
    : "Bitte Deinstallation prüfen und alle Bestätigungen setzen.";
}

function renderPreviewResult(result) {
  const plan = result.plan || {};
  const preview = result.preview || {};
  const errors = Array.isArray(result.errors) ? result.errors : [];

  previewAccepted = result.ok === true;
  confirmationPanel.hidden = !previewAccepted;
  statusOutput.textContent = result.ok
    ? "Vorschau erfolgreich erzeugt. Es wurde nichts geschrieben."
    : "Vorschau konnte nicht erzeugt werden. Es wurde nichts geschrieben.";
  statusOutput.dataset.state = result.ok ? "ok" : "error";
  setResultSummary({ ok: result.ok, successText: "Installer-Plan geprüft", failureText: "Installer-Plan nicht geprüft" });

  renderJson(planOutput, plan);
  renderJson(previewOutput, preview);
  renderList(filesOutput, preview.filesToCreate || plan.installableFiles);
  renderList(blockedActionsOutput, preview.blockedActions || plan.blockedActions);
  renderList(confirmationsOutput, preview.requiresConfirmation || plan.requiresConfirmation);
  renderList(writtenFilesOutput, []);
  renderList(removedFilesOutput, []);
  renderErrorList(errorsOutput, errors);
  resetConfirmations();
}

function renderInstallResult(result) {
  const errors = Array.isArray(result.errors) ? result.errors : [];

  statusOutput.textContent = result.ok
    ? "Grundstruktur erfolgreich geschrieben."
    : "Grundstruktur konnte nicht geschrieben werden.";
  statusOutput.dataset.state = result.ok ? "ok" : "error";
  setResultSummary({ ok: result.ok, successText: "Installation ausgeführt", failureText: "Installation nicht ausgeführt" });
  renderList(writtenFilesOutput, result.writtenFiles);
  renderErrorList(errorsOutput, errors);
}

function renderUninstallPreviewResult(result) {
  const preview = result.preview || {};
  const errors = Array.isArray(result.errors) ? result.errors : [];

  uninstallPreviewAccepted = result.ok === true;
  uninstallPanel.hidden = !uninstallPreviewAccepted;
  statusOutput.textContent = result.ok
    ? "Deinstallationsvorschau erfolgreich erzeugt. Es wurde nichts entfernt."
    : "Deinstallationsvorschau konnte nicht erzeugt werden. Es wurde nichts entfernt.";
  statusOutput.dataset.state = result.ok ? "ok" : "error";
  setResultSummary({ ok: result.ok, successText: "Deinstallation geprüft", failureText: "Deinstallation nicht geprüft" });
  renderJson(planOutput, {});
  renderJson(previewOutput, preview);
  renderList(filesOutput, preview.filesToRemove);
  renderList(blockedActionsOutput, preview.blockedActions);
  renderList(confirmationsOutput, UNINSTALL_CONFIRMATION_FLAGS);
  renderList(writtenFilesOutput, []);
  renderList(removedFilesOutput, []);
  renderErrorList(errorsOutput, errors);
  resetUninstallConfirmations();
}

function renderUninstallResult(result) {
  const errors = Array.isArray(result.errors) ? result.errors : [];
  const removedDirectories = Array.isArray(result.removedDirectories) ? result.removedDirectories : [];

  statusOutput.textContent = result.ok
    ? "UI-Editor-Artefakte erfolgreich entfernt."
    : "UI-Editor-Artefakte konnten nicht entfernt werden.";
  statusOutput.dataset.state = result.ok ? "ok" : "error";
  setResultSummary({ ok: result.ok, successText: "Deinstallation ausgeführt", failureText: "Deinstallation nicht ausgeführt" });
  renderList(removedFilesOutput, (result.removedFiles || []).concat(removedDirectories));
  renderErrorList(errorsOutput, errors);
}

function createInstallerRequest() {
  return {
    targetAppPath: getInputValue("targetAppPath"),
    targetAppId: getInputValue("targetAppId"),
    targetAppName: getInputValue("targetAppName"),
    selectedMode: SELECTED_MODE,
  };
}

function createUninstallRequest() {
  return {
    targetAppPath: getInputValue("targetAppPath"),
  };
}

async function postJson(pathname, payload) {
  const response = await fetch(pathname, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return response.json();
}

async function getJson(pathname) {
  const response = await fetch(pathname, { method: "GET" });
  return response.json();
}

function showPathPickerError(message) {
  pathPickerError.hidden = false;
  pathPickerError.textContent = message;
}

function clearPathPickerError() {
  pathPickerError.hidden = true;
  pathPickerError.textContent = "";
}

function createDirectoryButton(label, targetPath) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", () => loadDirectories(targetPath));
  return button;
}

function renderDirectoryButtons(element, entries, emptyText) {
  element.textContent = "";
  const safeEntries = Array.isArray(entries) ? entries : [];

  if (safeEntries.length === 0) {
    const item = document.createElement("li");
    item.textContent = emptyText;
    element.appendChild(item);
    return;
  }

  safeEntries.forEach((entry) => {
    const item = document.createElement("li");
    item.appendChild(createDirectoryButton(entry.name || entry.path, entry.path));
    element.appendChild(item);
  });
}


async function selectFolderWithWindowsDialog() {
  folderDialogStatus.textContent = "Windows-Ordnerdialog wird geöffnet ...";
  selectFolderButton.disabled = true;

  try {
    const result = await postJson("/api/installer/select-folder", {});

    if (result.ok && result.selectedPath) {
      setTargetAppPath(result.selectedPath);
      folderDialogStatus.textContent = "Ordner übernommen. Ziel-App-Daten wurden automatisch gesetzt.";
      return;
    }

    if (result.cancelled) {
      folderDialogStatus.textContent = "Ordnerauswahl abgebrochen. Es wurde nichts geändert.";
      return;
    }

    folderDialogStatus.textContent = (result.errors || []).map((error) => error.message).join(" ") || "Ordner konnte nicht ausgewählt werden.";
  } catch (error) {
    folderDialogStatus.textContent = `Ordner konnte nicht ausgewählt werden: ${error.message}`;
  } finally {
    selectFolderButton.disabled = false;
  }
}

async function loadPathRoots() {
  const result = await getJson("/api/installer/path-roots");

  if (!result.ok) {
    showPathPickerError((result.errors || []).map((error) => error.message).join(" ") || "Startpunkte konnten nicht geladen werden.");
    return [];
  }

  renderDirectoryButtons(pathRootsOutput, result.roots, "Keine Startpunkte verfügbar.");
  return result.roots || [];
}

async function loadDirectories(targetPath) {
  if (!targetPath) {
    showPathPickerError("Es wurde kein Pfad ausgewählt.");
    return;
  }

  pathPickerBrowser.hidden = false;
  pathPickerCurrent.textContent = `Aktueller Ordner: ${targetPath}`;
  clearPathPickerError();

  const result = await getJson(`/api/installer/directories?path=${encodeURIComponent(targetPath)}`);

  if (!result.ok) {
    currentPickerPath = "";
    currentParentPath = null;
    renderDirectoryButtons(directoriesOutput, [], "Ordner konnten nicht geladen werden.");
    pathPickerParentButton.disabled = true;
    useCurrentPathButton.disabled = true;
    showPathPickerError((result.errors || []).map((error) => error.message).join(" ") || "Pfad ist nicht lesbar.");
    return;
  }

  currentPickerPath = result.currentPath;
  currentParentPath = result.parentPath;
  pathPickerCurrent.textContent = `Aktueller Ordner: ${currentPickerPath}`;
  pathPickerParentButton.disabled = !currentParentPath;
  useCurrentPathButton.disabled = false;
  renderDirectoryButtons(directoriesOutput, result.directories, "Keine Unterordner vorhanden.");
}

async function openPathPicker() {
  pathPickerBrowser.hidden = false;
  clearPathPickerError();
  const roots = await loadPathRoots();
  const readableRoot = roots.find((root) => root.exists !== false);
  const initialPath = targetAppPathInput.value.trim() || (readableRoot && readableRoot.path) || (roots[0] && roots[0].path);

  if (initialPath) {
    await loadDirectories(initialPath);
  }
}

Array.from(document.getElementsByClassName("quick-select-card")).forEach((button) => {
  button.addEventListener("click", () => {
    setTargetAppData({
      targetAppPath: button.dataset.targetAppPath,
      targetAppId: button.dataset.targetAppId,
      targetAppName: button.dataset.targetAppName,
    });
  });
});

targetAppPathInput.addEventListener("change", () => setTargetAppPath(targetAppPathInput.value.trim()));
targetAppPathInput.addEventListener("input", updateResultTargetPath);
selectFolderButton.addEventListener("click", selectFolderWithWindowsDialog);
openPathPickerButton.addEventListener("click", openPathPicker);
pathPickerParentButton.addEventListener("click", () => loadDirectories(currentParentPath));
useCurrentPathButton.addEventListener("click", () => setTargetAppPath(currentPickerPath));

CONFIRMATION_FLAGS.forEach((flag) => {
  getConfirmationCheckbox(flag).addEventListener("change", updateInstallButtonState);
});

UNINSTALL_CONFIRMATION_FLAGS.forEach((flag) => {
  getUninstallConfirmationCheckbox(flag).addEventListener("change", updateUninstallButtonState);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  previewAccepted = false;
  confirmationPanel.hidden = true;
  statusOutput.textContent = "Vorschau wird erzeugt ...";
  statusOutput.dataset.state = "pending";

  try {
    const result = await postJson("/api/installer/preview", createInstallerRequest());
    renderPreviewResult(result);
  } catch (error) {
    renderPreviewResult({
      ok: false,
      plan: null,
      preview: null,
      errors: [{ code: "preview_request_failed", message: error.message }],
    });
  }
});

installButton.addEventListener("click", async () => {
  if (!previewAccepted || !allConfirmationsChecked()) {
    updateInstallButtonState();
    return;
  }

  statusOutput.textContent = "Grundstruktur wird geschrieben ...";
  statusOutput.dataset.state = "pending";

  try {
    const result = await postJson("/api/installer/install", {
      ...createInstallerRequest(),
      confirmation: readConfirmation(),
    });
    renderInstallResult(result);
  } catch (error) {
    renderInstallResult({
      ok: false,
      writtenFiles: [],
      errors: [{ code: "install_request_failed", message: error.message }],
    });
  }
});

uninstallPreviewButton.addEventListener("click", async () => {
  uninstallPreviewAccepted = false;
  uninstallPanel.hidden = true;
  statusOutput.textContent = "Deinstallationsvorschau wird erzeugt ...";
  statusOutput.dataset.state = "pending";

  try {
    const result = await postJson("/api/installer/uninstall/preview", createUninstallRequest());
    renderUninstallPreviewResult(result);
  } catch (error) {
    renderUninstallPreviewResult({
      ok: false,
      preview: null,
      errors: [{ code: "uninstall_preview_request_failed", message: error.message }],
    });
  }
});

uninstallButton.addEventListener("click", async () => {
  if (!uninstallPreviewAccepted || !allUninstallConfirmationsChecked()) {
    updateUninstallButtonState();
    return;
  }

  statusOutput.textContent = "UI-Editor-Artefakte werden entfernt ...";
  statusOutput.dataset.state = "pending";

  try {
    const result = await postJson("/api/installer/uninstall", {
      ...createUninstallRequest(),
      confirmation: readUninstallConfirmation(),
    });
    renderUninstallResult(result);
  } catch (error) {
    renderUninstallResult({
      ok: false,
      removedFiles: [],
      removedDirectories: [],
      errors: [{ code: "uninstall_request_failed", message: error.message }],
    });
  }
});

updateResultTargetPath();
updateInstallButtonState();
updateUninstallButtonState();
