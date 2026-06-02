"use strict";

const SELECTED_MODE = "prepare-registry-structure";

const form = document.getElementById("installer-preview-form");
const statusOutput = document.getElementById("status");
const planOutput = document.getElementById("plan-output");
const previewOutput = document.getElementById("preview-output");
const filesOutput = document.getElementById("files-output");
const blockedActionsOutput = document.getElementById("blocked-actions-output");
const confirmationsOutput = document.getElementById("confirmations-output");
const errorsOutput = document.getElementById("errors-output");

function getInputValue(id) {
  return document.getElementById(id).value.trim();
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

function renderResult(result) {
  const plan = result.plan || {};
  const preview = result.preview || {};
  const errors = Array.isArray(result.errors) ? result.errors : [];

  statusOutput.textContent = result.ok
    ? "Preview erfolgreich erzeugt. Es wurde nichts geschrieben."
    : "Preview konnte nicht erzeugt werden. Es wurde nichts geschrieben.";
  statusOutput.dataset.state = result.ok ? "ok" : "error";

  renderJson(planOutput, plan);
  renderJson(previewOutput, preview);
  renderList(filesOutput, preview.filesToCreate || plan.installableFiles);
  renderList(blockedActionsOutput, preview.blockedActions || plan.blockedActions);
  renderList(confirmationsOutput, preview.requiresConfirmation || plan.requiresConfirmation);
  errorsOutput.textContent = JSON.stringify(errors, null, 2);
}

function createPreviewRequest() {
  return {
    targetAppPath: getInputValue("targetAppPath"),
    targetAppId: getInputValue("targetAppId"),
    targetAppName: getInputValue("targetAppName"),
    selectedMode: SELECTED_MODE,
  };
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  statusOutput.textContent = "Preview wird erzeugt ...";
  statusOutput.dataset.state = "pending";

  try {
    const response = await fetch("/api/installer/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createPreviewRequest()),
    });
    const result = await response.json();
    renderResult(result);
  } catch (error) {
    renderResult({
      ok: false,
      plan: null,
      preview: null,
      errors: [{ code: "preview_request_failed", message: error.message }],
    });
  }
});
