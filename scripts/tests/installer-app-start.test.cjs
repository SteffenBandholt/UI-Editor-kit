#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const SERVER_PATH = "scripts/start-installer-app.cjs";
const INDEX_PATH = "src/installer-app/index.html";
const APP_JS_PATH = "src/installer-app/installer-app.js";
const APP_CSS_PATH = "src/installer-app/installer-app.css";

function read(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

function assertExists(relativePath) {
  assert.equal(fs.existsSync(path.join(REPO_ROOT, relativePath)), true, `Datei fehlt: ${relativePath}`);
}

function assertNotIncludes(text, fragment, label) {
  assert.equal(text.includes(fragment), false, `${label} enthaelt nicht erlaubten Text: ${fragment}`);
}

function assertNoFragments(text, fragments, label) {
  fragments.forEach((fragment) => assertNotIncludes(text, fragment, label));
}

function collectButtonLabels(html) {
  return [...html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/giu)].map((match) =>
    match[1].replace(/<[^>]*>/gu, "").replace(/\s+/gu, " ").trim()
  );
}

function requestJson(port, pathname, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const request = http.request(
      {
        hostname: "localhost",
        port,
        path: pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (response) => {
        let rawBody = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          rawBody += chunk;
        });
        response.on("end", () => {
          resolve({ statusCode: response.statusCode, body: JSON.parse(rawBody) });
        });
      }
    );

    request.on("error", reject);
    request.end(body);
  });
}

function getJson(port, pathname) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: "localhost",
        port,
        path: pathname,
        method: "GET",
      },
      (response) => {
        let rawBody = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          rawBody += chunk;
        });
        response.on("end", () => {
          resolve({ statusCode: response.statusCode, body: JSON.parse(rawBody) });
        });
      }
    );

    request.on("error", reject);
    request.end();
  });
}

function collectRelativeFiles(rootPath) {
  const files = [];

  function visit(currentPath) {
    fs.readdirSync(currentPath, { withFileTypes: true }).forEach((entry) => {
      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
        return;
      }
      files.push(path.relative(rootPath, entryPath).split(path.sep).join("/"));
    });
  }

  if (fs.existsSync(rootPath)) {
    visit(rootPath);
  }

  return files.sort();
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function run() {
  const packageJson = JSON.parse(read("package.json"));
  assert.equal(packageJson.scripts.start, "node scripts/start-installer-app.cjs");
  assert.equal(packageJson.scripts.test.includes("node scripts/tests/installer-app-start.test.cjs"), true);

  [SERVER_PATH, INDEX_PATH, APP_JS_PATH, APP_CSS_PATH].forEach(assertExists);

  const serverSource = read(SERVER_PATH);
  const indexSource = read(INDEX_PATH);
  const appSource = read(APP_JS_PATH);
  const cssSource = read(APP_CSS_PATH);
  const uiSource = `${indexSource}\n${appSource}\n${cssSource}`;
  const allNewSource = `${serverSource}\n${uiSource}`;

  assert.equal(serverSource.includes("/api/installer/preview"), true);
  assert.equal(serverSource.includes("/api/installer/install"), true);
  assert.equal(serverSource.includes("/api/installer/uninstall/preview"), true);
  assert.equal(serverSource.includes("/api/installer/uninstall"), true);
  assert.equal(serverSource.includes("/api/installer/select-folder"), true);
  assert.equal(serverSource.includes("FolderBrowserDialog"), true);
  assert.equal(serverSource.includes("System.Windows.Forms"), true);
  assert.equal(serverSource.includes("powershell.exe"), true);
  assert.equal(serverSource.includes("child_process"), true);
  assert.equal(serverSource.includes("/api/installer/path-roots"), true);
  assert.equal(serverSource.includes("/api/installer/directories"), true);
  assert.equal(serverSource.includes("fs.readdir"), true);
  assert.equal(serverSource.includes("withFileTypes: true"), true);
  assert.equal(serverSource.includes("createTargetAppInstallerPlan"), true);
  assert.equal(serverSource.includes("createTargetAppInstallerExecutionPreview"), true);
  assert.equal(serverSource.includes("executeTargetAppInstallerPlan"), true);
  assert.equal(serverSource.includes("createTargetAppInstallerUninstallPreview"), true);
  assert.equal(serverSource.includes("uninstallTargetAppInstallerArtifacts"), true);

  const buttonLabels = collectButtonLabels(indexSource);
  [
    "Neutral Demo App C:\\01_Projekte\\Neutral-Demo-App",
    "UI-Editor-Testziel C:\\01_Projekte\\UI-Editor-Testziel",
    "Ordner auswählen",
    "Ordnerliste laden",
    "Eine Ebene höher",
    "Diesen Ordner verwenden",
    "Installer-Plan prüfen",
    "Grundstruktur installieren",
    "Deinstallation prüfen",
    "UI-Editor-Artefakte deinstallieren",
  ].forEach((label) => {
    assert.equal(buttonLabels.includes(label), true, `Button fehlt: ${label}`);
  });
  assert.equal(indexSource.includes('id="installation-confirmation-panel"'), true);
  assert.equal(indexSource.includes('id="install-button" type="button" disabled'), true);
  assert.equal(indexSource.includes('id="uninstall-confirmation-panel"'), true);
  assert.equal(indexSource.includes('id="uninstall-button" type="button" disabled'), true);
  [
    "installationConfirmed",
    "targetAppSelected",
    "installPathConfirmed",
    "noAutoScan",
    "noAutoRegister",
    "registryStructureOnly",
  ].forEach((flag) => {
    assert.equal(indexSource.includes(`confirmation-${flag}`), true, `Checkbox fehlt: ${flag}`);
    assert.equal(appSource.includes(flag), true, `Bestaetigungslogik fehlt: ${flag}`);
  });
  assert.equal(appSource.includes("allConfirmationsChecked"), true);
  assert.equal(appSource.includes("installButton.disabled = !ready"), true);
  [
    "uninstallConfirmed",
    "targetAppSelected",
    "installPathConfirmed",
    "removeUiEditorArtifactsOnly",
    "keepTargetAppSource",
  ].forEach((flag) => {
    assert.equal(indexSource.includes(`uninstall-confirmation-${flag}`), true, `Deinstallations-Checkbox fehlt: ${flag}`);
    assert.equal(appSource.includes(flag), true, `Deinstallations-Bestaetigungslogik fehlt: ${flag}`);
  });
  assert.equal(appSource.includes("allUninstallConfirmationsChecked"), true);
  assert.equal(appSource.includes("uninstallButton.disabled = !ready"), true);

  assert.equal(indexSource.includes("UI-Editor Ziel-App-Installer"), true);
  assert.equal(indexSource.includes("targetAppPath"), true);
  assert.equal(indexSource.includes("targetAppId"), true);
  assert.equal(indexSource.includes("targetAppName"), true);
  assert.equal(indexSource.includes("Ziel-App auswählen"), true);
  assert.equal(indexSource.includes("A) Ziel-App-Daten"), true);
  assert.equal(indexSource.includes("B) Installation"), true);
  assert.equal(indexSource.includes("C) Deinstallation"), true);
  assert.equal(indexSource.includes("D) Ergebnis"), true);
  assert.equal(indexSource.includes("Ordner auswählen"), true);
  assert.equal(indexSource.includes("Windows-Ordnerdialog"), true);
  assert.equal(indexSource.includes("Erweiterte Pfadauswahl öffnen"), true);
  assert.equal(indexSource.includes("Ordnerliste laden"), true);
  assert.equal(indexSource.includes("Diesen Ordner verwenden"), true);
  assert.equal(indexSource.includes("prepare-registry-structure"), true);
  assert.equal(appSource.includes("/api/installer/preview"), true);
  assert.equal(appSource.includes("/api/installer/install"), true);
  assert.equal(appSource.includes("/api/installer/uninstall/preview"), true);
  assert.equal(appSource.includes("/api/installer/uninstall"), true);
  assert.equal(appSource.includes("/api/installer/select-folder"), true);
  assert.equal(appSource.includes("selectFolderWithWindowsDialog"), true);
  assert.equal(appSource.includes("setTargetAppPath(result.selectedPath)"), true);
  assert.equal(appSource.includes("fetch("), true);
  assert.equal(appSource.includes("deriveTargetAppData"), true);
  assert.equal(appSource.includes("createSlug"), true);
  assert.equal(appSource.includes("Neutral Demo App"), true);
  assert.equal(appSource.includes("neutral-target-app"), true);
  assert.equal(appSource.includes("getJson(`/api/installer/directories?path="), true);
  assert.equal(indexSource.includes("written-files-output"), true);
  assert.equal(indexSource.includes("removed-files-output"), true);

  assert.equal(serverSource.includes("Neutral Demo App"), false, "Server darf keine Schnellwahl-Sonderlogik enthalten.");
  assert.equal(packageJson.dependencies, undefined, "Keine externen npm-Abhängigkeiten für den Ordnerdialog erlauben.");
  assert.equal(indexSource.indexOf("Ordner auswählen") < indexSource.indexOf("Erweiterte Pfadauswahl öffnen"), true);
  assertNoFragments(uiSource, ["querySelectorAll", "writeFile", "mkdir", "readdir", "executeTargetAppInstallerPlan"], "Installer-UI");
  assertNoFragments(uiSource, ["detectElements", "elementDetection", "scanTarget", "autoDetect", "registryAutofill", "editor-panel"], "Installer-UI");
  assertNoFragments(uiSource, ["pruefen", "Bestaetigung", "ausgefuehrt", "geloescht", "Ziel-App Daten"], "Installer-UI");

  const { createInstallerAppServer } = require(path.join(REPO_ROOT, SERVER_PATH));
  const server = createInstallerAppServer();
  await new Promise((resolve) => server.listen(0, "localhost", resolve));

  try {
    const port = server.address().port;
    const targetRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ui-editor-installer-app-target-"));
    fs.rmSync(targetRoot, { recursive: true, force: true });

    const pathApiRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ui-editor-installer-path-api-"));
    fs.mkdirSync(path.join(pathApiRoot, "alpha"));
    fs.mkdirSync(path.join(pathApiRoot, "beta"));
    fs.writeFileSync(path.join(pathApiRoot, "not-a-directory.txt"), "file", "utf8");
    const beforePathApiFiles = collectRelativeFiles(pathApiRoot);

    if (process.platform !== "win32") {
      const selectFolderResponse = await requestJson(port, "/api/installer/select-folder", {});
      assert.equal(selectFolderResponse.statusCode, 200);
      assert.equal(selectFolderResponse.body.ok, false);
      assert.equal(selectFolderResponse.body.selectedPath, null);
      assert.equal(selectFolderResponse.body.cancelled, false);
      assert.equal(selectFolderResponse.body.errors[0].code, "windows_folder_dialog_not_supported");
      assert.deepEqual(collectRelativeFiles(pathApiRoot), beforePathApiFiles, "Ordnerdialog-Endpoint darf nichts schreiben oder löschen.");
    }

    const pathRootsResponse = await getJson(port, "/api/installer/path-roots");
    assert.equal(pathRootsResponse.statusCode, 200);
    assert.equal(pathRootsResponse.body.ok, true);
    assert.equal(pathRootsResponse.body.roots.some((root) => root.path === "C:\\01_Projekte"), true);
    assert.equal(pathRootsResponse.body.roots.some((root) => root.path === process.cwd()), true);
    assert.equal(pathRootsResponse.body.roots.some((root) => root.path === os.homedir()), true);

    const directoriesResponse = await getJson(port, `/api/installer/directories?path=${encodeURIComponent(pathApiRoot)}`);
    assert.equal(directoriesResponse.statusCode, 200);
    assert.equal(directoriesResponse.body.ok, true);
    assert.equal(directoriesResponse.body.currentPath, path.resolve(pathApiRoot));
    assert.equal(directoriesResponse.body.parentPath, path.dirname(path.resolve(pathApiRoot)));
    assert.deepEqual(directoriesResponse.body.directories.map((entry) => entry.name).sort(), ["alpha", "beta"]);
    assert.equal(directoriesResponse.body.directories.some((entry) => entry.name === "not-a-directory.txt"), false);
    assert.deepEqual(collectRelativeFiles(pathApiRoot), beforePathApiFiles, "Pfad-API darf nichts schreiben oder löschen.");

    const missingDirectoriesResponse = await getJson(
      port,
      `/api/installer/directories?path=${encodeURIComponent(path.join(pathApiRoot, "missing"))}`
    );
    assert.equal(missingDirectoriesResponse.statusCode, 400);
    assert.equal(missingDirectoriesResponse.body.ok, false);
    assert.deepEqual(collectRelativeFiles(pathApiRoot), beforePathApiFiles);

    const response = await requestJson(port, "/api/installer/preview", {
      targetAppPath: targetRoot,
      targetAppId: "neutral-target-app",
      targetAppName: "Neutral Target App",
      selectedMode: "prepare-registry-structure",
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.plan.selectedMode, "prepare-registry-structure");
    assert.equal(response.body.preview.willWriteFiles, false);
    assert.equal(response.body.preview.willScanUi, false);
    assert.equal(response.body.preview.willModifyTargetUi, false);
    assert.equal(response.body.preview.willRegisterElements, false);
    assert.equal(response.body.preview.preflight.checks.targetPathExists, false);
    assert.equal(response.body.preview.preflight.errors.some((error) => error.code === "target_path_missing"), true);
    assert.deepEqual(response.body.errors, []);
    assert.equal(fs.existsSync(targetRoot), false, "Preview darf keine Ziel-App-Dateien erzeugen.");

    const blockedInstallResponse = await requestJson(port, "/api/installer/install", {
      targetAppPath: targetRoot,
      targetAppId: "neutral-target-app",
      targetAppName: "Neutral Target App",
      selectedMode: "prepare-registry-structure",
      confirmation: {
        installationConfirmed: true,
        targetAppSelected: true,
      },
    });

    assert.equal(blockedInstallResponse.statusCode, 400);
    assert.equal(blockedInstallResponse.body.ok, false);
    assert.deepEqual(blockedInstallResponse.body.writtenFiles, []);
    assert.equal(fs.existsSync(targetRoot), false, "Ohne vollstaendige Bestaetigung darf nichts geschrieben werden.");
    fs.mkdirSync(targetRoot, { recursive: true });

    const installedFiles = [
      "AGENTS.md",
      "uiEditor/README.md",
      "uiEditor/INSTALLATION_STATUS.md",
      "uiEditor/targetAppRegistry.js",
      "uiEditor/targetSelection.js",
      "uiEditor/targetContract.js",
      "uiEditor/tests/uiEditorInstallation.test.cjs",
      "uiEditor/tests/uiEditorRegistry.test.cjs",
      "uiEditor/uiEditorLauncherButton.css",
      "uiEditor/uiEditorLauncherButton.js",
      "uiEditor/uiEditorRegistry.js",
      "uiEditor/uiEditorRules.md",
      "docs/ui-editor/EDITOR_BAUPLAN.md",
      "docs/ui-editor/UI_BAU_UND_PRUEFREGELN.md",
      "docs/ui-editor/UI_ELEMENT_KATALOG.md",
      "docs/ui-editor/UI_EDITOR_VERTRAG.md",
      "docs/ui-editor/UI_PDF_ENTWURFSENTSCHEIDUNG.md",
      "docs/ui-editor/ZIEL_APP_ANBINDUNG.md",
      "codex/AGENTS_UI_EDITOR_BLOCK.md",
      "codex/CODEX_STARTREGEL_UI_PDF.md",
      "scripts/ui-editor-contract-check.cjs",
    ];
    const removedFiles = installedFiles.filter((relativePath) => relativePath !== "AGENTS.md");
    const installResponse = await requestJson(port, "/api/installer/install", {
      targetAppPath: targetRoot,
      targetAppId: "neutral-target-app",
      targetAppName: "Neutral Target App",
      selectedMode: "prepare-registry-structure",
      confirmation: {
        installationConfirmed: true,
        targetAppSelected: true,
        installPathConfirmed: true,
        noAutoScan: true,
        noAutoRegister: true,
        registryStructureOnly: true,
      },
    });

    assert.equal(installResponse.statusCode, 200);
    assert.equal(installResponse.body.ok, true);
    assert.deepEqual(installResponse.body.writtenFiles.slice().sort(), installedFiles.slice().sort());
    assert.equal(installResponse.body.report.nextManualCheck, "node uiEditor/tests/uiEditorInstallation.test.cjs");
    assert.equal(installResponse.body.report.safety.readsTargetUi, false);
    assert.equal(installResponse.body.report.safety.scansDom, false);
    assert.equal(installResponse.body.report.safety.autoDetectsElements, false);
    assert.equal(installResponse.body.report.safety.autoRegistersElements, false);
    assert.equal(installResponse.body.report.safety.modifiesTargetUi, false);
    assert.equal(installResponse.body.report.safety.modifiesDomainLogic, false);
    assert.equal(installResponse.body.report.safety.modifiesDomainData, false);
    assert.equal(installResponse.body.report.safety.writesOutsideTargetAppPath, false);
    assert.equal(installResponse.body.report.installedTestFiles.includes("uiEditor/tests/uiEditorInstallation.test.cjs"), true);
    assert.deepEqual(collectRelativeFiles(targetRoot), installedFiles.slice().sort());
    const registry = fs.readFileSync(path.join(targetRoot, "uiEditor/uiEditorRegistry.js"), "utf8");
    assert.equal(registry.includes("uiEditor.root"), true);
    assert.equal(registry.includes("uiEditor.launcherButton"), true);
    assert.equal(registry.includes('lockedOps: Object.freeze([])'), true);
    assert.equal(registry.includes('role: "editor-launcher"'), true);
    assert.equal(registry.includes('parentId: "uiEditor.root"'), true);
    assert.equal(registry.includes('allowedOps: Object.freeze(["inspect", "move", "hide", "show"])'), true);
    assert.equal(registry.includes("editable: true"), true);
    const rules = fs.readFileSync(path.join(targetRoot, "uiEditor/uiEditorRules.md"), "utf8");
    const status = fs.readFileSync(path.join(targetRoot, "uiEditor/INSTALLATION_STATUS.md"), "utf8");
    assert.equal(rules.includes("Ziel-App-Regelpaket-Bootstrap"), true);
    assert.equal(rules.includes("Kein UI-Scan."), true);
    assert.equal(rules.includes("Keine automatische Bestandserkennung."), true);
    assert.equal(rules.includes("Keine automatische Elementerkennung."), true);
    assert.equal(rules.includes("Keine automatische Migration."), true);
    assert.equal(rules.includes("Keine automatische Freigabe."), true);
    assert.equal(rules.includes("Keine fachlichen Aktionen."), true);
    assert.equal(status.includes("Nur Regelpaket und Pruefinfrastruktur installiert."), true);
    assert.equal(status.includes("Keine bestehende UI analysiert."), true);
    assert.equal(status.includes("Keine bestehende UI gescannt."), true);
    assert.equal(status.includes("Keine automatische UI-Elementliste erzeugt."), true);
    assert.equal(status.includes("Keine bestehende UI migriert."), true);
    assert.equal(status.includes("Keine Ziel-App-UI geaendert."), true);
    assert.equal(status.includes("Keine Elemente automatisch erkannt."), true);
    assert.equal(status.includes("Keine Elemente automatisch registriert."), true);
    assert.equal(status.includes("Keine fachlichen Aktionen ausgefuehrt."), true);
    assert.equal(status.includes("Fachlogik und Fachdaten bleiben in der Ziel-App."), true);
    const agents = fs.readFileSync(path.join(targetRoot, "AGENTS.md"), "utf8");
    assert.equal(agents.includes("<!-- UI-EDITOR-KIT:START -->"), true);
    assert.equal(agents.includes("<!-- UI-EDITOR-KIT:END -->"), true);
    assert.deepEqual(installResponse.body.errors, []);

    const uninstallPreviewResponse = await requestJson(port, "/api/installer/uninstall/preview", {
      targetAppPath: targetRoot,
    });
    assert.equal(uninstallPreviewResponse.statusCode, 200);
    assert.equal(uninstallPreviewResponse.body.ok, true);
    assert.equal(uninstallPreviewResponse.body.preview.willRemoveFiles, false);
    assert.equal(uninstallPreviewResponse.body.preview.willRemoveSourceFiles, false);
    assert.equal(uninstallPreviewResponse.body.preview.willRemoveUnknownFiles, false);
    assert.deepEqual(
      collectRelativeFiles(targetRoot),
      installedFiles.slice().sort(),
      "Deinstallations-Preview darf nichts entfernen."
    );

    const blockedUninstallResponse = await requestJson(port, "/api/installer/uninstall", {
      targetAppPath: targetRoot,
      confirmation: {
        uninstallConfirmed: true,
      },
    });
    assert.equal(blockedUninstallResponse.statusCode, 400);
    assert.equal(blockedUninstallResponse.body.ok, false);
    assert.deepEqual(blockedUninstallResponse.body.removedFiles, []);
    assert.deepEqual(collectRelativeFiles(targetRoot), installedFiles.slice().sort());

    const uninstallResponse = await requestJson(port, "/api/installer/uninstall", {
      targetAppPath: targetRoot,
      confirmation: {
        uninstallConfirmed: true,
        targetAppSelected: true,
        installPathConfirmed: true,
        removeUiEditorArtifactsOnly: true,
        keepTargetAppSource: true,
      },
    });
    assert.equal(uninstallResponse.statusCode, 200);
    assert.equal(uninstallResponse.body.ok, true);
    assert.deepEqual(uninstallResponse.body.removedFiles.slice().sort(), removedFiles.slice().sort());
    assert.equal(uninstallResponse.body.report.agentsHandling.deletesAgentsFile, false);
    assert.equal(uninstallResponse.body.report.agentsHandling.removesMarkedBlockOnly, true);
    assert.equal(uninstallResponse.body.report.safety.modifiesTargetUi, false);
    assert.equal(uninstallResponse.body.report.safety.modifiesDomainData, false);
    assert.deepEqual(collectRelativeFiles(targetRoot), ["AGENTS.md"]);
    assert.equal(fs.readFileSync(path.join(targetRoot, "AGENTS.md"), "utf8").includes("<!-- UI-EDITOR-KIT:START -->"), false);

    fs.mkdirSync(path.join(targetRoot, "uiEditor"), { recursive: true });
    fs.writeFileSync(path.join(targetRoot, "uiEditor/custom-note.md"), "unknown", "utf8");
    const unknownUninstallResponse = await requestJson(port, "/api/installer/uninstall", {
      targetAppPath: targetRoot,
      confirmation: {
        uninstallConfirmed: true,
        targetAppSelected: true,
        installPathConfirmed: true,
        removeUiEditorArtifactsOnly: true,
        keepTargetAppSource: true,
      },
    });
    assert.equal(unknownUninstallResponse.statusCode, 400);
    assert.equal(unknownUninstallResponse.body.ok, false);
    assert.equal(
      unknownUninstallResponse.body.errors.some((error) => error.code === "unknown-ui-editor-files"),
      true
    );
    assert.deepEqual(unknownUninstallResponse.body.removedFiles, []);
    assert.equal(fs.existsSync(path.join(targetRoot, "uiEditor/custom-note.md")), true);
  } finally {
    await closeServer(server);
  }

  console.log("TESTS OK: installer-app-start");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
