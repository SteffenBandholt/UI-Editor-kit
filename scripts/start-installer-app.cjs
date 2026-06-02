#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const http = require("node:http");
const path = require("node:path");
const { URL } = require("node:url");

const { createTargetAppInstallerPlan } = require("../src/core/target-app-installer-plan.cjs");
const {
  createTargetAppInstallerExecutionPreview,
  executeTargetAppInstallerPlan,
} = require("../src/core/target-app-installer-execution.cjs");
const {
  createTargetAppInstallerUninstallPreview,
  uninstallTargetAppInstallerArtifacts,
} = require("../src/core/target-app-installer-uninstall.cjs");

const REPO_ROOT = path.resolve(__dirname, "..");
const INSTALLER_APP_ROOT = path.join(REPO_ROOT, "src/installer-app");
const DEFAULT_PORT = 3210;
const MAX_REQUEST_BODY_BYTES = 1024 * 1024;

const CONTENT_TYPES = Object.freeze({
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
});

function createInstallerAppServer() {
  return http.createServer((request, response) => {
    const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);

    if (request.method === "GET" && requestUrl.pathname === "/api/installer/path-roots") {
      handlePathRootsRequest(response);
      return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/api/installer/directories") {
      handleDirectoriesRequest(requestUrl, response);
      return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/api/installer/preview") {
      handleInstallerPreviewRequest(request, response);
      return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/api/installer/install") {
      handleInstallerInstallRequest(request, response);
      return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/api/installer/uninstall/preview") {
      handleInstallerUninstallPreviewRequest(request, response);
      return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/api/installer/uninstall") {
      handleInstallerUninstallRequest(request, response);
      return;
    }

    if (request.method === "GET" || request.method === "HEAD") {
      handleStaticRequest(request, response);
      return;
    }

    sendJson(response, 405, {
      ok: false,
      plan: null,
      preview: null,
      errors: [{ code: "method_not_allowed", message: "Diese Methode ist für die Installer-App nicht erlaubt." }],
    });
  });
}


function handlePathRootsRequest(response) {
  const roots = [];
  const fixedProjectRoot = "C:\\01_Projekte";
  const candidates = [
    { path: fixedProjectRoot, includeWhenMissing: true },
    { path: process.cwd(), includeWhenMissing: false },
    { path: os.homedir(), includeWhenMissing: false },
  ].filter((candidate) => candidate.path);

  candidates.forEach((candidate) => {
    const exists = fs.existsSync(candidate.path);
    const normalizedPath = path.resolve(candidate.path);

    if ((exists || candidate.includeWhenMissing) && !roots.some((root) => root.path === candidate.path || root.path === normalizedPath)) {
      roots.push({ name: candidate.path, path: candidate.path, exists });
    }
  });

  sendJson(response, 200, {
    ok: true,
    roots,
    errors: [],
  });
}

function handleDirectoriesRequest(requestUrl, response) {
  const requestedPath = requestUrl.searchParams.get("path");

  if (!requestedPath) {
    sendJson(response, 400, {
      ok: false,
      currentPath: null,
      parentPath: null,
      directories: [],
      errors: [{ code: "path_required", message: "Es wurde kein Pfad angegeben." }],
    });
    return;
  }

  const currentPath = path.resolve(requestedPath);

  fs.readdir(currentPath, { withFileTypes: true }, (error, entries) => {
    if (error) {
      sendJson(response, 400, {
        ok: false,
        currentPath,
        parentPath: null,
        directories: [],
        errors: [
          {
            code: error.code === "ENOENT" ? "path_not_found" : "path_not_readable",
            message:
              error.code === "ENOENT"
                ? "Der angegebene Pfad existiert nicht."
                : "Der angegebene Pfad ist nicht lesbar.",
          },
        ],
      });
      return;
    }

    const directories = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => ({ name: entry.name, path: path.join(currentPath, entry.name) }))
      .sort((left, right) => left.name.localeCompare(right.name, "de"));
    const parentPath = path.dirname(currentPath) === currentPath ? null : path.dirname(currentPath);

    sendJson(response, 200, {
      ok: true,
      currentPath,
      parentPath,
      directories,
      errors: [],
    });
  });
}

function handleStaticRequest(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  const pathname = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const relativePath = pathname.replace(/^\/+/, "");
  const absolutePath = path.resolve(INSTALLER_APP_ROOT, relativePath);

  if (!isPathInside(absolutePath, INSTALLER_APP_ROOT)) {
    sendText(response, 403, "Zugriff nicht erlaubt.");
    return;
  }

  fs.readFile(absolutePath, (error, content) => {
    if (error) {
      sendText(response, 404, "Installer-App-Datei nicht gefunden.");
      return;
    }

    response.writeHead(200, {
      "Content-Type": CONTENT_TYPES[path.extname(absolutePath)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });

    if (request.method === "HEAD") {
      response.end();
      return;
    }

    response.end(content);
  });
}

function handleInstallerPreviewRequest(request, response) {
  readJsonBody(request)
    .then((body) => {
      const inputs = {
        targetAppPath: body.targetAppPath,
        targetAppId: body.targetAppId,
        targetAppName: body.targetAppName,
        selectedMode: "prepare-registry-structure",
      };
      const plan = createTargetAppInstallerPlan(inputs);
      const previewResult = createTargetAppInstallerExecutionPreview({ installerPlan: plan, confirmation: {} });

      sendJson(response, previewResult.ok ? 200 : 400, {
        ok: previewResult.ok,
        plan,
        preview: previewResult.preview,
        errors: previewResult.errors,
      });
    })
    .catch((error) => {
      sendJson(response, 400, {
        ok: false,
        plan: null,
        preview: null,
        errors: normalizeInstallerErrors(
          error,
          "installer_preview_failed",
          "Installer-Preview konnte nicht erzeugt werden."
        ),
      });
    });
}

function handleInstallerInstallRequest(request, response) {
  readJsonBody(request)
    .then((body) => {
      const inputs = {
        targetAppPath: body.targetAppPath,
        targetAppId: body.targetAppId,
        targetAppName: body.targetAppName,
        selectedMode: "prepare-registry-structure",
      };
      const plan = createTargetAppInstallerPlan(inputs);
      const executionResult = executeTargetAppInstallerPlan({
        installerPlan: plan,
        confirmation: body.confirmation,
      });

      sendJson(response, executionResult.ok ? 200 : 400, {
        ok: executionResult.ok,
        plan,
        writtenFiles: executionResult.writtenFiles,
        errors: executionResult.errors,
      });
    })
    .catch((error) => {
      sendJson(response, 400, {
        ok: false,
        plan: null,
        writtenFiles: [],
        errors: normalizeInstallerErrors(
          error,
          "installer_install_failed",
          "Installation konnte nicht ausgeführt werden."
        ),
      });
    });
}

function handleInstallerUninstallPreviewRequest(request, response) {
  readJsonBody(request)
    .then((body) => {
      const previewResult = createTargetAppInstallerUninstallPreview({
        targetAppPath: body.targetAppPath,
        confirmation: body.confirmation || {},
      });

      sendJson(response, previewResult.ok ? 200 : 400, {
        ok: previewResult.ok,
        preview: previewResult.preview,
        errors: previewResult.errors,
      });
    })
    .catch((error) => {
      sendJson(response, 400, {
        ok: false,
        preview: null,
        errors: normalizeInstallerErrors(
          error,
          "installer_uninstall_preview_failed",
          "Deinstallations-Preview konnte nicht erzeugt werden."
        ),
      });
    });
}

function handleInstallerUninstallRequest(request, response) {
  readJsonBody(request)
    .then((body) => {
      const uninstallResult = uninstallTargetAppInstallerArtifacts({
        targetAppPath: body.targetAppPath,
        confirmation: body.confirmation,
      });

      sendJson(response, uninstallResult.ok ? 200 : 400, {
        ok: uninstallResult.ok,
        removedFiles: uninstallResult.removedFiles,
        removedDirectories: uninstallResult.removedDirectories,
        errors: uninstallResult.errors,
      });
    })
    .catch((error) => {
      sendJson(response, 400, {
        ok: false,
        removedFiles: [],
        removedDirectories: [],
        errors: normalizeInstallerErrors(
          error,
          "installer_uninstall_failed",
          "Deinstallation konnte nicht ausgeführt werden."
        ),
      });
    });
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let rawBody = "";

    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      rawBody += chunk;
      if (Buffer.byteLength(rawBody, "utf8") > MAX_REQUEST_BODY_BYTES) {
        reject(createServerError("request_body_too_large", "Die Vorschau-Anfrage ist zu groß."));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(rawBody.trim() === "" ? {} : JSON.parse(rawBody));
      } catch (error) {
        reject(createServerError("invalid_json", "Die Vorschau-Anfrage muss gültiges JSON enthalten."));
      }
    });
    request.on("error", (error) => reject(error));
  });
}

function normalizeInstallerErrors(error, fallbackCode, fallbackMessage) {
  if (Array.isArray(error.errors)) {
    return error.errors.map((entry) => ({ ...entry }));
  }

  return [
    {
      code: error.code || fallbackCode,
      message: error.message || fallbackMessage,
    },
  ];
}

function createServerError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload, null, 2));
}

function sendText(response, statusCode, text) {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(text);
}

function isPathInside(candidatePath, rootPath) {
  const relative = path.relative(rootPath, candidatePath);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function startInstallerApp(port = DEFAULT_PORT) {
  const server = createInstallerAppServer();
  const url = `http://localhost:${port}`;

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(`Port ${port} ist bereits belegt. Installer-App kann nicht starten.`);
      process.exitCode = 1;
      return;
    }

    console.error(`Installer-App konnte nicht starten: ${error.message}`);
    process.exitCode = 1;
  });

  server.listen(port, "localhost", () => {
    console.log("UI-Editor Ziel-App-Installer läuft lokal.");
    console.log(`URL: ${url}`);
  });

  return server;
}

if (require.main === module) {
  startInstallerApp(Number(process.env.PORT || DEFAULT_PORT));
}

module.exports = {
  createInstallerAppServer,
  startInstallerApp,
};
