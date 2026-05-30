#!/usr/bin/env node

const assert = require("assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { runLayoutDataDiagnosticsCli } = require("../layout-data-diagnostics-cli.cjs");

function createCaptureIo() {
  const out = { text: "" };
  const err = { text: "" };
  return {
    stdout: {
      write(chunk) {
        out.text += String(chunk);
      },
    },
    stderr: {
      write(chunk) {
        err.text += String(chunk);
      },
    },
    out,
    err,
  };
}

function run() {
  // 1) gueltige neutrale Eingabe ohne Argument erzeugt Diagnosebericht
  const io1 = createCaptureIo();
  const exit1 = runLayoutDataDiagnosticsCli(["node", "cli"], io1);
  assert.equal(exit1, 0);
  const report1 = JSON.parse(io1.out.text);
  assert.equal(typeof report1.ok, "boolean");
  assert.equal(report1.ok, true);

  // 2) nutzt bestehende Diagnosefunktion (sichtbar an standardisiertem Reportaufbau)
  assert.equal(typeof report1.layoutData, "object");
  assert.equal(typeof report1.validation, "object");
  assert.equal(Array.isArray(report1.errors), true);
  assert.equal(typeof report1.summary, "object");

  // 3) ungueltige Eingabe (json-inhalt) -> neutraler Diagnosebericht, kein Absturz
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ui-editor-kit-k16-"));
  const invalidPath = path.join(tmpDir, "invalid-layout.json");
  fs.writeFileSync(invalidPath, JSON.stringify({ version: "1", items: {} }), "utf8");
  const io2 = createCaptureIo();
  const exit2 = runLayoutDataDiagnosticsCli(["node", "cli", invalidPath], io2);
  assert.equal(exit2, 0);
  const report2 = JSON.parse(io2.out.text);
  assert.equal(report2.ok, false);
  assert.equal(Array.isArray(report2.errors), true);
  assert.equal(report2.errors.length > 0, true);

  // 4) keine Datei wird geschrieben (CLI liest nur)
  const beforeFiles = new Set(fs.readdirSync(tmpDir));
  const io3 = createCaptureIo();
  runLayoutDataDiagnosticsCli(["node", "cli", invalidPath], io3);
  const afterFiles = new Set(fs.readdirSync(tmpDir));
  assert.deepEqual(afterFiles, beforeFiles);

  // 5) kein Fachbegriff wird benoetigt
  const neutralPath = path.join(tmpDir, "neutral-layout.json");
  fs.writeFileSync(
    neutralPath,
    JSON.stringify({
      version: 1,
      scope: "neutral.scope",
      items: { "demo.header": { visible: true, x: 0, y: 0, width: 100, height: 50, order: 1 } },
    }),
    "utf8"
  );
  const io4 = createCaptureIo();
  const exit4 = runLayoutDataDiagnosticsCli(["node", "cli", neutralPath], io4);
  assert.equal(exit4, 0);
  const report4 = JSON.parse(io4.out.text);
  assert.equal(report4.ok, true);

  // 6) hilft indirekt bei Gesamtgruen: dieser Test selbst muss gruen enden
  console.log("TESTS OK: layout-data-diagnostics-cli");
}

run();
