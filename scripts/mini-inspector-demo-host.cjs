#!/usr/bin/env node

/*
 * Mini-Inspector Demo-Host (K4.0)
 *
 * Fachneutrale Demo-/Host-Schale fuer den rein lesenden Mini-Inspector.
 * Keine Speicherung, keine Layout-Anwendung, keine Ziel-UI-Mutation.
 */

const { mountMiniInspectorStatus } = require("./mini-inspector-layout-read.cjs");

const DEFAULT_SCOPE = "mini-inspector-demo.scope";

function createMiniInspectorDemoTargetRoot(options) {
  const opts = options || {};
  const invalid = opts.invalid === true;

  return {
    type: "root",
    attributes: {
      "data-ui-demo-root": "true",
    },
    children: [
      {
        type: "section",
        attributes: {
          "data-ui-inspector-id": "demo.header",
          "data-ui-editor-editable": "true",
          "data-ui-editor-ops": "read,inspect",
          "data-ui-layout-order": "1",
        },
        children: [],
      },
      {
        type: "section",
        attributes: {
          "data-ui-inspector-id": "demo.content",
          "data-ui-editor-editable": "false",
          "data-ui-editor-ops": "read",
          "data-ui-layout-order": "2",
          "data-ui-layout-width": invalid ? "-1" : "0",
        },
        children: [],
      },
    ],
  };
}

function createMiniInspectorDemoInspectorContainer() {
  return {
    innerHTML: "",
  };
}

function createMiniInspectorDemoHost(options) {
  const opts = options || {};
  const rootElement = opts.rootElement || createMiniInspectorDemoTargetRoot(opts);
  const inspectorContainer = opts.inspectorContainer || createMiniInspectorDemoInspectorContainer();
  const scope = typeof opts.scope === "string" ? opts.scope : DEFAULT_SCOPE;

  return {
    rootElement,
    inspectorContainer,
    scope,
  };
}

function updateMiniInspectorDemoHost(host, options) {
  if (!host || typeof host !== "object") {
    throw new Error("Demo-Host fehlt oder ist ungueltig.");
  }

  const opts = options || {};
  const scope = typeof opts.scope === "string" ? opts.scope : host.scope || DEFAULT_SCOPE;
  const result = mountMiniInspectorStatus(host.inspectorContainer, host.rootElement, { scope });

  return {
    ok: result.ok,
    status: result.status,
    view: result.view,
    render: result.render,
    host,
  };
}

function runMiniInspectorDemoHost(options) {
  const host = createMiniInspectorDemoHost(options);
  return updateMiniInspectorDemoHost(host, options);
}

function formatMiniInspectorDemoHostResult(result) {
  const safeResult = result || {
    ok: false,
    status: {
      ok: false,
      itemCount: 0,
      errorCount: 0,
      scope: DEFAULT_SCOPE,
      version: 1,
      errors: [],
    },
    host: {
      inspectorContainer: {
        innerHTML: "",
      },
    },
  };

  const status = safeResult.status || {};
  const lines = [
    `ok: ${Boolean(safeResult.ok)}`,
    `itemCount: ${Number(status.itemCount || 0)}`,
    `errorCount: ${Number(status.errorCount || 0)}`,
    `scope: ${typeof status.scope === "string" ? status.scope : DEFAULT_SCOPE}`,
    `version: ${Number(status.version || 1)}`,
  ];

  if (Array.isArray(status.errors) && status.errors.length > 0) {
    lines.push("errors:");
    status.errors.forEach((error, index) => {
      const pathValue = error && error.path ? error.path : "<unbekannt>";
      const codeValue = error && error.code ? error.code : "UNKNOWN";
      const messageValue = error && error.message ? error.message : "Kein Fehlertext";
      lines.push(`${index + 1}. ${pathValue} | ${codeValue} | ${messageValue}`);
    });
  }

  const inspectorMarkup =
    safeResult.host &&
    safeResult.host.inspectorContainer &&
    typeof safeResult.host.inspectorContainer.innerHTML === "string"
      ? safeResult.host.inspectorContainer.innerHTML
      : "";

  if (inspectorMarkup) {
    lines.push("inspectorContainer:");
    lines.push(inspectorMarkup);
  }

  return {
    ok: Boolean(safeResult.ok),
    text: lines.join("\n"),
  };
}

function runMiniInspectorDemoHostCli(options) {
  try {
    const result = runMiniInspectorDemoHost(options);
    const output = formatMiniInspectorDemoHostResult(result);
    return {
      ok: result.ok,
      exitCode: 0,
      text: output.text,
      result,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      exitCode: 1,
      text: `runnerError: ${message}`,
      error,
    };
  }
}

module.exports = {
  DEFAULT_SCOPE,
  createMiniInspectorDemoTargetRoot,
  createMiniInspectorDemoInspectorContainer,
  createMiniInspectorDemoHost,
  updateMiniInspectorDemoHost,
  runMiniInspectorDemoHost,
  formatMiniInspectorDemoHostResult,
  runMiniInspectorDemoHostCli,
};

if (require.main === module) {
  const cliResult = runMiniInspectorDemoHostCli();

  if (cliResult.exitCode === 0) {
    process.stdout.write(`${cliResult.text}\n`);
  } else {
    process.stderr.write(`${cliResult.text}\n`);
  }

  process.exitCode = cliResult.exitCode;
}
