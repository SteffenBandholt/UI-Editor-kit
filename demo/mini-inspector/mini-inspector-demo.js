(function () {
  "use strict";

  var DEFAULT_SCOPE = "mini-inspector-demo.scope";

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function readNumberAttribute(element, name) {
    var raw = element.getAttribute(name);
    if (raw === null || raw.trim() === "") {
      return undefined;
    }
    var parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  function createBrowserDemoStatus(rootElement, options) {
    var opts = options || {};
    var invalid = opts.invalid === true;
    var elements = Array.prototype.slice.call(rootElement.querySelectorAll("[data-ui-inspector-id]"));
    var errors = [];

    elements.forEach(function (element, index) {
      var id = element.getAttribute("data-ui-inspector-id") || "";
      var width = invalid && element.hasAttribute("data-demo-invalid-width")
        ? Number(element.getAttribute("data-demo-invalid-width"))
        : readNumberAttribute(element, "data-ui-layout-width");

      if (!id.trim()) {
        errors.push({
          path: "items[" + index + "]",
          code: "MISSING_ID",
          message: "Element ohne neutrale Kennung.",
        });
      }

      if (width !== undefined && width < 0) {
        errors.push({
          path: "items." + (id || index) + ".width",
          code: "NEGATIVE_DIMENSION",
          message: "Breite darf nicht negativ sein.",
        });
      }
    });

    return {
      ok: errors.length === 0,
      itemCount: elements.length,
      errorCount: errors.length,
      scope: typeof opts.scope === "string" ? opts.scope : DEFAULT_SCOPE,
      version: 1,
      errors: errors,
    };
  }

  function createStatusLines(status) {
    var lines = [
      "Layoutdaten gueltig: " + (status.ok ? "ja" : "nein"),
      "Layout-Items: " + status.itemCount,
      "Fehler: " + status.errorCount,
      "Scope: " + status.scope,
      "Version: " + status.version,
    ];

    if (status.errors.length > 0) {
      lines.push("Fehlerdetails:");
      status.errors.forEach(function (error, index) {
        lines.push(
          (index + 1) + ". " + error.path + " | " + error.code + " | " + error.message
        );
      });
    }

    return lines;
  }

  function renderStatus(inspectorContainer, status) {
    var title = status.ok ? "Layoutdaten Status: gueltig" : "Layoutdaten Status: ungueltig";
    var items = createStatusLines(status)
      .map(function (line) {
        return "<li>" + escapeHtml(line) + "</li>";
      })
      .join("");

    inspectorContainer.innerHTML =
      '<section data-mini-inspector-status="true"><h3>' +
      escapeHtml(title) +
      "</h3><ul>" +
      items +
      "</ul></section>";
    inspectorContainer.setAttribute("data-status", status.ok ? "ok" : "error");
  }

  function updateDemo() {
    var rootElement = document.getElementById("miniInspectorDemoTarget");
    var inspectorContainer = document.getElementById("miniInspectorStatus");
    var invalidToggle = document.getElementById("demoInvalidToggle");
    var status = createBrowserDemoStatus(rootElement, {
      invalid: invalidToggle.checked,
      scope: DEFAULT_SCOPE,
    });

    renderStatus(inspectorContainer, status);
  }

  document.addEventListener("DOMContentLoaded", function () {
    var invalidToggle = document.getElementById("demoInvalidToggle");
    invalidToggle.addEventListener("change", updateDemo);
    updateDemo();
  });

  window.miniInspectorBrowserDemo = {
    DEFAULT_SCOPE: DEFAULT_SCOPE,
    createBrowserDemoStatus: createBrowserDemoStatus,
    renderStatus: renderStatus,
  };
})();
