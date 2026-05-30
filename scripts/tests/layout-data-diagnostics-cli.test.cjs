#!/usr/bin/env node

const assert = require("assert/strict");
const fs = require("fs");
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
  const fixturesDir = path.resolve(__dirname, "fixtures");
  const validPath = path.join(fixturesDir, "valid-layout-data.json");
  const invalidPath = path.join(fixturesDir, "invalid-layout-data.json");
  const malformedPath = path.join(fixturesDir, "malformed-layout-data.json");
  const missingPath = path.join(fixturesDir, "missing-layout-data.json");

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

  // 3) ungueltige Layoutdaten-Datei -> neutraler Diagnosebericht, kein Absturz
  const io2 = createCaptureIo();
  const exit2 = runLayoutDataDiagnosticsCli(["node", "cli", invalidPath], io2);
  assert.equal(exit2, 0);
  const report2 = JSON.parse(io2.out.text);
  assert.equal(report2.ok, false);
  assert.equal(Array.isArray(report2.errors), true);
  assert.equal(report2.errors.length > 0, true);

  // 4) keine Datei wird geschrieben (CLI liest nur)
  const beforeFiles = new Set(fs.readdirSync(fixturesDir));
  const io3 = createCaptureIo();
  runLayoutDataDiagnosticsCli(["node", "cli", validPath], io3);
  const afterFiles = new Set(fs.readdirSync(fixturesDir));
  assert.deepEqual(afterFiles, beforeFiles);

  // 5) gueltige Layoutdaten-Datei -> ok true, keine Fachbegriffe benoetigt
  const io4 = createCaptureIo();
  const exit4 = runLayoutDataDiagnosticsCli(["node", "cli", validPath], io4);
  assert.equal(exit4, 0);
  const report4 = JSON.parse(io4.out.text);
  assert.equal(report4.ok, true);

  // 6) ungueltiges JSON -> kontrollierter Fehler, Exit-Code != 0
  const io5 = createCaptureIo();
  const exit5 = runLayoutDataDiagnosticsCli(["node", "cli", malformedPath], io5);
  assert.notEqual(exit5, 0);
  assert.equal(io5.err.text.startsWith("FEHLER:"), true);
  assert.equal(io5.err.text.includes("SyntaxError"), false);

  // 7) fehlende Datei -> kontrollierter Fehler, Exit-Code != 0
  const io6 = createCaptureIo();
  const exit6 = runLayoutDataDiagnosticsCli(["node", "cli", missingPath], io6);
  assert.notEqual(exit6, 0);
  assert.equal(io6.err.text.startsWith("FEHLER:"), true);

  console.log("TESTS OK: layout-data-diagnostics-cli");
}

run();
