(function (globalObject) {
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

  function createInvalidStatus(scope, error) {
    return {
      ok: false,
      itemCount: 0,
      errorCount: 1,
      scope: scope,
      version: 1,
      errors: [error],
    };
  }

  function createMiniInspectorHostStatus(rootElement, options) {
    var opts = options || {};
    var scope = typeof opts.scope === "string" ? opts.scope : DEFAULT_SCOPE;

    if (!rootElement || typeof rootElement.querySelectorAll !== "function") {
      return createInvalidStatus(scope, {
        path: "rootElement",
        code: "INVALID_ROOT",
        message: "Ziel-Root fehlt oder ist ungueltig.",
      });
    }

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
      scope: scope,
      version: 1,
      errors: errors,
    };
  }

  function createMiniInspectorHostStatusLines(status) {
    var safeStatus = status || createInvalidStatus(DEFAULT_SCOPE, {
      path: "status",
      code: "INVALID_STATUS",
      message: "Status fehlt oder ist ungueltig.",
    });
    var errors = Array.isArray(safeStatus.errors) ? safeStatus.errors : [];
    var lines = [
      "Layoutdaten gueltig: " + (safeStatus.ok ? "ja" : "nein"),
      "Layout-Items: " + Number(safeStatus.itemCount || 0),
      "Fehler: " + Number(safeStatus.errorCount || errors.length),
      "Scope: " + (typeof safeStatus.scope === "string" ? safeStatus.scope : DEFAULT_SCOPE),
      "Version: " + Number(safeStatus.version || 1),
    ];

    if (errors.length > 0) {
      lines.push("Fehlerdetails:");
      errors.forEach(function (error, index) {
        var pathValue = error && error.path ? error.path : "<unbekannt>";
        var codeValue = error && error.code ? error.code : "UNKNOWN";
        var messageValue = error && error.message ? error.message : "Kein Fehlertext";
        lines.push((index + 1) + ". " + pathValue + " | " + codeValue + " | " + messageValue);
      });
    }

    return lines;
  }

  function renderMiniInspectorHostStatus(inspectorContainer, status) {
    if (!inspectorContainer || typeof inspectorContainer !== "object") {
      throw new Error("Inspector-Container fehlt oder ist ungueltig.");
    }

    var title = status && status.ok ? "Layoutdaten Status: gueltig" : "Layoutdaten Status: ungueltig";
    var items = createMiniInspectorHostStatusLines(status)
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

    if (typeof inspectorContainer.setAttribute === "function") {
      inspectorContainer.setAttribute("data-status", status && status.ok ? "ok" : "error");
    }

    return {
      ok: true,
      mode: "innerHTML",
    };
  }

  function updateMiniInspectorHostAdapter(rootElement, inspectorContainer, options) {
    var status = createMiniInspectorHostStatus(rootElement, options);
    var render = renderMiniInspectorHostStatus(inspectorContainer, status);

    return {
      ok: status.ok,
      status: status,
      render: render,
    };
  }

  globalObject.miniInspectorHostAdapter = {
    DEFAULT_SCOPE: DEFAULT_SCOPE,
    createMiniInspectorHostStatus: createMiniInspectorHostStatus,
    createMiniInspectorHostStatusLines: createMiniInspectorHostStatusLines,
    renderMiniInspectorHostStatus: renderMiniInspectorHostStatus,
    updateMiniInspectorHostAdapter: updateMiniInspectorHostAdapter,
  };
})(typeof window !== "undefined" ? window : globalThis);
