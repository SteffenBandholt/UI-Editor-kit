"use strict";

const SELECTED_MODE = "prepare-registry-structure";
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
const statusOutput = document.getElementById("status");
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

let previewAccepted = false;
let uninstallPreviewAccepted = false;

function getInputValue(id) {
  return document.getElementById(id).value.trim();
}

function getConfirmationCheckbox(flag) {
  return document.getElementById(`confirmation-${flag}`);
}

function getUninstallConfirmationCheckbox(flag) {
  return document.getElementById(`uninstall-confirmation-${flag}`);
}

function renderJson(element, value) {
  element.textContent = JSON.stringify(value || {}, null, 2);
}

function renderList(element, entries) {
  element.textContent = "";
  const safeEntries = Array.isArray(entries) ? entries : [];

  if (safeEntries.length === 0) {
    const item = document.createElement("li");
    item.textContent = "Keine Eintraege.";
    element.appendChild(item);
    return;
  }

  safeEntries.forEach((entry) => {
    const item = document.createElement("li");
    item.textContent = String(entry);
    element.appendChild(item);
  });
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
    ? "Alle Bestaetigungen gesetzt. Die Grundstruktur kann geschrieben werden."
    : "Bitte alle Bestaetigungen setzen, bevor Dateien geschrieben werden.";
}

function updateUninstallButtonState() {
  const ready = uninstallPreviewAccepted && allUninstallConfirmationsChecked();
  uninstallButton.disabled = !ready;
  uninstallStatus.textContent = ready
    ? "Alle Bestaetigungen gesetzt. Die bekannten UI-Editor-Artefakte koennen entfernt werden."
    : "Bitte Deinstallation pruefen und alle Bestaetigungen setzen.";
}

function renderPreviewResult(result) {
  const plan = result.plan || {};
  const preview = result.preview || {};
  const errors = Array.isArray(result.errors) ? result.errors : [];

  previewAccepted = result.ok === true;
  confirmationPanel.hidden = !previewAccepted;
  statusOutput.textContent = result.ok
    ? "Preview erfolgreich erzeugt. Es wurde nichts geschrieben."
    : "Preview konnte nicht erzeugt werden. Es wurde nichts geschrieben.";
  statusOutput.dataset.state = result.ok ? "ok" : "error";

  renderJson(planOutput, plan);
  renderJson(previewOutput, preview);
  renderList(filesOutput, preview.filesToCreate || plan.installableFiles);
  renderList(blockedActionsOutput, preview.blockedActions || plan.blockedActions);
  renderList(confirmationsOutput, preview.requiresConfirmation || plan.requiresConfirmation);
  renderList(writtenFilesOutput, []);
  renderList(removedFilesOutput, []);
  errorsOutput.textContent = JSON.stringify(errors, null, 2);
  resetConfirmations();
}

function renderInstallResult(result) {
  const errors = Array.isArray(result.errors) ? result.errors : [];

  statusOutput.textContent = result.ok
    ? "Grundstruktur erfolgreich geschrieben."
    : "Grundstruktur konnte nicht geschrieben werden.";
  statusOutput.dataset.state = result.ok ? "ok" : "error";
  renderList(writtenFilesOutput, result.writtenFiles);
  errorsOutput.textContent = JSON.stringify(errors, null, 2);
}

function renderUninstallPreviewResult(result) {
  const preview = result.preview || {};
  const errors = Array.isArray(result.errors) ? result.errors : [];

  uninstallPreviewAccepted = result.ok === true;
  uninstallPanel.hidden = !uninstallPreviewAccepted;
  statusOutput.textContent = result.ok
    ? "Deinstallations-Preview erfolgreich erzeugt. Es wurde nichts entfernt."
    : "Deinstallations-Preview konnte nicht erzeugt werden. Es wurde nichts entfernt.";
  statusOutput.dataset.state = result.ok ? "ok" : "error";
  renderJson(planOutput, {});
  renderJson(previewOutput, preview);
  renderList(filesOutput, preview.filesToRemove);
  renderList(blockedActionsOutput, []);
  renderList(confirmationsOutput, UNINSTALL_CONFIRMATION_FLAGS);
  renderList(writtenFilesOutput, []);
  renderList(removedFilesOutput, []);
  errorsOutput.textContent = JSON.stringify(errors, null, 2);
  resetUninstallConfirmations();
}

function renderUninstallResult(result) {
  const errors = Array.isArray(result.errors) ? result.errors : [];
  const removedDirectories = Array.isArray(result.removedDirectories) ? result.removedDirectories : [];

  statusOutput.textContent = result.ok
    ? "UI-Editor-Artefakte erfolgreich entfernt."
    : "UI-Editor-Artefakte konnten nicht entfernt werden.";
  statusOutput.dataset.state = result.ok ? "ok" : "error";
  renderList(removedFilesOutput, (result.removedFiles || []).concat(removedDirectories));
  errorsOutput.textContent = JSON.stringify(errors, null, 2);
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
  statusOutput.textContent = "Preview wird erzeugt ...";
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
  statusOutput.textContent = "Deinstallations-Preview wird erzeugt ...";
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

updateInstallButtonState();
updateUninstallButtonState();
