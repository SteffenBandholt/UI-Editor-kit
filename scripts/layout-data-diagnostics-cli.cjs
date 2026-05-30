#!/usr/bin/env node

/*
 * UI-Editor-Kit Layoutdaten-Diagnose CLI (K1.6)
 *
 * Nutzt bestehende Diagnosebausteine und gibt neutrales Ergebnis auf stdout aus.
 */

const fs = require("fs");
const path = require("path");
const {
  createLayoutDataDiagnostics,
  createLayoutDataDiagnosticsFromLayoutData,
} = require("./layout-data-api.cjs");

function createNode(attributes, children) {
  const attrs = attributes || {};
  const childNodes = children || [];
  return {
    attributes: attrs,
    children: childNodes,
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null;
    },
  };
}

function createDefaultMockRoot() {
  return createNode({}, [
    createNode({ "data-ui-inspector-id": "demo.root", "data-ui-editor-editable": "true" }, [
      createNode(
        {
          "data-ui-inspector-id": "demo.header",
          "data-ui-editor-editable": "true",
          "data-ui-editor-ops": "move,hide",
        },
        []
      ),
      createNode(
        {
          "data-ui-inspector-id": "demo.content",
          "data-ui-editor-editable": "false",
          "data-ui-editor-ops": "resize,layout",
        },
        []
      ),
    ]),
  ]);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  if (args.includes("--help")) {
    return { mode: "help" };
  }
  const inputPath = args.find((x) => !x.startsWith("--"));
  return {
    mode: "diagnose",
    inputPath: inputPath || null,
  };
}

function printHelp(stdout) {
  stdout.write(`UI-Editor-Kit Layoutdaten-Diagnose CLI

Nutzung:
  npm run layout:diagnose
  npm run layout:diagnose -- <pfad-zur-eingabe.json>

Ohne Argument wird ein neutrales internes Beispiel verwendet.
`);
}

function runLayoutDataDiagnosticsCli(argv, io) {
  const input = Array.isArray(argv) ? argv : process.argv;
  const stdout = (io && io.stdout) || process.stdout;
  const stderr = (io && io.stderr) || process.stderr;

  const parsed = parseArgs(input);
  if (parsed.mode === "help") {
    printHelp(stdout);
    return 0;
  }

  try {
    let report;

    if (parsed.inputPath) {
      const absolutePath = path.resolve(parsed.inputPath);
      const fileContent = fs.readFileSync(absolutePath, "utf8");
      const layoutData = JSON.parse(fileContent);
      report = createLayoutDataDiagnosticsFromLayoutData(layoutData);
    } else {
      const root = createDefaultMockRoot();
      report = createLayoutDataDiagnostics(root, { scope: "cli.default.scope" });
    }

    stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return report.ok ? 0 : 0;
  } catch (error) {
    stderr.write(`FEHLER: Diagnose konnte nicht ausgefuehrt werden: ${error.message}\n`);
    return 1;
  }
}

if (require.main === module) {
  process.exitCode = runLayoutDataDiagnosticsCli(process.argv);
}

module.exports = {
  runLayoutDataDiagnosticsCli,
};
