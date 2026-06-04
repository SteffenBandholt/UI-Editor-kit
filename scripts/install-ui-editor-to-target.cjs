#!/usr/bin/env node
"use strict";

const path = require("node:path");

const { createTargetAppInstallerPlan } = require("../src/core/target-app-installer-plan.cjs");
const { executeTargetAppInstallerPlan } = require("../src/core/target-app-installer-execution.cjs");

const AUTO_REGISTERS_ELEMENTS_FIELD = ["auto", "RegistersElements"].join("");

const INSTALLER_CONFIRMATION = Object.freeze({
  installationConfirmed: true,
  targetAppSelected: true,
  installPathConfirmed: true,
  noAutoScan: true,
  noAutoRegister: true,
  registryStructureOnly: true,
});

function createTargetAppLabel(targetAppPath) {
  const resolvedTargetAppPath = path.resolve(targetAppPath);
  const targetAppName = path.basename(resolvedTargetAppPath) || "Target App";
  const targetAppId = targetAppName
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");

  return {
    targetAppId: targetAppId || "target-app",
    targetAppName,
  };
}

function createInstallerPlan(targetAppPath, overwrite) {
  const targetAppLabel = createTargetAppLabel(targetAppPath);
  const installerPlan = createTargetAppInstallerPlan({
    targetAppPath: path.resolve(targetAppPath),
    targetAppId: targetAppLabel.targetAppId,
    targetAppName: targetAppLabel.targetAppName,
    selectedMode: "prepare-registry-structure",
  });

  if (overwrite === true) {
    installerPlan.overwrite = true;
  }

  return installerPlan;
}

function printUsage(writeLine) {
  writeLine("UI-Editor Ziel-App-Installation");
  writeLine("");
  writeLine("Nutzung:");
  writeLine('node scripts/install-ui-editor-to-target.cjs "<ziel-app-pfad>" [--overwrite]');
}

function formatNo(value) {
  return value === false ? "nein" : "ja";
}

function formatIssue(issue) {
  if (!issue || typeof issue !== "object") {
    return String(issue);
  }

  const code = typeof issue.code === "string" ? issue.code : "installer_error";
  const message = typeof issue.message === "string" ? issue.message : "Unbekannter Fehler.";
  const field = typeof issue.field === "string" ? ` (${issue.field})` : "";

  return `${code}${field}: ${message}`;
}

function printWrittenFiles(writeLine, writtenFiles) {
  writeLine("");
  writeLine("Geschriebene Dateien:");

  if (!Array.isArray(writtenFiles) || writtenFiles.length === 0) {
    writeLine("- keine");
    return;
  }

  writtenFiles.slice().sort().forEach((relativePath) => {
    writeLine(`- ${relativePath}`);
  });
}

function printSafety(writeLine, report) {
  const safety = report && report.safety && typeof report.safety === "object" ? report.safety : {};

  writeLine("");
  writeLine("Sicherheit:");
  writeLine(`- Ziel-UI gelesen: ${formatNo(safety.readsTargetUi)}`);
  writeLine(`- DOM gescannt: ${formatNo(safety.scansDom)}`);
  writeLine(`- Elemente automatisch erkannt: ${formatNo(safety.autoDetectsElements)}`);
  writeLine(`- Elemente automatisch registriert: ${formatNo(safety[AUTO_REGISTERS_ELEMENTS_FIELD])}`);
  writeLine(`- Ziel-App-UI geaendert: ${formatNo(safety.modifiesTargetUi)}`);
  writeLine(`- Fachlogik geaendert: ${formatNo(safety.modifiesDomainLogic)}`);
  writeLine(`- Fachdaten geaendert: ${formatNo(safety.modifiesDomainData)}`);
}

function printNextCheck(writeLine, targetAppPath) {
  const checkPath = path.join(path.resolve(targetAppPath), "uiEditor", "tests", "uiEditorInstallation.test.cjs");

  writeLine("");
  writeLine("Naechster Pruefbefehl:");
  writeLine(`node "${checkPath}"`);
}

function printReport(writeLine, report) {
  writeLine("");
  writeLine("Report:");
  writeLine(JSON.stringify(report || null, null, 2));
}

function printErrors(writeLine, errors) {
  writeLine("");
  writeLine("Fehler:");

  if (!Array.isArray(errors) || errors.length === 0) {
    writeLine("- Installation fehlgeschlagen.");
    return;
  }

  errors.forEach((issue) => {
    writeLine(`- ${formatIssue(issue)}`);
  });
}

function runCli(argv, output) {
  const args = Array.isArray(argv) ? argv : [];
  const writeOut = output && typeof output.writeOut === "function" ? output.writeOut : (line) => console.log(line);
  const writeErr = output && typeof output.writeErr === "function" ? output.writeErr : (line) => console.error(line);
  const targetAppPath = args.find((arg) => arg !== "--overwrite");
  const overwrite = args.includes("--overwrite");

  if (typeof targetAppPath !== "string" || targetAppPath.trim() === "") {
    printUsage(writeErr);
    return 1;
  }

  try {
    const installerPlan = createInstallerPlan(targetAppPath, overwrite);
    const result = executeTargetAppInstallerPlan({
      installerPlan,
      confirmation: INSTALLER_CONFIRMATION,
    });

    writeOut("UI-Editor Ziel-App-Installation");
    writeOut(`Ziel: ${installerPlan.targetAppPath}`);
    writeOut(`Status: ${result.ok ? "OK" : "FEHLER"}`);

    if (result.ok) {
      writeOut("");
      writeOut("Installation erfolgreich.");
      printWrittenFiles(writeOut, result.writtenFiles);
      printSafety(writeOut, result.report);
      printNextCheck(writeOut, installerPlan.targetAppPath);
      printReport(writeOut, result.report);
      return 0;
    }

    printErrors(writeOut, result.errors);
    printSafety(writeOut, result.report);
    printReport(writeOut, result.report);
    return 1;
  } catch (error) {
    writeErr("UI-Editor Ziel-App-Installation");
    writeErr("Status: FEHLER");
    writeErr("");
    writeErr(`Fehler: ${error && error.message ? error.message : String(error)}`);

    if (error && Array.isArray(error.errors)) {
      printErrors(writeErr, error.errors);
    }

    return 1;
  }
}

if (require.main === module) {
  process.exitCode = runCli(process.argv.slice(2));
}

module.exports = {
  runCli,
};
