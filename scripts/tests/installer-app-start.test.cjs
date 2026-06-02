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

  assertNotIncludes(serverSource, "executeTargetAppInstallerPlan", SERVER_PATH);
  assert.equal(serverSource.includes("/api/installer/preview"), true);
  assert.equal(serverSource.includes("createTargetAppInstallerPlan"), true);
  assert.equal(serverSource.includes("createTargetAppInstallerExecutionPreview"), true);

  const buttonLabels = collectButtonLabels(indexSource);
  assert.deepEqual(buttonLabels, ["Installer-Plan pruefen"]);
  buttonLabels.forEach((label) => {
    assertNotIncludes(label, "Installieren", "Installer-App-Button");
    assertNotIncludes(label, "Ausführen", "Installer-App-Button");
    assertNotIncludes(label, "Ausfuehren", "Installer-App-Button");
  });

  assert.equal(indexSource.includes("UI-Editor Ziel-App-Installer"), true);
  assert.equal(indexSource.includes("targetAppPath"), true);
  assert.equal(indexSource.includes("targetAppId"), true);
  assert.equal(indexSource.includes("targetAppName"), true);
  assert.equal(indexSource.includes("prepare-registry-structure"), true);
  assert.equal(appSource.includes("/api/installer/preview"), true);
  assert.equal(appSource.includes("fetch("), true);

  assertNoFragments(allNewSource, [["B", "BM"].join("")], "Installer-App-Dateien");
  assertNoFragments(uiSource, ["querySelectorAll", "writeFile", "mkdir", "readdir", "executeTargetAppInstallerPlan"], "Installer-UI");
  assertNoFragments(uiSource, ["autoScan", "detectElements", "elementDetection", "scanTarget"], "Installer-UI");

  const { createInstallerAppServer } = require(path.join(REPO_ROOT, SERVER_PATH));
  const server = createInstallerAppServer();
  await new Promise((resolve) => server.listen(0, "localhost", resolve));

  try {
    const port = server.address().port;
    const targetRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ui-editor-installer-app-target-"));
    fs.rmSync(targetRoot, { recursive: true, force: true });

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
    assert.deepEqual(response.body.errors, []);
    assert.equal(fs.existsSync(targetRoot), false, "Preview darf keine Ziel-App-Dateien erzeugen.");
  } finally {
    await closeServer(server);
  }

  console.log("TESTS OK: installer-app-start");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
