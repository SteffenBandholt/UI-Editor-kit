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

let previewAccepted = false;

function getInputValue(id) {
  return document.getElementById(id).value.trim();
}

function getConfirmationCheckbox(flag) {
  return document.getElementById(`confirmation-${flag}`);
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

function allConfirmationsChecked() {
  return CONFIRMATION_FLAGS.every((flag) => getConfirmationCheckbox(flag).checked === true);
}

function resetConfirmations() {
  CONFIRMATION_FLAGS.forEach((flag) => {
    getConfirmationCheckbox(flag).checked = false;
  });
  updateInstallButtonState();
}

function updateInstallButtonState() {
  const ready = previewAccepted && allConfirmationsChecked();
  installButton.disabled = !ready;
  confirmationStatus.textContent = ready
    ? "Alle Bestaetigungen gesetzt. Die Grundstruktur kann geschrieben werden."
    : "Bitte alle Bestaetigungen setzen, bevor Dateien geschrieben werden.";
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

function createInstallerRequest() {
  return {
    targetAppPath: getInputValue("targetAppPath"),
    targetAppId: getInputValue("targetAppId"),
    targetAppName: getInputValue("targetAppName"),
    selectedMode: SELECTED_MODE,
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

updateInstallButtonState();
