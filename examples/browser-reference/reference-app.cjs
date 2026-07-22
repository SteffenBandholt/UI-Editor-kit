"use strict";

const {
  createElementRefRegistry, createBrowserHostAdapter, createBrowserSelectionHost, createBrowserOverlayHost,
  createBrowserLayoutStorage, createUiEditorBrowserBridge, createUiEditorRuntime,
  createUiEditorPanelController, createUiEditorPanel,
} = require("../../src/index.cjs");
const { createReferenceRegistry } = require("./reference-registry.cjs");
const { REFERENCE_PROFILES, createReferenceTargetContext } = require("./reference-context.cjs");

const DOM_IDS = Object.freeze({
  card: "reference-demo-card", heading: "reference-demo-heading", action: "reference-demo-action", info: "reference-demo-info", locked: "reference-demo-locked",
  stage: "reference-stage", panel: "reference-panel", overlay: "reference-overlay", status: "reference-status", errors: "reference-errors", profile: "reference-profile",
});
const REF_BINDINGS = Object.freeze([
  ["demo.card", DOM_IDS.card], ["demo.heading", DOM_IDS.heading], ["demo.action", DOM_IDS.action], ["demo.info", DOM_IDS.info], ["demo.locked", DOM_IDS.locked],
]);

function safeText(value) { return value == null || value === "" ? "-" : String(value); }
function resultCode(result) { return result && (result.code || result.messageKey) || "OK"; }
function referenceError(code, message) { const error = new Error(message); error.referenceCode = code; return error; }
function resolveBrowserStorage(windowAdapter) {
  try {
    return { ok: true, storage: windowAdapter ? windowAdapter.localStorage : null };
  } catch (_error) {
    return { ok: false, storage: null, code: "STORAGE_UNAVAILABLE" };
  }
}

function operationEnabled(element, operation) {
  const allowedOps = Array.isArray(element && element.effectiveOps) ? element.effectiveOps : (Array.isArray(element && element.allowedOps) ? element.allowedOps : []);
  const lockedOps = Array.isArray(element && element.lockedOps) ? element.lockedOps : [];
  return allowedOps.includes(operation) && !lockedOps.includes(operation);
}
function filterReferenceLayoutEntry(entry, element) {
  if (!entry || !element) return entry;
  const filtered = { elementId: entry.elementId };
  if (operationEnabled(element, "move")) {
    if (Object.prototype.hasOwnProperty.call(entry, "x")) filtered.x = entry.x;
    if (Object.prototype.hasOwnProperty.call(entry, "y")) filtered.y = entry.y;
  }
  if (operationEnabled(element, "resize")) {
    if (Object.prototype.hasOwnProperty.call(entry, "width")) filtered.width = entry.width;
    if (Object.prototype.hasOwnProperty.call(entry, "height")) filtered.height = entry.height;
  }
  if (operationEnabled(element, "show") || operationEnabled(element, "hide")) {
    if (Object.prototype.hasOwnProperty.call(entry, "visible")) filtered.visible = entry.visible;
  }
  return filtered;
}
function createReferenceHostAdapter(baseHostAdapter, registry) {
  return {
    ...baseHostAdapter,
    getCurrentLayoutEntry(elementId) {
      const result = baseHostAdapter.getCurrentLayoutEntry(elementId);
      if (!result || result.ok === false) return result;
      return { ...result, value: filterReferenceLayoutEntry(result.value, registry.getElementById(elementId)) };
    },
  };
}
function displayBootstrapError(root, code) {
  if (!root) return;
  root.innerHTML = `<main class="reference-shell"><section class="reference-errors" role="alert">Referenzanwendung konnte nicht gestartet werden. Ergebniscode: ${safeText(code)}</section></main>`;
}
function startReferenceApp(options) {
  const cfg = options || {};
  const documentAdapter = cfg.documentAdapter || (typeof document !== "undefined" ? document : null);
  const root = cfg.root || (documentAdapter && documentAdapter.getElementById("reference-app"));
  try {
    return createReferenceApp({ ...cfg, documentAdapter, root });
  } catch (error) {
    const code = error && error.referenceCode ? error.referenceCode : "REFERENCE_BOOTSTRAP_FAILED";
    displayBootstrapError(root, code);
    return { ok: false, code, destroy() {} };
  }
}

function createReferenceApp(options) {
  const cfg = options || {};
  const documentAdapter = cfg.documentAdapter || (typeof document !== "undefined" ? document : null);
  const windowAdapter = cfg.windowAdapter || (typeof window !== "undefined" ? window : null);
  if (!documentAdapter) throw referenceError("DOCUMENT_MISSING", "documentAdapter is required");
  const urlProfile = windowAdapter && windowAdapter.location && windowAdapter.location.search ? new URLSearchParams(windowAdapter.location.search).get("profile") : null;
  const requestedProfile = cfg.profileId || urlProfile;
  const profileId = REFERENCE_PROFILES.includes(requestedProfile) ? requestedProfile : "default";
  const targetContext = createReferenceTargetContext(profileId);
  const root = cfg.root || documentAdapter.getElementById("reference-app");
  if (!root) throw referenceError("REFERENCE_ROOT_MISSING", "reference root is missing");

  const disposers = [];
  const ownedRefs = [];
  let destroyed = false;
  let lastResult = { ok: true, code: "INIT" };
  const visibleErrors = [];

  root.innerHTML = `
    <main class="reference-shell">
      <section id="${DOM_IDS.stage}" class="reference-stage" aria-label="Neutrale Referenzfläche">
        <article id="${DOM_IDS.card}" class="reference-demo-element reference-card" tabindex="0"><strong>Karte</strong><p>Neutrales Element mit Bewegung und Größe.</p></article>
        <h1 id="${DOM_IDS.heading}" class="reference-demo-element reference-heading" tabindex="0">Referenzüberschrift</h1>
        <button id="${DOM_IDS.action}" class="reference-demo-element reference-action" type="button">Aktionsfläche</button>
        <aside id="${DOM_IDS.info}" class="reference-demo-element reference-info" tabindex="0">Infobereich ohne Inline-Breite und ohne Inline-Höhe.</aside>
        <div id="${DOM_IDS.locked}" class="reference-demo-element reference-locked" tabindex="0">Gesperrtes Element</div>
        <div id="${DOM_IDS.overlay}" aria-hidden="true"></div>
      </section>
      <aside class="reference-panel-mount" aria-label="Referenzsteuerung">
        <div id="${DOM_IDS.panel}"></div>
        <div class="reference-tools">
          <label>Profil <select id="${DOM_IDS.profile}"><option value="default">default</option><option value="compact">compact</option></select></label>
          <button type="button" id="reference-show-initial">Ausgangszustand anzeigen</button>
          <button type="button" id="reference-show-layout">Aktuelle Layoutwerte anzeigen</button>
          <button type="button" id="reference-show-key">Storage-Schlüssel anzeigen</button>
          <button type="button" id="reference-reinit">Referenzanwendung neu initialisieren</button>
        </div>
        <div id="${DOM_IDS.status}" class="reference-status"></div>
        <div id="${DOM_IDS.errors}" class="reference-errors" hidden></div>
      </aside>
    </main>`;

  const registry = cfg.registry || createReferenceRegistry();
  const elementRefs = createElementRefRegistry();
  for (const [elementId, domId] of REF_BINDINGS) {
    const element = documentAdapter.getElementById(domId);
    const registered = elementRefs.register(elementId, element);
    if (!registered.ok) visibleErrors.push(`Ref-Registrierung fehlgeschlagen: ${elementId}`);
    else ownedRefs.push(elementId);
  }

  const resolvedStorage = Object.prototype.hasOwnProperty.call(cfg, "storage") ? { ok: true, storage: cfg.storage } : resolveBrowserStorage(windowAdapter);
  if (!resolvedStorage.ok) visibleErrors.push("Storage nicht verfügbar; Speichern ist blockiert. Ergebniscode: STORAGE_UNAVAILABLE");
  const storage = createBrowserLayoutStorage({ storage: resolvedStorage.storage, namespace: "ui-editor-reference-layout" });
  if (!storage.available && resolvedStorage.ok) visibleErrors.push("Storage nicht verfügbar; Speichern ist blockiert.");
  let hostAdapter;
  let runtime;
  try {
    hostAdapter = createReferenceHostAdapter(createBrowserHostAdapter({ elementRefs, windowAdapter }), registry);
    runtime = createUiEditorRuntime({ registry, hostAdapter, layoutStorage: storage, targetContext });
  } catch (_error) {
    throw referenceError("RUNTIME_HOST_INIT_FAILED", "runtime or host initialization failed");
  }
  const sessionResult = runtime.beginSession();
  if (!sessionResult.ok) visibleErrors.push(`Sessionstart fehlgeschlagen. Ergebniscode: ${resultCode(sessionResult)}`);

  const panelMount = documentAdapter.getElementById(DOM_IDS.panel);
  if (!panelMount) throw referenceError("PANEL_MOUNT_MISSING", "panel mount is missing");
  const overlayMount = documentAdapter.getElementById(DOM_IDS.stage);
  if (!overlayMount) throw referenceError("OVERLAY_MOUNT_MISSING", "overlay mount is missing");
  const controller = createUiEditorPanelController({ runtime, registry, stepSize: 5 });
  const panel = createUiEditorPanel({ controller, mountTarget: panelMount, documentAdapter });
  const selectionHost = createBrowserSelectionHost({ registry, elementRefs });
  const overlayHost = createBrowserOverlayHost({ overlayMountTarget: overlayMount, documentAdapter, windowAdapter });
  const bridge = createUiEditorBrowserBridge({ controller, elementRefs, selectionHost, overlayHost });

  const storagePreview = storage.available && typeof storage.readResult === "function" ? storage.readResult(targetContext) : null;
  if (storagePreview && storagePreview.ok === false) visibleErrors.push(`Gespeichertes Layout ungültig oder nicht ladbar: ${resultCode(storagePreview)}`);
  const autoload = runtime.loadLayout();
  lastResult = autoload;
  if (!autoload.ok && storage.available && !(storagePreview && storagePreview.ok === false)) visibleErrors.push(`Gespeichertes Layout ungültig oder nicht ladbar: ${resultCode(autoload)}`);

  function bind(node, type, listener) { node.addEventListener(type, listener); disposers.push(() => node.removeEventListener(type, listener)); }
  REF_BINDINGS.forEach(([elementId, domId]) => {
    const node = documentAdapter.getElementById(domId);
    bind(node, "click", (event) => { event.stopPropagation(); lastResult = selectionHost.select(elementId); renderStatus(); });
  });
  bind(documentAdapter.getElementById(DOM_IDS.stage), "click", () => { lastResult = bridge.clearSelection(); renderStatus(); });
  bind(documentAdapter.getElementById(DOM_IDS.panel), "click", (event) => event.stopPropagation());
  const unsubscribeController = controller.subscribe((state) => { if (destroyed) return; lastResult = state.lastResult || lastResult; renderStatus(); });
  disposers.push(unsubscribeController);

  const profileSelect = documentAdapter.getElementById(DOM_IDS.profile);
  profileSelect.value = profileId;
  bind(profileSelect, "change", () => {
    if (windowAdapter && windowAdapter.location) {
      windowAdapter.location.search = `?profile=${encodeURIComponent(profileSelect.value)}`;
    }
  });
  bind(documentAdapter.getElementById("reference-show-initial"), "click", () => showError(JSON.stringify(REF_BINDINGS.map(([id]) => hostAdapter.captureElementLayoutState(id).value), null, 2)));
  bind(documentAdapter.getElementById("reference-show-layout"), "click", () => showError(JSON.stringify(REF_BINDINGS.map(([id]) => runtime.inspectElement(id)), null, 2)));
  bind(documentAdapter.getElementById("reference-show-key"), "click", () => showError(storage.available ? storage.getKey(targetContext) : "Storage nicht verfügbar"));
  bind(documentAdapter.getElementById("reference-reinit"), "click", () => { if (windowAdapter && windowAdapter.location && windowAdapter.location.reload) windowAdapter.location.reload(); });

  function showError(text) { const node = documentAdapter.getElementById(DOM_IDS.errors); node.hidden = false; node.textContent = text; }
  function renderStatus() {
    if (destroyed) return;
    const status = runtime.getSessionStatus();
    const selection = selectionHost.getSelection();
    const persistence = runtime.getPersistenceStatus();
    const statusNode = documentAdapter.getElementById(DOM_IDS.status);
    statusNode.innerHTML = `<dl><dt>Session aktiv</dt><dd>${safeText(status.active)}</dd><dt>Auswahl</dt><dd>${safeText(selection.selectedElementId)}</dd><dt>Geändert</dt><dd>${safeText((status.changedElementIds || []).join(", "))}</dd><dt>Storage verfügbar</dt><dd>${safeText(persistence.available)}</dd><dt>Storage persistent</dt><dd>${safeText(persistence.persistent)}</dd><dt>Ergebniscode</dt><dd>${safeText(resultCode(lastResult))}</dd><dt>Profil</dt><dd>${targetContext.layoutProfileId}</dd></dl>`;
    const errorNode = documentAdapter.getElementById(DOM_IDS.errors);
    if (visibleErrors.length > 0) { errorNode.hidden = false; errorNode.textContent = visibleErrors.join(" "); }
  }
  renderStatus();

  return { runtime, controller, selectionHost, overlayHost, bridge, elementRefs, registry, hostAdapter, storage, targetContext, root,
    destroy() { if (destroyed) return; destroyed = true; disposers.splice(0).forEach((dispose) => dispose()); bridge.destroy(); overlayHost.destroy(); selectionHost.destroy(); panel.destroy(); controller.destroy(); ownedRefs.forEach((id) => elementRefs.unregister(id)); },
  };
}

if (typeof window !== "undefined") { window.createReferenceApp = createReferenceApp; window.startReferenceApp = startReferenceApp; }
module.exports = { createReferenceApp, startReferenceApp, resolveBrowserStorage, createReferenceHostAdapter, DOM_IDS, REF_BINDINGS };
