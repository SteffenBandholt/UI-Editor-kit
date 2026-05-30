#!/usr/bin/env node

/*
 * Mini-Inspector Layout-Read (K2.0)
 *
 * Nutzt den Layoutdaten-Kern lesend ueber die oeffentliche API.
 * Keine Speicherung, keine Layout-Anwendung, keine Fachlogik.
 */

const { createLayoutDataDiagnostics } = require("./layout-data-api.cjs");

function createMiniInspectorLayoutStatus(rootElement, options) {
  const opts = options || {};
  const report = createLayoutDataDiagnostics(rootElement, opts);

  return {
    ok: report.ok,
    itemCount: report.summary.itemCount,
    errorCount: report.summary.errorCount,
    scope: report.summary.scope,
    version: report.summary.version,
    errors: report.errors.slice(),
  };
}

function formatMiniInspectorLayoutStatus(status) {
  const s = status || {
    ok: false,
    itemCount: 0,
    errorCount: 0,
    scope: "app-or-screen-scope",
    version: 1,
    errors: [],
  };

  const lines = [
    `Layoutdaten gueltig: ${s.ok ? "ja" : "nein"}`,
    `Layout-Items: ${s.itemCount}`,
    `Fehler: ${s.errorCount}`,
    `Scope: ${s.scope}`,
    `Version: ${s.version}`,
  ];

  if (Array.isArray(s.errors) && s.errors.length > 0) {
    lines.push("Fehlerdetails:");
    s.errors.forEach((error, index) => {
      const pathValue = error && error.path ? error.path : "<unbekannt>";
      const codeValue = error && error.code ? error.code : "UNKNOWN";
      const messageValue = error && error.message ? error.message : "Kein Fehlertext";
      lines.push(`${index + 1}. ${pathValue} | ${codeValue} | ${messageValue}`);
    });
  }

  return {
    ok: Boolean(s.ok),
    lines,
    text: lines.join("\n"),
  };
}

function createMiniInspectorStatusDisplayModel(rootElement, options) {
  const status = createMiniInspectorLayoutStatus(rootElement, options);
  const view = formatMiniInspectorLayoutStatus(status);
  return {
    status,
    view,
  };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function createMiniInspectorStatusMarkup(statusViewModel) {
  const view = statusViewModel || { ok: false, lines: [] };
  const lines = Array.isArray(view.lines) ? view.lines : [];
  const title = view.ok ? "Layoutdaten Status: gueltig" : "Layoutdaten Status: ungueltig";

  const items = lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("");
  return `<section data-mini-inspector-status="true"><h3>${escapeHtml(title)}</h3><ul>${items}</ul></section>`;
}

function renderMiniInspectorStatus(container, statusViewModel) {
  if (!container || typeof container !== "object") {
    throw new Error("Inspector-Container fehlt oder ist ungueltig.");
  }

  const markup = createMiniInspectorStatusMarkup(statusViewModel);

  if ("innerHTML" in container) {
    container.innerHTML = markup;
    return { ok: true, mode: "innerHTML" };
  }

  if ("textContent" in container) {
    const view = statusViewModel || { text: "" };
    container.textContent = typeof view.text === "string" ? view.text : "";
    return { ok: true, mode: "textContent" };
  }

  if (Array.isArray(container.children)) {
    container.children.length = 0;
    container.children.push({ type: "markup", value: markup });
    return { ok: true, mode: "children" };
  }

  throw new Error("Inspector-Container kann nicht aktualisiert werden.");
}

module.exports = {
  createMiniInspectorLayoutStatus,
  formatMiniInspectorLayoutStatus,
  createMiniInspectorStatusDisplayModel,
  createMiniInspectorStatusMarkup,
  renderMiniInspectorStatus,
  readMiniInspectorLayoutStatus: createMiniInspectorLayoutStatus,
  createMiniInspectorStatusViewModel: formatMiniInspectorLayoutStatus,
};
