/* GENERATED FILE - do not edit manually. Build with npm run reference:build. */
(function(){const __modules={0:function(module,exports,__require){
"use strict";

const {
  createElementRefRegistry, createBrowserHostAdapter, createBrowserSelectionHost, createBrowserOverlayHost,
  createBrowserLayoutStorage, createUiEditorBrowserBridge, createUiEditorRuntime,
  createUiEditorPanelController, createUiEditorPanel,
} = __require(1);
const { createReferenceRegistry } = __require(43);
const { REFERENCE_PROFILES, createReferenceTargetContext } = __require(44);

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

},
1:function(module,exports,__require){
"use strict";

const {
  validateTargetAppAdapterPath,
  createTargetAppAdapterRuntime,
  getTargetAppAdapterPathSummary,
} = __require(2);
const { createEditorRuntimeLauncher } = __require(8);
const { createEditorRuntimeStatusViewModel } = __require(9);
const { createEditorSelectionViewModel } = __require(12);
const { createEditorScopeViewModel } = __require(11);
const { createEditorLayoutControlViewModel } = __require(13);
const {
  validateLayoutState,
  normalizeLayoutState,
  createLayoutState,
  getLayoutStateProfileKey,
  assertCompatibleLayoutProfile,
} = __require(15);
const { createMemoryLayoutStateStore } = __require(14);
const {
  SELECTION_CONTRACT_VERSION,
  SelectionContractErrorCodes,
  validateSelectionTargetContract,
  validateElementRefResolver,
} = __require(18);
const { createSelectionController, SelectionRuntimeErrorCodes } = __require(19);
const { createHoverOverlay } = __require(22);
const { createSelectedOverlay } = __require(24);
const { resolveSelectionTarget } = __require(21);
const { createUiEditorRuntime, validateLayoutEntryForElement } = __require(25);
const { createUiEditorPanelController } = __require(30);
const { createUiEditorPanelViewModel } = __require(33);
const { createUiEditorPanel } = __require(34);
const { createPanelMessageCatalog } = __require(32);
const { PANEL_INTENTS, PANEL_LAYERS, PANEL_MODES, PANEL_DIRECTIONS } = __require(31);
const { createPanelPositionStore } = __require(35);
const { RUNTIME_ERROR_CODES } = __require(26);
const { normalizeTargetContext, validateTargetContext } = __require(28);
const { normalizeLayoutEntry } = __require(29);
const { createElementRefRegistry } = __require(36);
const { createBrowserHostAdapter } = __require(38);
const { createBrowserSelectionHost } = __require(39);
const { createBrowserOverlayHost } = __require(40);
const { createBrowserLayoutStorage } = __require(41);
const { createUiEditorBrowserBridge } = __require(42);
const { BROWSER_ERROR_CODES } = __require(37);
const {
  validateSelectionHost,
  validateSelectionControllerContract,
  createSelectionStateSnapshot,
} = __require(20);

module.exports = Object.freeze({
  createElementRefRegistry,
  createBrowserHostAdapter,
  createBrowserSelectionHost,
  createBrowserOverlayHost,
  createBrowserLayoutStorage,
  createUiEditorBrowserBridge,
  BROWSER_ERROR_CODES,
  createUiEditorRuntime,
  validateLayoutEntryForElement,
  createUiEditorPanelController,
  createUiEditorPanelViewModel,
  createUiEditorPanel,
  createPanelMessageCatalog,
  PANEL_INTENTS,
  PANEL_LAYERS,
  PANEL_MODES,
  PANEL_DIRECTIONS,
  createPanelPositionStore,
  RUNTIME_ERROR_CODES,
  normalizeTargetContext,
  validateTargetContext,
  normalizeLayoutEntry,
  validateTargetAppAdapterPath,
  createTargetAppAdapterRuntime,
  getTargetAppAdapterPathSummary,
  createEditorRuntimeLauncher,
  createEditorRuntimeStatusViewModel,
  createEditorSelectionViewModel,
  createEditorScopeViewModel,
  createEditorLayoutControlViewModel,
  validateLayoutState,
  normalizeLayoutState,
  createLayoutState,
  getLayoutStateProfileKey,
  assertCompatibleLayoutProfile,
  createMemoryLayoutStateStore,
  SELECTION_CONTRACT_VERSION,
  SelectionContractErrorCodes,
  validateSelectionTargetContract,
  validateElementRefResolver,
  validateSelectionHost,
  validateSelectionControllerContract,
  createSelectionStateSnapshot,
  createSelectionController,
  createHoverOverlay,
  createSelectedOverlay,
  resolveSelectionTarget,
  SelectionRuntimeErrorCodes,
});

},
2:function(module,exports,__require){
"use strict";

const { createEditorCore } = __require(3);
const { validateHostAdapterContract } = __require(6);
const { validateTargetAppAdapterManifest } = __require(7);
const { createEditorRuntimeLauncher } = __require(8);
const { createEditorRuntimeStatusViewModel } = __require(9);
const { createEditorScopeViewModel } = __require(11);
const { createEditorSelectionViewModel } = __require(12);
const { createEditorLayoutControlViewModel } = __require(13);
const { createMemoryLayoutStateStore } = __require(14);

function isObject(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function clone(value) { if (Array.isArray(value)) return value.map(clone); if (isObject(value)) { const out = {}; Object.keys(value).forEach((key) => { out[key] = clone(value[key]); }); return out; } return value; }
function makeError(code, message, details) { return { code, message, ...(details || {}) }; }
function hasFunction(source, name) { return isObject(source) && typeof source[name] === "function"; }
function getManifest(input) {
  if (isObject(input) && isObject(input.adapterManifest)) return input.adapterManifest;
  const hostAdapter = input && input.hostAdapter;
  if (hasFunction(hostAdapter, "getAdapterManifest")) return hostAdapter.getAdapterManifest();
  if (isObject(hostAdapter) && isObject(hostAdapter.adapterManifest)) return hostAdapter.adapterManifest;
  if (isObject(hostAdapter) && isObject(hostAdapter.manifest)) return hostAdapter.manifest;
  return null;
}
function blocked(code, message, input, extra) {
  const manifest = extra && extra.manifest ? extra.manifest : null;
  return {
    ok: false,
    status: "blocked",
    blockCode: code,
    message,
    targetAppId: manifest && manifest.targetAppId || null,
    adapterName: manifest && manifest.adapterName || null,
    uiScope: manifest && manifest.uiScope || null,
    layoutScope: manifest && manifest.layoutScope || null,
    layoutProfileId: manifest && manifest.layoutProfileId || null,
    registryElementCount: 0,
    capabilities: [],
    errors: [makeError(code, message, extra && extra.details ? { details: clone(extra.details) } : undefined)],
  };
}
function okResult(manifest, registryElementCount, capabilities) {
  return {
    ok: true,
    status: "ok",
    blockCode: null,
    message: "Offizieller Ziel-App-Adapter-Pfad ist bereit.",
    targetAppId: manifest.targetAppId,
    adapterName: manifest.adapterName,
    uiScope: manifest.uiScope,
    layoutScope: manifest.layoutScope,
    layoutProfileId: manifest.layoutProfileId,
    registryElementCount,
    capabilities: capabilities.slice(),
    errors: [],
  };
}
function selectorFromManifest(manifest) {
  return { targetAppId: manifest.targetAppId, uiScope: manifest.uiScope, layoutScope: manifest.layoutScope, layoutProfileId: manifest.layoutProfileId };
}
function defaultLayoutState(manifest) { return { schemaVersion: 1, ...selectorFromManifest(manifest), version: 1, source: "default", elements: {} }; }
function registryCount(registry, editorCore) { if (hasFunction(registry, "size")) return registry.size(); if (hasFunction(editorCore, "listElements")) return editorCore.listElements().length; return 0; }
function listCapabilities(manifest) {
  const capabilities = ["adapter-manifest", "host-adapter", "registry", "runtime-launcher", "view-models", "layout-state-store"];
  ["saveLayoutState", "loadLayoutState", "resetLayoutState"].forEach((key) => { if (manifest[key] === true) capabilities.push(key); });
  return capabilities;
}

function build(input) {
  const safeInput = isObject(input) ? input : {};
  let manifest;
  try { manifest = getManifest(safeInput); } catch (error) { return { result: blocked("invalid_adapter_manifest", "AdapterManifest konnte nicht gelesen werden.", safeInput, { details: error.message }) }; }
  if (!manifest) return { result: blocked("missing_adapter_manifest", "AdapterManifest fehlt.", safeInput) };
  const manifestValidation = validateTargetAppAdapterManifest(manifest);
  if (!manifestValidation.ok) return { result: blocked("invalid_adapter_manifest", "AdapterManifest ist ungueltig.", safeInput, { manifest, details: manifestValidation.errors }) };
  if (!manifest.uiScope) return { result: blocked("unknown_scope", "UI-Scope fehlt oder ist unbekannt.", safeInput, { manifest }) };
  if (!manifest.layoutScope) return { result: blocked("missing_layout_scope", "Layout-Scope fehlt.", safeInput, { manifest }) };
  if (!manifest.layoutProfileId) return { result: blocked("invalid_layout_profile", "LayoutProfile fehlt oder ist ungueltig.", safeInput, { manifest }) };

  const hostAdapter = safeInput.hostAdapter;
  if (!hostAdapter) return { result: blocked("missing_host_adapter", "HostAdapter fehlt.", safeInput, { manifest }) };
  const hostValidation = validateHostAdapterContract(hostAdapter);
  if (!hostValidation.ok) return { result: blocked("invalid_host_adapter", "HostAdapter erfuellt den Vertrag nicht.", safeInput, { manifest, details: hostValidation.errors }) };

  let registry;
  try { registry = safeInput.registry || hostAdapter.getRegistry(); } catch (error) { return { result: blocked("invalid_registry", "Registry konnte nicht gelesen werden.", safeInput, { manifest, details: error.message }) }; }
  if (!registry) return { result: blocked("missing_registry", "Registry fehlt.", safeInput, { manifest }) };
  let editorCore;
  try { editorCore = createEditorCore(registry); } catch (error) { return { result: blocked("invalid_registry", "Registry ist ungueltig.", safeInput, { manifest, details: error.validationResult || error.message }) }; }
  const registryElements = hasFunction(registry, "listElements") ? registry.listElements() : [];
  const hasForeignScope = registryElements.some((element) => {
    if (!isObject(element)) return false;
    const elementUiScope = element.uiScope || element.scope || null;
    const elementLayoutScope = element.layoutScope || null;
    return (elementUiScope && elementUiScope !== manifest.uiScope) || (elementLayoutScope && elementLayoutScope !== manifest.layoutScope);
  });
  if (hasForeignScope) return { result: blocked("unknown_scope", "Registry enthaelt Elemente ausserhalb des Adapter-Scopes.", safeInput, { manifest }) };

  let runtimeStatus;
  try { runtimeStatus = createEditorRuntimeLauncher(hostAdapter); } catch (error) { return { result: blocked("runtime_launch_failed", "RuntimeLauncher ist fehlgeschlagen.", safeInput, { manifest, details: error.message }) }; }
  if (!runtimeStatus.ok) return { result: blocked(runtimeStatus.blocked || "runtime_launch_failed", "RuntimeLauncher blockiert den Start.", safeInput, { manifest, details: runtimeStatus.errors }) };

  let layoutStore = safeInput.layoutStore || createMemoryLayoutStateStore(safeInput.layoutStoreOptions);
  if (!isObject(layoutStore) || !hasFunction(layoutStore, "saveLayoutState") || !hasFunction(layoutStore, "loadLayoutState") || !hasFunction(layoutStore, "resetLayoutState")) {
    return { result: blocked("layout_state_unavailable", "LayoutStateStore muss Save/Load/Reset bereitstellen.", safeInput, { manifest }) };
  }
  const layoutState = safeInput.layoutState || defaultLayoutState(manifest);
  const save = layoutStore.saveLayoutState(layoutState);
  if (!save.ok) return { result: blocked(save.status || "layout_state_unavailable", "LayoutStateStore konnte das Profil nicht speichern.", safeInput, { manifest, details: save.errors }) };
  const load = layoutStore.loadLayoutState(selectorFromManifest(manifest));
  if (!load.ok) return { result: blocked(load.status || "layout_profile_not_found", "LayoutStateStore konnte das Profil nicht laden.", safeInput, { manifest, details: load.errors }) };
  const reset = layoutStore.resetLayoutState(selectorFromManifest(manifest));
  if (!reset.ok) return { result: blocked(reset.status || "layout_state_unavailable", "LayoutStateStore konnte das Profil nicht resetten.", safeInput, { manifest, details: reset.errors }) };

  const runtimeStatusViewModel = createEditorRuntimeStatusViewModel(runtimeStatus);
  const scopeViewModel = createEditorScopeViewModel({ uiScope: manifest.uiScope, layoutScope: manifest.layoutScope, manifest });
  const firstElement = hasFunction(registry, "listElements") ? registry.listElements()[0] : null;
  const selectionViewModel = firstElement ? createEditorSelectionViewModel(editorCore, firstElement.id, { scope: selectorFromManifest(manifest) }) : null;
  const layoutControlViewModel = createEditorLayoutControlViewModel({ hostAdapter, manifest, layoutState });
  return { result: okResult(manifest, registryCount(registry, editorCore), listCapabilities(manifest)), runtime: { manifest: clone(manifest), hostAdapter, registry, editorCore, layoutStore, runtimeStatus, viewModels: { runtimeStatus: runtimeStatusViewModel, scope: scopeViewModel, selection: selectionViewModel, layoutControls: layoutControlViewModel } } };
}
function validateTargetAppAdapterPath(input) { return build(input).result; }
function createTargetAppAdapterRuntime(input) { const built = build(input); return built.result.ok ? { ...built.result, runtime: built.runtime } : built.result; }
function getTargetAppAdapterPathSummary(input) { return validateTargetAppAdapterPath(input); }
module.exports = { validateTargetAppAdapterPath, createTargetAppAdapterRuntime, getTargetAppAdapterPathSummary };

},
3:function(module,exports,__require){
"use strict";

const { validateUiElementList } = __require(4);

function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneValue(entry));
  }

  if (value && typeof value === "object") {
    const clone = {};
    Object.keys(value).forEach((key) => {
      clone[key] = cloneValue(value[key]);
    });
    return clone;
  }

  return value;
}

function cloneElements(elements) {
  return elements.map((element) => cloneValue(element));
}

function cloneValidationResult(result) {
  return {
    ok: Boolean(result && result.ok),
    errors: Array.isArray(result && result.errors) ? result.errors.map((error) => cloneValue(error)) : [],
  };
}

function cloneElementTreeNode(node) {
  return {
    element: cloneValue(node.element),
    children: node.children.map((childNode) => cloneElementTreeNode(childNode)),
  };
}

function getAvailableOperations(element) {
  const lockedOpsSet = new Set(element.lockedOps);
  return element.allowedOps.filter((operation) => !lockedOpsSet.has(operation));
}

function cloneElementOperations(element) {
  return {
    elementId: element.id,
    allowedOps: element.allowedOps.slice(),
    lockedOps: element.lockedOps.slice(),
    availableOps: getAvailableOperations(element),
  };
}

function createEditorCoreError(message, validationResult) {
  const error = new Error(message);
  error.validationResult = cloneValidationResult(validationResult);
  return error;
}

function validateRegistryInterface(registry) {
  if (!registry || typeof registry !== "object") {
    return {
      ok: false,
      errors: [
        {
          code: "invalid_registry",
          message: "Editor-Core erwartet eine vorhandene Registry.",
        },
      ],
    };
  }

  if (typeof registry.listElements !== "function") {
    return {
      ok: false,
      errors: [
        {
          code: "invalid_registry_interface",
          message: "Registry muss eine listElements()-Funktion bereitstellen.",
        },
      ],
    };
  }

  return {
    ok: true,
    errors: [],
  };
}

function compareElementsByOrder(leftElement, rightElement) {
  return leftElement.order - rightElement.order;
}

function buildElementTree(elements) {
  const nodesById = new Map();

  elements.forEach((element) => {
    nodesById.set(element.id, {
      element,
      children: [],
    });
  });

  let rootNode = null;

  elements.forEach((element) => {
    const node = nodesById.get(element.id);

    if (element.type === "root") {
      rootNode = node;
      return;
    }

    const parentNode = nodesById.get(element.parentId);
    if (parentNode) {
      parentNode.children.push(node);
    }
  });

  nodesById.forEach((node) => {
    node.children.sort((leftNode, rightNode) => compareElementsByOrder(leftNode.element, rightNode.element));
  });

  return rootNode;
}

function createEditorCore(registry) {
  const registryValidationResult = validateRegistryInterface(registry);
  if (!registryValidationResult.ok) {
    throw createEditorCoreError("Ungueltige Registry fuer Editor-Core.", registryValidationResult);
  }

  const listedElements = registry.listElements();
  const validationResult = validateUiElementList(listedElements);
  if (!validationResult.ok) {
    throw createEditorCoreError("Registry enthaelt ungueltige UI-Elemente.", validationResult);
  }

  const storedElements = cloneElements(listedElements);
  const storedValidationResult = cloneValidationResult(validationResult);
  const storedElementTree = buildElementTree(storedElements);
  const storedElementsById = new Map();

  storedElements.forEach((element) => {
    storedElementsById.set(element.id, element);
  });

  return {
    hasElement(elementId) {
      return storedElementsById.has(elementId);
    },
    getElementOperations(elementId) {
      if (!storedElementsById.has(elementId)) {
        return null;
      }

      return cloneElementOperations(storedElementsById.get(elementId));
    },
    canElementPerformOperation(elementId, operation) {
      if (!storedElementsById.has(elementId)) {
        return false;
      }

      const element = storedElementsById.get(elementId);
      if (!element.allowedOps.includes(operation)) {
        return false;
      }

      return !element.lockedOps.includes(operation);
    },
    getElementDetails(elementId) {
      if (!storedElementsById.has(elementId)) {
        return null;
      }

      return cloneValue(storedElementsById.get(elementId));
    },
    listElements() {
      return cloneElements(storedElements);
    },
    getElementTree() {
      return storedElementTree ? cloneElementTreeNode(storedElementTree) : null;
    },
    getValidationResult() {
      return cloneValidationResult(storedValidationResult);
    },
    size() {
      return storedElements.length;
    },
  };
}

module.exports = {
  createEditorCore,
};

},
4:function(module,exports,__require){
"use strict";

const {
  UI_ELEMENT_TYPES,
  UI_ELEMENT_ROLES,
  UI_ELEMENT_OPERATIONS,
  UI_ELEMENT_REQUIRED_FIELDS,
} = __require(5);

const UI_TABLE_COLUMN_ROLES = Object.freeze([
  "contentColumn",
  "metaColumn",
  "structureColumn",
  "statusColumn",
  "dateColumn",
  "responsibleColumn",
  "visibilityColumn",
  "actionColumn",
]);

const FORBIDDEN_UI_ELEMENT_OPERATIONS = Object.freeze([
  "save",
  "create",
  "delete",
  "remove",
  "upload",
  "import",
  "export",
  "autosave",
  "database",
  "execute",
  "submit",
]);

const ALLOWED_TYPE_SET = new Set(UI_ELEMENT_TYPES);
const ALLOWED_ROLE_SET = new Set(UI_ELEMENT_ROLES);
const ALLOWED_OPERATION_SET = new Set(UI_ELEMENT_OPERATIONS);
const ALLOWED_TABLE_COLUMN_ROLE_SET = new Set(UI_TABLE_COLUMN_ROLES);
const FORBIDDEN_OPERATION_SET = new Set(FORBIDDEN_UI_ELEMENT_OPERATIONS);

function hasOwn(source, key) {
  return Boolean(source) && Object.prototype.hasOwnProperty.call(source, key);
}

function isObjectElement(element) {
  return Boolean(element) && typeof element === "object" && !Array.isArray(element);
}

function getElementId(element) {
  if (!isObjectElement(element) || typeof element.id !== "string" || element.id.trim() === "") {
    return undefined;
  }

  return element.id;
}

function createError(code, message, field, elementId) {
  const error = { code, message };

  if (field !== undefined) {
    error.field = field;
  }

  if (elementId !== undefined) {
    error.elementId = elementId;
  }

  return error;
}

function validateRequiredFields(element, errors, elementId) {
  UI_ELEMENT_REQUIRED_FIELDS.forEach((fieldName) => {
    if (!hasOwn(element, fieldName)) {
      errors.push(
        createError("missing_required_field", `Pflichtfeld fehlt: ${fieldName}`, fieldName, elementId)
      );
    }
  });
}

function validateTypeAndRole(element, errors, elementId) {
  if (hasOwn(element, "type") && !ALLOWED_TYPE_SET.has(element.type)) {
    errors.push(
      createError(
        "invalid_type",
        `Ungueltiger type-Wert: ${String(element.type)}.`,
        "type",
        elementId
      )
    );
  }

  if (hasOwn(element, "role") && !ALLOWED_ROLE_SET.has(element.role)) {
    errors.push(
      createError(
        "invalid_role",
        `Ungueltiger role-Wert: ${String(element.role)}.`,
        "role",
        elementId
      )
    );
  }
}

function validateOperationsField(fieldName, element, errors, elementId) {
  if (!hasOwn(element, fieldName)) {
    return;
  }

  const operations = element[fieldName];
  if (!Array.isArray(operations)) {
    errors.push(
      createError("invalid_operations_array", `${fieldName} muss ein Array sein.`, fieldName, elementId)
    );
    return;
  }

  operations.forEach((operation) => {
    if (!ALLOWED_OPERATION_SET.has(operation)) {
      errors.push(
        createError(
          "invalid_operation",
          `Ungueltige Operation in ${fieldName}: ${String(operation)}.`,
          fieldName,
          elementId
        )
      );
    }

    if (fieldName === "allowedOps" && FORBIDDEN_OPERATION_SET.has(operation)) {
      errors.push(
        createError(
          "forbidden_operation",
          `Fachliche Operation ist nicht erlaubt: ${String(operation)}.`,
          fieldName,
          elementId
        )
      );
    }
  });
}

function validateOperationConflicts(element, errors, elementId) {
  if (!Array.isArray(element.allowedOps) || !Array.isArray(element.lockedOps)) {
    return;
  }

  const lockedOpsSet = new Set(element.lockedOps);
  element.allowedOps.forEach((operation) => {
    if (lockedOpsSet.has(operation)) {
      errors.push(
        createError(
          "conflicting_operation",
          `Operation gleichzeitig erlaubt und gesperrt: ${String(operation)}.`,
          "allowedOps",
          elementId
        )
      );
    }
  });
}

function validateUiElement(element) {
  const errors = [];

  if (!element || typeof element !== "object") {
    return {
      ok: false,
      errors: [createError("invalid_element", "Element muss ein Objekt sein.")],
    };
  }

  if (Array.isArray(element)) {
    return {
      ok: false,
      errors: [createError("invalid_element", "Arrays sind keine gueltigen UI-Elemente.")],
    };
  }

  const elementId = getElementId(element);

  validateRequiredFields(element, errors, elementId);
  validateTypeAndRole(element, errors, elementId);
  validateOperationsField("allowedOps", element, errors, elementId);
  validateOperationsField("lockedOps", element, errors, elementId);
  validateOperationConflicts(element, errors, elementId);

  return {
    ok: errors.length === 0,
    errors,
  };
}

function isBlankParentId(parentId) {
  return parentId === null || parentId === "";
}

function collectElementsById(elements) {
  const elementsById = new Map();

  elements.forEach((element) => {
    const elementId = getElementId(element);
    if (elementId !== undefined && !elementsById.has(elementId)) {
      elementsById.set(elementId, element);
    }
  });

  return elementsById;
}

function validateRootCount(elements, errors) {
  const rootElements = elements.filter((element) => isObjectElement(element) && element.type === "root");

  if (rootElements.length === 0) {
    errors.push(createError("missing_root", "Elementliste muss genau ein root-Element enthalten.", "type"));
    return null;
  }

  if (rootElements.length > 1) {
    rootElements.forEach((rootElement) => {
      errors.push(
        createError(
          "multiple_roots",
          "Elementliste darf nur ein root-Element enthalten.",
          "type",
          getElementId(rootElement)
        )
      );
    });
  }

  return rootElements[0];
}

function validateParentReferences(elements, elementsById, errors) {
  elements.forEach((element) => {
    if (!isObjectElement(element)) {
      return;
    }

    const elementId = getElementId(element);

    if (element.type === "root") {
      if (hasOwn(element, "parentId") && !isBlankParentId(element.parentId)) {
        errors.push(
          createError("invalid_root_parent", "root-Element darf keinen Parent haben.", "parentId", elementId)
        );
      }
      return;
    }

    if (!hasOwn(element, "parentId") || isBlankParentId(element.parentId)) {
      errors.push(
        createError("missing_parent", "Nicht-root-Element braucht einen parentId.", "parentId", elementId)
      );
      return;
    }

    if (!elementsById.has(element.parentId)) {
      errors.push(
        createError(
          "unknown_parent",
          `parentId verweist auf kein Element: ${String(element.parentId)}.`,
          "parentId",
          elementId
        )
      );
    }
  });
}

function validateParentCycles(elements, elementsById, errors) {
  const checkedElementIds = new Set();

  elements.forEach((element) => {
    const startId = getElementId(element);
    if (startId === undefined || checkedElementIds.has(startId)) {
      return;
    }

    const pathIds = new Set();
    let currentElement = element;

    while (isObjectElement(currentElement)) {
      const currentId = getElementId(currentElement);
      if (currentId === undefined) {
        return;
      }

      if (pathIds.has(currentId)) {
        errors.push(createError("parent_cycle", "Parent-Struktur enthaelt einen Zyklus.", "parentId", currentId));
        return;
      }

      if (checkedElementIds.has(currentId)) {
        return;
      }

      pathIds.add(currentId);

      if (currentElement.type === "root" || !hasOwn(currentElement, "parentId") || isBlankParentId(currentElement.parentId)) {
        pathIds.forEach((pathId) => checkedElementIds.add(pathId));
        return;
      }

      currentElement = elementsById.get(currentElement.parentId);
      if (!currentElement) {
        pathIds.forEach((pathId) => checkedElementIds.add(pathId));
        return;
      }
    }
  });
}

function validateParentStructure(elements, errors) {
  const elementsById = collectElementsById(elements);
  validateRootCount(elements, errors);
  validateParentReferences(elements, elementsById, errors);
  validateParentCycles(elements, elementsById, errors);
  return elementsById;
}

function validateActionColumnOperations(element, errors, elementId) {
  if (!Array.isArray(element.allowedOps)) {
    return;
  }

  element.allowedOps.forEach((operation) => {
    if (FORBIDDEN_OPERATION_SET.has(operation)) {
      errors.push(
        createError(
          "forbidden_action_column_operation",
          `Aktionsspalte darf keine fachliche Editoroperation fuehren: ${String(operation)}.`,
          "allowedOps",
          elementId
        )
      );
    }
  });
}

function validateTableColumns(elements, elementsById, errors) {
  elements.forEach((element) => {
    if (!isObjectElement(element) || element.type !== "tableColumn") {
      return;
    }

    const elementId = getElementId(element);

    if (
      !hasOwn(element, "columnRole") ||
      element.columnRole === undefined ||
      element.columnRole === null ||
      element.columnRole === ""
    ) {
      errors.push(
        createError("missing_column_role", "tableColumn braucht eine columnRole.", "columnRole", elementId)
      );
    } else if (!ALLOWED_TABLE_COLUMN_ROLE_SET.has(element.columnRole)) {
      errors.push(
        createError(
          "invalid_column_role",
          `Ungueltige columnRole: ${String(element.columnRole)}.`,
          "columnRole",
          elementId
        )
      );
    }

    const parentElement = elementsById.get(element.parentId);
    if (parentElement && parentElement.type !== "table") {
      errors.push(
        createError(
          "invalid_table_column_parent",
          "tableColumn braucht ein table-Element als Parent.",
          "parentId",
          elementId
        )
      );
    }

    if (element.columnRole === "actionColumn") {
      validateActionColumnOperations(element, errors, elementId);
    }
  });
}

function validateUiElementList(elements) {
  if (!Array.isArray(elements)) {
    return {
      ok: false,
      errors: [createError("invalid_element_list", "Elementliste muss ein Array sein.")],
    };
  }

  const errors = [];
  elements.forEach((element) => {
    const result = validateUiElement(element);
    errors.push(...result.errors);
  });

  const elementsById = validateParentStructure(elements, errors);
  validateTableColumns(elements, elementsById, errors);

  return {
    ok: errors.length === 0,
    errors,
  };
}

module.exports = {
  FORBIDDEN_UI_ELEMENT_OPERATIONS,
  UI_TABLE_COLUMN_ROLES,
  validateUiElement,
  validateUiElementList,
};

},
5:function(module,exports,__require){
"use strict";

const UI_ELEMENT_TYPES = Object.freeze([
  "root",
  "area",
  "group",
  "subgroup",
  "component",
  "componentPart",
  "table",
  "tableColumn",
  "list",
  "card",
  "dialog",
  "toolbar",
  "button",
  "field",
  "label",
  "statusIndicator",
]);

const UI_ELEMENT_ROLES = Object.freeze([
  "layout",
  "content",
  "meta",
  "structure",
  "status",
  "date",
  "responsible",
  "visibility",
  "action",
  "navigation",
  "editor-launcher",
  "system",
]);

const UI_ELEMENT_OPERATIONS = Object.freeze([
  "inspect",
  "show",
  "hide",
  "move",
  "resize",
  "reorder",
  "rename",
  "changeWidth",
  "pin",
  "unpin",
  "reset",
  "applyPreset",
  "delete",
  "executeTargetAction",
  "modifyDomainData",
]);

const UI_ELEMENT_REQUIRED_FIELDS = Object.freeze([
  "id",
  "name",
  "type",
  "role",
  "parentId",
  "order",
  "visible",
  "editable",
  "allowedOps",
  "lockedOps",
]);

const UI_ELEMENT_OPTIONAL_FIELDS = Object.freeze([
  "columnRole",
  "fieldKind",
  "actionKind",
  "componentKind",
  "width",
  "minWidth",
  "maxWidth",
  "layoutArea",
]);

const UI_ELEMENT_ARRAY_FIELDS = Object.freeze(["allowedOps", "lockedOps"]);
const UI_ELEMENT_BOOLEAN_FIELDS = Object.freeze(["visible", "editable"]);
const UI_ELEMENT_NUMERIC_FIELDS = Object.freeze(["order", "width", "minWidth", "maxWidth"]);
const UI_ELEMENT_FIELDS = Object.freeze([...UI_ELEMENT_REQUIRED_FIELDS, ...UI_ELEMENT_OPTIONAL_FIELDS]);

function hasOwn(source, key) {
  return Boolean(source) && Object.prototype.hasOwnProperty.call(source, key);
}

function cloneFieldValue(fieldName, value) {
  if (UI_ELEMENT_ARRAY_FIELDS.includes(fieldName) && Array.isArray(value)) {
    return value.slice();
  }

  return value;
}

function normalizeUiElement(element) {
  if (!element || typeof element !== "object" || Array.isArray(element)) {
    return {};
  }

  const normalized = {};

  for (const fieldName of UI_ELEMENT_FIELDS) {
    if (!hasOwn(element, fieldName)) {
      continue;
    }

    normalized[fieldName] = cloneFieldValue(fieldName, element[fieldName]);
  }

  return normalized;
}

function createUiElement(values) {
  return normalizeUiElement(values);
}

module.exports = {
  UI_ELEMENT_TYPES,
  UI_ELEMENT_ROLES,
  UI_ELEMENT_OPERATIONS,
  UI_ELEMENT_REQUIRED_FIELDS,
  UI_ELEMENT_OPTIONAL_FIELDS,
  UI_ELEMENT_ARRAY_FIELDS,
  UI_ELEMENT_BOOLEAN_FIELDS,
  UI_ELEMENT_NUMERIC_FIELDS,
  UI_ELEMENT_FIELDS,
  normalizeUiElement,
  createUiElement,
};

},
6:function(module,exports,__require){
"use strict";

const HOST_ADAPTER_REQUIRED_METHODS = [
  "getRegistry",
  "getCurrentLayoutState",
  "submitChangeRequest",
];

function getHostAdapterRequiredMethods() {
  return HOST_ADAPTER_REQUIRED_METHODS.slice();
}

function createResult(errors) {
  return {
    ok: errors.length === 0,
    errors,
  };
}

function validateHostAdapterContract(adapter) {
  const errors = [];

  if (!adapter || typeof adapter !== "object" || Array.isArray(adapter)) {
    errors.push({
      code: "invalid_host_adapter",
      message: "Host-Adapter muss ein Objekt sein.",
    });
    return createResult(errors);
  }

  HOST_ADAPTER_REQUIRED_METHODS.forEach((methodName) => {
    if (typeof adapter[methodName] !== "function") {
      errors.push({
        code: "missing_host_adapter_method",
        method: methodName,
        message: `Host-Adapter muss ${methodName}() bereitstellen.`,
      });
    }
  });

  return createResult(errors);
}

module.exports = {
  getHostAdapterRequiredMethods,
  validateHostAdapterContract,
};

},
7:function(module,exports,__require){
"use strict";

const TARGET_APP_ADAPTER_MANIFEST_REQUIRED_FIELDS = Object.freeze([
  "targetAppId",
  "adapterName",
  "adapterVersion",
  "uiScope",
  "layoutScope",
  "layoutProfileId",
  "supportedElementTypes",
  "supportedRoles",
  "supportedOperations",
  "lockedOperations",
  "persistenceMode",
  "executionMode",
  "riskClass",
  "rollbackStrategy",
  "testStrategy",
]);

const TARGET_APP_ADAPTER_MANIFEST_OPTIONAL_FIELDS = Object.freeze([
  "description",
  "manifestVersion",
  "createdAt",
  "updatedAt",
  "uiToLayoutScope",
  "saveLayoutState",
  "loadLayoutState",
  "resetLayoutState",
  "notes",
]);

const FORBIDDEN_TARGET_APP_ADAPTER_MANIFEST_FIELDS = Object.freeze([
  "fachDaten",
  "businessData",
  "database",
  "sql",
  "recordId",
  "entity",
  "tableName",
  "save",
  "delete",
  "submit",
  "upload",
  "customer",
  "project",
  "task",
  "statusText",
  "amount",
  "price",
  "personalData",
  "documentData",
  "productiveData",
  "domScan",
  "autoDetect",
  "autoRegister",
]);

const TARGET_APP_ADAPTER_MANIFEST_ALLOWED_MODES = Object.freeze({
  persistenceModes: Object.freeze(["none", "memory-only", "layout-state-store"]),
  executionModes: Object.freeze(["disabled", "dry-run", "test-host", "manual-gated"]),
  riskClasses: Object.freeze(["low", "medium", "high", "blocked"]),
});

const STRING_FIELDS = Object.freeze([
  "targetAppId",
  "adapterName",
  "adapterVersion",
  "uiScope",
  "layoutScope",
  "layoutProfileId",
  "persistenceMode",
  "executionMode",
  "riskClass",
  "rollbackStrategy",
  "testStrategy",
]);

const ARRAY_FIELDS = Object.freeze([
  "supportedElementTypes",
  "supportedRoles",
  "supportedOperations",
  "lockedOperations",
]);

function cloneManifestValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneManifestValue(entry));
  }

  if (value && typeof value === "object") {
    const clone = {};
    Object.keys(value).forEach((key) => {
      clone[key] = cloneManifestValue(value[key]);
    });
    return clone;
  }

  return value;
}

function isManifestObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function createManifestError(code, message, field) {
  const error = { code, message };

  if (field !== undefined) {
    error.field = field;
  }

  return error;
}

function getTargetAppAdapterManifestRequiredFields() {
  return TARGET_APP_ADAPTER_MANIFEST_REQUIRED_FIELDS.slice();
}

function getTargetAppAdapterManifestOptionalFields() {
  return TARGET_APP_ADAPTER_MANIFEST_OPTIONAL_FIELDS.slice();
}

function getForbiddenTargetAppAdapterManifestFields() {
  return FORBIDDEN_TARGET_APP_ADAPTER_MANIFEST_FIELDS.slice();
}

function getTargetAppAdapterManifestAllowedModes() {
  return {
    persistenceModes: TARGET_APP_ADAPTER_MANIFEST_ALLOWED_MODES.persistenceModes.slice(),
    executionModes: TARGET_APP_ADAPTER_MANIFEST_ALLOWED_MODES.executionModes.slice(),
    riskClasses: TARGET_APP_ADAPTER_MANIFEST_ALLOWED_MODES.riskClasses.slice(),
  };
}

function getKnownManifestFields() {
  return TARGET_APP_ADAPTER_MANIFEST_REQUIRED_FIELDS.concat(TARGET_APP_ADAPTER_MANIFEST_OPTIONAL_FIELDS);
}

function normalizeTargetAppAdapterManifest(values) {
  if (!isManifestObject(values)) {
    return {};
  }

  const knownFields = getKnownManifestFields();
  const forbiddenFields = new Set(FORBIDDEN_TARGET_APP_ADAPTER_MANIFEST_FIELDS);

  return knownFields.reduce((manifest, field) => {
    if (!forbiddenFields.has(field) && Object.prototype.hasOwnProperty.call(values, field)) {
      manifest[field] = cloneManifestValue(values[field]);
    }
    return manifest;
  }, {});
}

function createTargetAppAdapterManifest(values) {
  return normalizeTargetAppAdapterManifest(values);
}

function validateRequiredFields(manifest, errors) {
  TARGET_APP_ADAPTER_MANIFEST_REQUIRED_FIELDS.forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(manifest, field)) {
      errors.push(createManifestError("missing_required_field", `Pflichtfeld ${field} fehlt.`, field));
    }
  });
}

function validateStringFields(manifest, errors) {
  STRING_FIELDS.forEach((field) => {
    if (
      Object.prototype.hasOwnProperty.call(manifest, field) &&
      (typeof manifest[field] !== "string" || manifest[field].trim() === "")
    ) {
      errors.push(createManifestError("invalid_string_field", `${field} muss eine nicht leere Zeichenkette sein.`, field));
    }
  });
}

function validateArrayFields(manifest, errors) {
  ARRAY_FIELDS.forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(manifest, field)) {
      return;
    }

    if (!Array.isArray(manifest[field])) {
      errors.push(createManifestError("invalid_array_field", `${field} muss ein Array sein.`, field));
      return;
    }

    const hasInvalidEntry = manifest[field].some((entry) => typeof entry !== "string" || entry.trim() === "");
    if (hasInvalidEntry) {
      errors.push(
        createManifestError("invalid_array_field", `${field} darf nur nicht leere Zeichenketten enthalten.`, field)
      );
    }
  });
}

function validateModes(manifest, errors) {
  const allowedModes = TARGET_APP_ADAPTER_MANIFEST_ALLOWED_MODES;
  const modeChecks = [
    ["persistenceMode", allowedModes.persistenceModes],
    ["executionMode", allowedModes.executionModes],
    ["riskClass", allowedModes.riskClasses],
  ];

  modeChecks.forEach(([field, allowedValues]) => {
    if (
      Object.prototype.hasOwnProperty.call(manifest, field) &&
      typeof manifest[field] === "string" &&
      manifest[field].trim() !== "" &&
      !allowedValues.includes(manifest[field])
    ) {
      errors.push(createManifestError("invalid_mode", `${field} ist nicht erlaubt.`, field));
    }
  });
}

function validateForbiddenFields(manifest, errors) {
  FORBIDDEN_TARGET_APP_ADAPTER_MANIFEST_FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(manifest, field)) {
      errors.push(createManifestError("forbidden_field", `${field} ist im Adapter-Manifest nicht erlaubt.`, field));
    }
  });
}

function validateTargetAppAdapterManifest(manifest) {
  const errors = [];

  if (!isManifestObject(manifest)) {
    errors.push(createManifestError("invalid_manifest", "Adapter-Manifest muss ein Objekt sein."));
    return {
      ok: false,
      errors,
    };
  }

  validateForbiddenFields(manifest, errors);
  validateRequiredFields(manifest, errors);
  validateStringFields(manifest, errors);
  validateArrayFields(manifest, errors);
  validateModes(manifest, errors);

  return {
    ok: errors.length === 0,
    errors,
  };
}

module.exports = {
  getTargetAppAdapterManifestRequiredFields,
  getTargetAppAdapterManifestOptionalFields,
  getForbiddenTargetAppAdapterManifestFields,
  getTargetAppAdapterManifestAllowedModes,
  normalizeTargetAppAdapterManifest,
  createTargetAppAdapterManifest,
  validateTargetAppAdapterManifest,
};

},
8:function(module,exports,__require){
"use strict";

const { createEditorCore } = __require(3);
const { validateHostAdapterContract } = __require(6);
const { validateTargetAppAdapterManifest } = __require(7);

function cloneRuntimeValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneRuntimeValue(entry));
  }

  if (value && typeof value === "object") {
    const clone = {};
    Object.keys(value).forEach((key) => {
      clone[key] = cloneRuntimeValue(value[key]);
    });
    return clone;
  }

  return value;
}

function createRuntimeError(code, message, details) {
  const error = { code, message };

  if (details !== undefined) {
    error.details = cloneRuntimeValue(details);
  }

  return error;
}

function createBlockedRuntimeStatus(values) {
  const safeValues = values && typeof values === "object" && !Array.isArray(values) ? values : {};
  const errors = Array.isArray(safeValues.errors) ? safeValues.errors.map((error) => cloneRuntimeValue(error)) : [];

  return {
    ok: false,
    targetAppId: safeValues.targetAppId || null,
    adapterName: safeValues.adapterName || null,
    uiScope: safeValues.uiScope || null,
    layoutScope: safeValues.layoutScope || null,
    registryElementCount: 0,
    selectedElementId: null,
    availableOperations: [],
    blocked: safeValues.blocked || false,
    errors,
  };
}

function createOkRuntimeStatus(values) {
  const safeValues = values && typeof values === "object" && !Array.isArray(values) ? values : {};

  return {
    ok: true,
    targetAppId: safeValues.targetAppId || null,
    adapterName: safeValues.adapterName || null,
    uiScope: safeValues.uiScope || null,
    layoutScope: safeValues.layoutScope || null,
    registryElementCount: safeValues.registryElementCount,
    selectedElementId: null,
    availableOperations: [],
    blocked: false,
    errors: [],
  };
}

function getAdapterManifest(hostAdapter) {
  if (!hostAdapter || typeof hostAdapter !== "object") {
    return null;
  }

  if (typeof hostAdapter.getAdapterManifest === "function") {
    return hostAdapter.getAdapterManifest();
  }

  if (Object.prototype.hasOwnProperty.call(hostAdapter, "adapterManifest")) {
    return hostAdapter.adapterManifest;
  }

  if (Object.prototype.hasOwnProperty.call(hostAdapter, "manifest")) {
    return hostAdapter.manifest;
  }

  return null;
}

function countRegistryElements(editorCore) {
  if (editorCore && typeof editorCore.size === "function") {
    return editorCore.size();
  }

  if (editorCore && typeof editorCore.listElements === "function") {
    return editorCore.listElements().length;
  }

  return 0;
}

function extractScopeValues(manifest) {
  return {
    targetAppId: manifest && typeof manifest.targetAppId === "string" ? manifest.targetAppId : null,
    adapterName: manifest && typeof manifest.adapterName === "string" ? manifest.adapterName : null,
    uiScope: manifest && typeof manifest.uiScope === "string" ? manifest.uiScope : null,
    layoutScope: manifest && typeof manifest.layoutScope === "string" ? manifest.layoutScope : null,
  };
}

function createEditorRuntimeLauncher(hostAdapter) {
  if (!hostAdapter) {
    return createBlockedRuntimeStatus({
      blocked: "missing_host_adapter",
      errors: [createRuntimeError("missing_host_adapter", "Runtime benoetigt einen HostAdapter.")],
    });
  }

  const hostValidation = validateHostAdapterContract(hostAdapter);
  if (!hostValidation.ok) {
    return createBlockedRuntimeStatus({
      blocked: "invalid_host_adapter",
      errors: [
        createRuntimeError("invalid_host_adapter", "HostAdapter erfuellt den Vertrag nicht.", hostValidation.errors),
      ],
    });
  }

  let manifest = null;
  let scopeValues = extractScopeValues(null);

  try {
    manifest = getAdapterManifest(hostAdapter);
  } catch (error) {
    return createBlockedRuntimeStatus({
      blocked: "invalid_manifest",
      errors: [createRuntimeError("invalid_manifest", "AdapterManifest konnte nicht gelesen werden.", error.message)],
    });
  }

  if (manifest !== null && manifest !== undefined) {
    scopeValues = extractScopeValues(manifest);
    const manifestValidation = validateTargetAppAdapterManifest(manifest);

    if (!manifestValidation.ok) {
      return createBlockedRuntimeStatus({
        ...scopeValues,
        blocked: "invalid_manifest",
        errors: [
          createRuntimeError("invalid_manifest", "AdapterManifest erfuellt den Vertrag nicht.", manifestValidation.errors),
        ],
      });
    }

    if (!scopeValues.uiScope || !scopeValues.layoutScope) {
      return createBlockedRuntimeStatus({
        ...scopeValues,
        blocked: "unknown_scope",
        errors: [createRuntimeError("unknown_scope", "AdapterManifest muss UI- und Layout-Scope bereitstellen.")],
      });
    }
  }

  let registry;
  try {
    registry = hostAdapter.getRegistry();
  } catch (error) {
    return createBlockedRuntimeStatus({
      ...scopeValues,
      blocked: "invalid_registry",
      errors: [createRuntimeError("invalid_registry", "Registry konnte nicht gelesen werden.", error.message)],
    });
  }

  let editorCore;
  try {
    editorCore = createEditorCore(registry);
  } catch (error) {
    return createBlockedRuntimeStatus({
      ...scopeValues,
      blocked: "invalid_registry",
      errors: [createRuntimeError("invalid_registry", "Registry ist fuer die Runtime ungueltig.", error.validationResult || error.message)],
    });
  }

  try {
    hostAdapter.getCurrentLayoutState();
  } catch (error) {
    return createBlockedRuntimeStatus({
      ...scopeValues,
      blocked: "layout_state_unavailable",
      errors: [createRuntimeError("layout_state_unavailable", "LayoutState konnte nicht gelesen werden.", error.message)],
    });
  }

  return createOkRuntimeStatus({
    ...scopeValues,
    registryElementCount: countRegistryElements(editorCore),
  });
}

module.exports = {
  createEditorRuntimeLauncher,
};

},
9:function(module,exports,__require){
"use strict";

const { getEditorStatusMessage } = __require(10);

function cloneValue(value) {
  if (Array.isArray(value)) return value.map((entry) => cloneValue(entry));
  if (value && typeof value === "object") {
    const clone = {};
    Object.keys(value).forEach((key) => { clone[key] = cloneValue(value[key]); });
    return clone;
  }
  return value;
}

function asList(value) {
  return Array.isArray(value) ? value.map((entry) => cloneValue(entry)) : [];
}

function firstErrorCode(errors) {
  return errors.length > 0 && typeof errors[0].code === "string" ? errors[0].code : null;
}

function createEditorRuntimeStatusViewModel(runtimeStatus, options) {
  const status = runtimeStatus && typeof runtimeStatus === "object" && !Array.isArray(runtimeStatus) ? runtimeStatus : {};
  const safeOptions = options && typeof options === "object" && !Array.isArray(options) ? options : {};
  const errors = asList(status.errors);
  const blockCode = status.blocked || firstErrorCode(errors) || null;
  const selectedElement = safeOptions.selectedElement && typeof safeOptions.selectedElement === "object" ? safeOptions.selectedElement : null;
  const selectedElementId = status.selectedElementId || (selectedElement && selectedElement.id) || null;

  return {
    ok: Boolean(status.ok) && !blockCode,
    blocked: Boolean(blockCode),
    blockCode,
    message: blockCode ? getEditorStatusMessage(blockCode) : "Runtime ist bereit.",
    targetAppId: status.targetAppId || null,
    adapterName: status.adapterName || null,
    uiScope: status.uiScope || null,
    layoutScope: status.layoutScope || null,
    registryElementCount: Number.isInteger(status.registryElementCount) ? status.registryElementCount : 0,
    selectedElementId,
    selectedElementName: selectedElement && typeof selectedElement.name === "string" ? selectedElement.name : null,
    availableOperations: asList(status.availableOperations),
    lockedOperations: asList(status.lockedOperations),
    errors,
  };
}

module.exports = { createEditorRuntimeStatusViewModel };

},
10:function(module,exports,__require){
"use strict";

const EDITOR_STATUS_MESSAGES = Object.freeze({
  no_selection: "Kein Element ausgewaehlt.",
  unknown_scope: "Scope ist nicht bekannt oder nicht verfuegbar.",
  unknown_element: "Element ist nicht registriert.",
  wrong_scope: "Element gehoert nicht zum aktiven Scope.",
  operation_not_allowed: "Operation ist fuer dieses Element nicht erlaubt.",
  operation_locked: "Operation ist fuer dieses Element gesperrt.",
  invalid_payload: "Aenderungsdaten sind ungueltig.",
  forbidden_field: "Feld ist im neutralen Vertrag nicht erlaubt.",
  layout_state_unavailable: "Layout-Zustand ist nicht verfuegbar.",
  invalid_layout_state: "Layout-Zustand ist ungueltig.",
  unsupported_layout_schema_version: "Layout-Schema-Version wird nicht unterstuetzt.",
  incompatible_layout_profile: "Layout-Profil passt nicht zum aktiven Scope.",
  layout_profile_not_found: "Layout-Profil wurde nicht gefunden.",
  layout_reset_unavailable: "Layout-Reset ist nicht verfuegbar.",
  target_rejected_change: "Ziel hat die Layout-Aenderung abgelehnt.",
});

function getEditorStatusMessage(code) {
  return EDITOR_STATUS_MESSAGES[code] || "Neutraler Editor-Status.";
}

module.exports = {
  EDITOR_STATUS_MESSAGES,
  getEditorStatusMessage,
};

},
11:function(module,exports,__require){
"use strict";

const { getEditorStatusMessage } = __require(10);

function manifestScopes(manifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) return [];
  const scopes = [];
  if (typeof manifest.uiScope === "string" && typeof manifest.layoutScope === "string") {
    scopes.push({ uiScope: manifest.uiScope, layoutScope: manifest.layoutScope });
  }
  if (manifest.uiToLayoutScope && typeof manifest.uiToLayoutScope === "object" && !Array.isArray(manifest.uiToLayoutScope)) {
    Object.keys(manifest.uiToLayoutScope).forEach((uiScope) => {
      if (typeof manifest.uiToLayoutScope[uiScope] === "string") scopes.push({ uiScope, layoutScope: manifest.uiToLayoutScope[uiScope] });
    });
  }
  return scopes;
}

function scopeKnown(scope, knownScopes) {
  if (!scope || !scope.uiScope || !scope.layoutScope) return false;
  if (knownScopes.length === 0) return true;
  return knownScopes.some((known) => known.uiScope === scope.uiScope && known.layoutScope === scope.layoutScope);
}

function createEditorScopeViewModel(values) {
  const safeValues = values && typeof values === "object" && !Array.isArray(values) ? values : {};
  const activeScope = { uiScope: safeValues.uiScope || null, layoutScope: safeValues.layoutScope || null };
  const knownScopes = Array.isArray(safeValues.knownScopes) ? safeValues.knownScopes.slice() : manifestScopes(safeValues.manifest);
  const known = scopeKnown(activeScope, knownScopes);
  return {
    ok: known,
    blocked: !known,
    blockCode: known ? null : "unknown_scope",
    message: known ? "Scope ist aktiv." : getEditorStatusMessage("unknown_scope"),
    uiScope: activeScope.uiScope,
    layoutScope: activeScope.layoutScope,
    knownScopes,
    selectedElementId: known ? safeValues.selectedElementId || null : null,
  };
}

function createEditorScopeChangeViewModel(currentScope, nextScope) {
  const current = currentScope && typeof currentScope === "object" ? currentScope : {};
  const next = nextScope && typeof nextScope === "object" ? nextScope : {};
  const base = createEditorScopeViewModel(next);
  return {
    ...base,
    status: base.ok ? "scope_changed" : "unknown_scope",
    previousUiScope: current.uiScope || null,
    previousLayoutScope: current.layoutScope || null,
    selectionCleared: true,
    selectedElementId: null,
  };
}

module.exports = { createEditorScopeViewModel, createEditorScopeChangeViewModel };

},
12:function(module,exports,__require){
"use strict";

const { getEditorStatusMessage } = __require(10);

function cloneValue(value) { if (Array.isArray(value)) return value.map(cloneValue); if (value && typeof value === "object") { const clone = {}; Object.keys(value).forEach((key) => { clone[key] = cloneValue(value[key]); }); return clone; } return value; }
function list(value) { return Array.isArray(value) ? value.map(cloneValue) : []; }
function hasFunction(source, name) { return Boolean(source) && typeof source === "object" && typeof source[name] === "function"; }

function elementMatchesScope(element, scope) {
  if (!scope || !element || typeof element !== "object") return true;
  const elementUiScope = element.uiScope || element.scope || null;
  const elementLayoutScope = element.layoutScope || null;
  if (!elementUiScope && !elementLayoutScope) return true;
  return elementUiScope === scope.uiScope || elementLayoutScope === scope.layoutScope;
}

function getOperationState(allowedOps, lockedOps, operation) {
  if (!operation) return null;
  if (lockedOps.includes(operation)) return "operation_locked";
  if (!allowedOps.includes(operation)) return "operation_not_allowed";
  return "available";
}

function createEditorSelectionViewModel(editorCore, selectedElementId, options) {
  const safeOptions = options && typeof options === "object" && !Array.isArray(options) ? options : {};
  if (!selectedElementId) {
    return { ok: false, status: "no_selection", message: getEditorStatusMessage("no_selection"), selectedElementId: null, selectedElementName: null, availableOperations: [], lockedOperations: [], allowedOperations: [], operationState: null };
  }
  if (!hasFunction(editorCore, "getElementDetails") || !hasFunction(editorCore, "getElementOperations")) {
    throw new TypeError("Selection-ViewModel erwartet einen Editor-Core mit Elementdetails und Operationen.");
  }
  const element = editorCore.getElementDetails(selectedElementId);
  if (element === null) {
    return { ok: false, status: "unknown_element", message: getEditorStatusMessage("unknown_element"), selectedElementId, selectedElementName: null, availableOperations: [], lockedOperations: [], allowedOperations: [], operationState: null };
  }
  if (!elementMatchesScope(element, safeOptions.scope)) {
    return { ok: false, status: "wrong_scope", message: getEditorStatusMessage("wrong_scope"), selectedElementId, selectedElementName: element.name || null, availableOperations: [], lockedOperations: [], allowedOperations: [], operationState: null };
  }
  const operations = editorCore.getElementOperations(selectedElementId) || {};
  const allowedOperations = list(operations.allowedOps);
  const lockedOperations = list(operations.lockedOps);
  const availableOperations = list(operations.availableOps);
  const operationState = getOperationState(allowedOperations, lockedOperations, safeOptions.operation);
  return {
    ok: operationState === null || operationState === "available",
    status: operationState || "selected",
    message: operationState ? getEditorStatusMessage(operationState) : "Element ist ausgewaehlt.",
    selectedElementId,
    selectedElementName: element.name || null,
    element: cloneValue(element),
    availableOperations,
    lockedOperations,
    allowedOperations,
    operationState,
  };
}

function clearEditorSelectionForScopeChange(previousSelection, nextScope) {
  return { ok: true, status: "scope_changed", message: "Scope-Wechsel hat die Auswahl geleert.", previousSelectedElementId: previousSelection || null, selectedElementId: null, uiScope: nextScope && nextScope.uiScope || null, layoutScope: nextScope && nextScope.layoutScope || null };
}

module.exports = { createEditorSelectionViewModel, clearEditorSelectionForScopeChange };

},
13:function(module,exports,__require){
"use strict";

const { getEditorStatusMessage } = __require(10);

function isObject(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function hasFunction(source, name) { return isObject(source) && typeof source[name] === "function"; }
function manifestAllows(manifest, key) { return isObject(manifest) && manifest[key] === true; }
function hostAllows(hostAdapter, key) { return hasFunction(hostAdapter, key); }

const CONTROL_DEFS = Object.freeze({
  save: Object.freeze({ manifestKey: "saveLayoutState", hostKey: "saveLayoutState", available: "save_available", blocked: "save_blocked" }),
  load: Object.freeze({ manifestKey: "loadLayoutState", hostKey: "loadLayoutState", available: "load_available", blocked: "load_blocked" }),
  reset: Object.freeze({ manifestKey: "resetLayoutState", hostKey: "resetLayoutState", available: "reset_available", blocked: "reset_blocked" }),
});
const BLOCKING_LAYOUT_STATUSES = Object.freeze([
  "invalid_layout_state",
  "unsupported_layout_schema_version",
  "layout_profile_not_found",
  "layout_state_unavailable",
]);

function createControlState(action, hostAdapter, manifest, layoutStateAvailable, blockStatus) {
  const def = CONTROL_DEFS[action];
  if (blockStatus) return { action, status: blockStatus, available: false, message: getEditorStatusMessage(blockStatus) };
  if (!layoutStateAvailable) return { action, status: "layout_state_unavailable", available: false, message: getEditorStatusMessage("layout_state_unavailable") };
  const available = Boolean(def && manifestAllows(manifest, def.manifestKey) && hostAllows(hostAdapter, def.hostKey));
  return { action, status: available ? def.available : def.blocked, available, message: available ? `${action} ist fuer Layout-State verfuegbar.` : `${action} ist fuer Layout-State blockiert.` };
}
function resolveBlockStatus(values) {
  if (BLOCKING_LAYOUT_STATUSES.includes(values.status)) return values.status;
  if (values.validation && values.validation.ok === false && Array.isArray(values.validation.errors) && values.validation.errors.length > 0) {
    const code = values.validation.errors[0].code;
    return BLOCKING_LAYOUT_STATUSES.includes(code) ? code : "invalid_layout_state";
  }
  return null;
}
function createEditorLayoutControlViewModel(values) {
  const safeValues = isObject(values) ? values : {};
  const hostAdapter = safeValues.hostAdapter || null;
  const manifest = safeValues.manifest || null;
  const blockStatus = resolveBlockStatus(safeValues);
  const layoutStateAvailable = safeValues.layoutStateAvailable !== false && (safeValues.layoutState !== undefined || hasFunction(hostAdapter, "getCurrentLayoutState"));
  const controls = {
    save: createControlState("save", hostAdapter, manifest, layoutStateAvailable, blockStatus),
    load: createControlState("load", hostAdapter, manifest, layoutStateAvailable, blockStatus),
    reset: createControlState("reset", hostAdapter, manifest, layoutStateAvailable, blockStatus),
  };
  return { ok: !blockStatus && layoutStateAvailable, status: blockStatus || (layoutStateAvailable ? "layout_controls_ready" : "layout_state_unavailable"), controls };
}
function createEditorLayoutControlResultViewModel(result) {
  const safeResult = isObject(result) ? result : {};
  if (safeResult.ok === false || safeResult.accepted === false) {
    const status = BLOCKING_LAYOUT_STATUSES.includes(safeResult.status) ? safeResult.status : "target_rejected_change";
    return { ok: false, status, message: getEditorStatusMessage(status) };
  }
  return { ok: true, status: "layout_control_accepted", message: "Layout-Control-Status wurde akzeptiert." };
}
module.exports = { createEditorLayoutControlViewModel, createEditorLayoutControlResultViewModel };

},
14:function(module,exports,__require){
"use strict";

const {
  validateLayoutState,
  normalizeLayoutState,
  getLayoutStateProfileKey,
  assertCompatibleLayoutProfile,
} = __require(15);

const LAYOUT_STATE_SELECTOR_FIELDS = Object.freeze([
  "targetAppId",
  "uiScope",
  "layoutScope",
  "layoutProfileId",
]);

function isPlainObject(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function clone(value) { return normalizeLayoutState(value); }
function resultError(code, message, details) { return { ok: false, status: code, errors: [{ code, message, ...(details || {}) }] }; }
function normalizeSelector(selector) {
  if (!isPlainObject(selector)) return null;
  const unknown = Object.keys(selector).find((fieldName) => !LAYOUT_STATE_SELECTOR_FIELDS.includes(fieldName));
  if (unknown) return { error: resultError("invalid_layout_state", `Selector-Feld ist nicht erlaubt: ${unknown}`, { field: unknown }) };
  const missing = LAYOUT_STATE_SELECTOR_FIELDS.find((fieldName) => typeof selector[fieldName] !== "string" || selector[fieldName].trim() === "");
  if (missing) return { error: resultError("invalid_layout_state", `Selector-Feld fehlt: ${missing}`, { field: missing }) };
  return LAYOUT_STATE_SELECTOR_FIELDS.reduce((entry, fieldName) => { entry[fieldName] = selector[fieldName]; return entry; }, {});
}
function createMemoryLayoutStateStore(options) {
  const safeOptions = isPlainObject(options) ? options : {};
  const validationOptions = { allowedPayloadFields: safeOptions.allowedPayloadFields || [] };
  const records = new Map();
  function saveLayoutState(layoutState) {
    const validation = validateLayoutState(layoutState, validationOptions);
    if (!validation.ok) return { ok: false, status: validation.errors[0].code, errors: validation.errors };
    const normalized = normalizeLayoutState(layoutState);
    const key = getLayoutStateProfileKey(normalized);
    records.set(key, clone(normalized));
    return { ok: true, status: "layout_state_saved", layoutState: clone(normalized) };
  }
  function loadLayoutState(selector) {
    const normalizedSelector = normalizeSelector(selector);
    if (!normalizedSelector || normalizedSelector.error) return normalizedSelector ? normalizedSelector.error : resultError("invalid_layout_state", "Selector muss ein Objekt sein.");
    const key = getLayoutStateProfileKey(normalizedSelector);
    if (!records.has(key)) return resultError("layout_profile_not_found", "Layout-Profil wurde nicht gefunden.");
    const layoutState = records.get(key);
    const compatible = assertCompatibleLayoutProfile(layoutState, normalizedSelector);
    if (!compatible.ok) return { ok: false, status: "incompatible_layout_profile", errors: compatible.errors };
    return { ok: true, status: "layout_state_loaded", layoutState: clone(layoutState) };
  }
  function resetLayoutState(selector) {
    const normalizedSelector = normalizeSelector(selector);
    if (!normalizedSelector || normalizedSelector.error) return normalizedSelector ? normalizedSelector.error : resultError("invalid_layout_state", "Selector muss ein Objekt sein.");
    const key = getLayoutStateProfileKey(normalizedSelector);
    if (!records.has(key)) return resultError("layout_profile_not_found", "Layout-Profil wurde nicht gefunden.");
    records.delete(key);
    return { ok: true, status: "layout_state_reset", reset: "removed" };
  }
  function listLayoutProfiles(selector) {
    const partial = isPlainObject(selector) ? selector : {};
    const unknown = Object.keys(partial).find((fieldName) => !LAYOUT_STATE_SELECTOR_FIELDS.includes(fieldName));
    if (unknown) return { ok: false, status: "invalid_layout_state", errors: [{ code: "invalid_layout_state", field: unknown, message: `Selector-Feld ist nicht erlaubt: ${unknown}` }] };
    const profiles = Array.from(records.values())
      .filter((state) => Object.keys(partial).every((fieldName) => state[fieldName] === partial[fieldName]))
      .map((state) => LAYOUT_STATE_SELECTOR_FIELDS.reduce((entry, fieldName) => { entry[fieldName] = state[fieldName]; return entry; }, {}));
    return { ok: true, status: "layout_profiles_listed", profiles };
  }
  return { saveLayoutState, loadLayoutState, resetLayoutState, listLayoutProfiles };
}
module.exports = { LAYOUT_STATE_SELECTOR_FIELDS, createMemoryLayoutStateStore };

},
15:function(module,exports,__require){
"use strict";

const {
  ALLOWED_LAYOUT_PAYLOAD_FIELDS,
  CONDITIONAL_LAYOUT_PAYLOAD_FIELDS,
} = __require(16);
const { getForbiddenChangeRequestFields } = __require(17);

const SUPPORTED_LAYOUT_SCHEMA_VERSION = 1;
const LAYOUT_STATE_REQUIRED_FIELDS = Object.freeze([
  "schemaVersion",
  "targetAppId",
  "uiScope",
  "layoutScope",
  "layoutProfileId",
]);
const LAYOUT_STATE_OPTIONAL_FIELDS = Object.freeze([
  "elements",
  "changes",
  "layoutValues",
  "createdAt",
  "updatedAt",
  "source",
  "version",
  "revision",
]);
const LAYOUT_STATE_FIELDS = Object.freeze([...LAYOUT_STATE_REQUIRED_FIELDS, ...LAYOUT_STATE_OPTIONAL_FIELDS]);
const LAYOUT_STATE_SOURCES = Object.freeze(["default", "saved", "reset"]);
const LAYOUT_STATE_ERROR_CODES = Object.freeze([
  "invalid_layout_state",
  "unsupported_layout_schema_version",
  "incompatible_layout_profile",
  "layout_profile_not_found",
  "layout_state_unavailable",
  "layout_reset_unavailable",
  "target_rejected_change",
]);
const LAYOUT_CONTAINER_FIELDS = Object.freeze(["elements", "changes", "layoutValues"]);
const FORBIDDEN_LAYOUT_STATE_FIELDS = Object.freeze([
  ...getForbiddenChangeRequestFields(),
  "businessData",
  "domainData",
  "recordId",
  "entityId",
  "customerId",
  "projectId",
  "domainStatus",
  "action",
  "actions",
  "payload",
  "filePath",
  "upload",
  "import",
  "export",
  "scanDom",
  "autoRegister",
]);

function hasOwn(source, key) {
  return Boolean(source) && Object.prototype.hasOwnProperty.call(source, key);
}
function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (isPlainObject(value)) {
    const clone = {};
    Object.keys(value).forEach((key) => { clone[key] = cloneValue(value[key]); });
    return clone;
  }
  return value;
}
function createResult(errors) {
  return { ok: errors.length === 0, errors };
}
function createError(code, message, details) {
  return { code, message, ...(details || {}) };
}
function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}
function findForbiddenFields(value, pathPrefix) {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => findForbiddenFields(entry, `${pathPrefix}[${index}]`));
  }
  if (!isPlainObject(value)) return [];
  return Object.keys(value).flatMap((key) => {
    const fieldPath = pathPrefix ? `${pathPrefix}.${key}` : key;
    const nested = findForbiddenFields(value[key], fieldPath);
    return FORBIDDEN_LAYOUT_STATE_FIELDS.includes(key) ? [fieldPath, ...nested] : nested;
  });
}
function validateNeutralLayoutValue(value, pathPrefix, errors, allowedConditionalFields) {
  if (!isPlainObject(value)) {
    errors.push(createError("invalid_layout_state", "Layoutwert muss ein Objekt sein.", { field: pathPrefix }));
    return;
  }
  Object.keys(value).forEach((fieldName) => {
    const fieldPath = pathPrefix ? `${pathPrefix}.${fieldName}` : fieldName;
    if (!ALLOWED_LAYOUT_PAYLOAD_FIELDS.includes(fieldName)) {
      errors.push(createError("invalid_layout_state", `Layoutwert ist nicht erlaubt: ${fieldName}`, { field: fieldPath }));
      return;
    }
    if (CONDITIONAL_LAYOUT_PAYLOAD_FIELDS.includes(fieldName) && !allowedConditionalFields.includes(fieldName)) {
      errors.push(createError("invalid_layout_state", `Layoutwert braucht eine ausdrueckliche Freigabe: ${fieldName}`, { field: fieldPath }));
    }
  });
}
function validateLayoutState(layoutState, options) {
  const errors = [];
  const safeOptions = isPlainObject(options) ? options : {};
  const allowedConditionalFields = Array.isArray(safeOptions.allowedPayloadFields) ? safeOptions.allowedPayloadFields : [];
  if (!isPlainObject(layoutState)) {
    return createResult([createError("invalid_layout_state", "LayoutState muss ein Objekt sein.")]);
  }
  Object.keys(layoutState).forEach((fieldName) => {
    if (!LAYOUT_STATE_FIELDS.includes(fieldName)) {
      errors.push(createError("invalid_layout_state", `LayoutState-Feld ist nicht erlaubt: ${fieldName}`, { field: fieldName }));
    }
  });
  LAYOUT_STATE_REQUIRED_FIELDS.forEach((fieldName) => {
    if (!hasOwn(layoutState, fieldName)) errors.push(createError("invalid_layout_state", `Pflichtfeld fehlt: ${fieldName}`, { field: fieldName }));
  });
  if (!hasOwn(layoutState, "schemaVersion")) {
    errors.push(createError("unsupported_layout_schema_version", "schemaVersion fehlt.", { field: "schemaVersion" }));
  } else if (layoutState.schemaVersion !== SUPPORTED_LAYOUT_SCHEMA_VERSION) {
    errors.push(createError("unsupported_layout_schema_version", "schemaVersion wird nicht unterstuetzt.", { field: "schemaVersion" }));
  }
  ["targetAppId", "uiScope", "layoutScope", "layoutProfileId"].forEach((fieldName) => {
    if (hasOwn(layoutState, fieldName) && !isNonEmptyString(layoutState[fieldName])) {
      errors.push(createError("invalid_layout_state", `Feld muss ein nicht-leerer String sein: ${fieldName}`, { field: fieldName }));
    }
  });
  if (!hasOwn(layoutState, "version") && !hasOwn(layoutState, "revision")) {
    errors.push(createError("invalid_layout_state", "version oder revision fehlt.", { field: "version" }));
  }
  ["version", "revision"].forEach((fieldName) => {
    if (hasOwn(layoutState, fieldName) && (!Number.isInteger(layoutState[fieldName]) || layoutState[fieldName] < 1)) {
      errors.push(createError("invalid_layout_state", `Feld muss eine positive Ganzzahl sein: ${fieldName}`, { field: fieldName }));
    }
  });
  if (hasOwn(layoutState, "source") && !LAYOUT_STATE_SOURCES.includes(layoutState.source)) {
    errors.push(createError("invalid_layout_state", "source ist nicht erlaubt.", { field: "source" }));
  }
  findForbiddenFields(layoutState, "").forEach((field) => {
    errors.push(createError("invalid_layout_state", `Verbotenes LayoutState-Feld vorhanden: ${field}`, { field }));
  });
  ["elements", "layoutValues"].forEach((containerName) => {
    if (!hasOwn(layoutState, containerName)) return;
    if (!isPlainObject(layoutState[containerName])) {
      errors.push(createError("invalid_layout_state", `${containerName} muss ein Objekt sein.`, { field: containerName }));
      return;
    }
    Object.keys(layoutState[containerName]).forEach((entryKey) => {
      validateNeutralLayoutValue(layoutState[containerName][entryKey], `${containerName}.${entryKey}`, errors, allowedConditionalFields);
    });
  });
  if (hasOwn(layoutState, "changes")) {
    if (!Array.isArray(layoutState.changes)) {
      errors.push(createError("invalid_layout_state", "changes muss eine Liste sein.", { field: "changes" }));
    } else {
      layoutState.changes.forEach((change, index) => validateNeutralLayoutValue(change, `changes[${index}]`, errors, allowedConditionalFields));
    }
  }
  return createResult(errors);
}
function normalizeLayoutState(layoutState) {
  if (!isPlainObject(layoutState)) return {};
  const normalized = {};
  LAYOUT_STATE_FIELDS.forEach((fieldName) => {
    if (hasOwn(layoutState, fieldName)) normalized[fieldName] = cloneValue(layoutState[fieldName]);
  });
  return normalized;
}
function createLayoutState(values) {
  return normalizeLayoutState(values);
}
function getLayoutStateProfileKey(values) {
  if (!isPlainObject(values)) return "";
  return [values.targetAppId, values.uiScope, values.layoutScope, values.layoutProfileId].join("\u001f");
}
function assertCompatibleLayoutProfile(layoutState, selector) {
  const errors = [];
  ["targetAppId", "uiScope", "layoutScope", "layoutProfileId"].forEach((fieldName) => {
    if (hasOwn(selector, fieldName) && layoutState[fieldName] !== selector[fieldName]) {
      errors.push(createError("incompatible_layout_profile", `Layout-Profil passt nicht zu ${fieldName}.`, { field: fieldName }));
    }
  });
  return createResult(errors);
}
module.exports = {
  SUPPORTED_LAYOUT_SCHEMA_VERSION,
  LAYOUT_STATE_REQUIRED_FIELDS,
  LAYOUT_STATE_OPTIONAL_FIELDS,
  LAYOUT_STATE_FIELDS,
  LAYOUT_STATE_SOURCES,
  LAYOUT_STATE_ERROR_CODES,
  LAYOUT_CONTAINER_FIELDS,
  FORBIDDEN_LAYOUT_STATE_FIELDS,
  validateLayoutState,
  normalizeLayoutState,
  createLayoutState,
  getLayoutStateProfileKey,
  assertCompatibleLayoutProfile,
};

},
16:function(module,exports,__require){
"use strict";

const {
  CHANGE_REQUEST_REQUIRED_FIELDS,
  getForbiddenChangeRequestFields,
} = __require(17);

const ALLOWED_LAYOUT_PAYLOAD_FIELDS = Object.freeze([
  "x",
  "y",
  "width",
  "height",
  "spacing",
  "order",
  "visibility",
  "visible",
  "label",
]);

const CONDITIONAL_LAYOUT_PAYLOAD_FIELDS = Object.freeze(["visibility", "visible", "label"]);

function isPlainRequestObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(source, key) {
  return Boolean(source) && Object.prototype.hasOwnProperty.call(source, key);
}

function createResult(errors) {
  return {
    ok: errors.length === 0,
    errors,
  };
}

function createError(changeRequest, code, message, details) {
  const error = {
    code,
    message,
    ...(details || {}),
  };

  if (isPlainRequestObject(changeRequest)) {
    if (hasOwn(changeRequest, "changeId") && !hasOwn(error, "changeId")) {
      error.changeId = changeRequest.changeId;
    }

    if (hasOwn(changeRequest, "elementId") && !hasOwn(error, "elementId")) {
      error.elementId = changeRequest.elementId;
    }
  }

  return error;
}


function findForbiddenFields(value, pathPrefix) {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => findForbiddenFields(entry, `${pathPrefix}[${index}]`));
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  const forbiddenFields = getForbiddenChangeRequestFields();
  return Object.keys(value).flatMap((key) => {
    const fieldPath = pathPrefix ? `${pathPrefix}.${key}` : key;
    const nested = findForbiddenFields(value[key], fieldPath);

    if (forbiddenFields.includes(key)) {
      return [fieldPath, ...nested];
    }

    return nested;
  });
}

function validatePayloadFields(changeRequest, errors) {
  if (!hasOwn(changeRequest, "payload") || !isPlainRequestObject(changeRequest.payload)) {
    return;
  }

  Object.keys(changeRequest.payload).forEach((fieldName) => {
    if (!ALLOWED_LAYOUT_PAYLOAD_FIELDS.includes(fieldName)) {
      errors.push(createError(changeRequest, "invalid_payload", `payload enthaelt keinen neutralen Layoutwert: ${fieldName}`, {
        field: `payload.${fieldName}`,
      }));
      return;
    }

    if (CONDITIONAL_LAYOUT_PAYLOAD_FIELDS.includes(fieldName)) {
      const allowedPayloadFields = Array.isArray(changeRequest.allowedPayloadFields)
        ? changeRequest.allowedPayloadFields
        : [];
      if (!allowedPayloadFields.includes(fieldName)) {
        errors.push(createError(changeRequest, "forbidden_field", `payload.${fieldName} braucht eine ausdrueckliche Ziel-App-Freigabe.`, {
          field: `payload.${fieldName}`,
        }));
      }
    }
  });
}

function validateChangeRequestShape(changeRequest) {
  const errors = [];

  if (!isPlainRequestObject(changeRequest)) {
    errors.push({
      code: "invalid_change_request",
      message: "Aenderungsauftrag muss ein Objekt sein.",
    });
    return createResult(errors);
  }

  CHANGE_REQUEST_REQUIRED_FIELDS.forEach((fieldName) => {
    if (!hasOwn(changeRequest, fieldName)) {
      errors.push(createError(changeRequest, "missing_required_field", `Pflichtfeld fehlt: ${fieldName}`, {
        field: fieldName,
      }));
    }
  });

  if (hasOwn(changeRequest, "payload")) {
    const payload = changeRequest.payload;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      errors.push(createError(changeRequest, "invalid_payload", "payload muss ein Objekt sein.", {
        field: "payload",
      }));
    }
  }

  findForbiddenFields(changeRequest, "").forEach((fieldName) => {
    errors.push(createError(changeRequest, "forbidden_field", `Verbotenes Feld vorhanden: ${fieldName}`, {
      field: fieldName,
    }));
  });

  validatePayloadFields(changeRequest, errors);

  return createResult(errors);
}

function validateEditorCore(editorCore) {
  const errors = [];

  if (!editorCore || typeof editorCore !== "object") {
    errors.push({
      code: "invalid_editor_core",
      message: "Editor-Core muss vorhanden sein.",
    });
    return createResult(errors);
  }

  ["hasElement", "canElementPerformOperation", "getElementDetails"].forEach((methodName) => {
    if (typeof editorCore[methodName] !== "function") {
      errors.push({
        code: "invalid_editor_core",
        field: methodName,
        message: `Editor-Core muss ${methodName}() bereitstellen.`,
      });
    }
  });

  return createResult(errors);
}

function isOperationLocked(elementDetails, operation) {
  return Boolean(
    elementDetails &&
      Array.isArray(elementDetails.lockedOps) &&
      elementDetails.lockedOps.includes(operation)
  );
}

function validateChangeRequest(changeRequest, editorCore) {
  const errors = [];
  const shapeResult = validateChangeRequestShape(changeRequest);
  errors.push(...shapeResult.errors);

  const editorCoreResult = validateEditorCore(editorCore);
  errors.push(...editorCoreResult.errors);

  if (!shapeResult.ok || !editorCoreResult.ok) {
    return createResult(errors);
  }

  const elementId = changeRequest.elementId;
  const operation = changeRequest.operation;
  const elementExists = editorCore.hasElement(elementId);

  if (!elementExists) {
    errors.push(createError(changeRequest, "unknown_element", `Unbekanntes Element: ${elementId}`));
    return createResult(errors);
  }

  const elementDetails = editorCore.getElementDetails(elementId);
  const operationAllowed = editorCore.canElementPerformOperation(elementId, operation);

  if (!operationAllowed) {
    const locked = isOperationLocked(elementDetails, operation);
    errors.push(createError(
      changeRequest,
      locked ? "operation_locked" : "operation_not_allowed",
      locked
        ? `Operation ist fuer dieses Element gesperrt: ${operation}`
        : `Operation ist fuer dieses Element nicht erlaubt: ${operation}`,
      { field: "operation" }
    ));
  }

  return createResult(errors);
}

module.exports = {
  ALLOWED_LAYOUT_PAYLOAD_FIELDS,
  CONDITIONAL_LAYOUT_PAYLOAD_FIELDS,
  validateChangeRequest,
  validateChangeRequestShape,
};

},
17:function(module,exports,__require){
"use strict";

const CHANGE_REQUEST_REQUIRED_FIELDS = Object.freeze([
  "changeId",
  "elementId",
  "operation",
  "payload",
  "createdAt",
  "source",
]);

const CHANGE_REQUEST_OPTIONAL_FIELDS = Object.freeze([
  "note",
  "reason",
  "scope",
  "requestedBy",
]);

const CHANGE_REQUEST_FIELDS = Object.freeze([
  ...CHANGE_REQUEST_REQUIRED_FIELDS,
  ...CHANGE_REQUEST_OPTIONAL_FIELDS,
]);

const FORBIDDEN_CHANGE_REQUEST_FIELDS = Object.freeze([
  "fachDaten",
  "businessData",
  "database",
  "sql",
  "recordId",
  "entity",
  "tableName",
  "save",
  "delete",
  "submit",
  "upload",
]);

function hasOwn(source, key) {
  return Boolean(source) && Object.prototype.hasOwnProperty.call(source, key);
}

function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneValue(entry));
  }

  if (value && typeof value === "object") {
    const clone = {};
    Object.keys(value).forEach((key) => {
      if (FORBIDDEN_CHANGE_REQUEST_FIELDS.includes(key)) {
        return;
      }

      clone[key] = cloneValue(value[key]);
    });
    return clone;
  }

  return value;
}

function normalizeChangeRequest(values) {
  if (!values || typeof values !== "object" || Array.isArray(values)) {
    return {};
  }

  const normalized = {};

  CHANGE_REQUEST_FIELDS.forEach((fieldName) => {
    if (!hasOwn(values, fieldName)) {
      return;
    }

    normalized[fieldName] = cloneValue(values[fieldName]);
  });

  return normalized;
}

function createChangeRequest(values) {
  return normalizeChangeRequest(values);
}

function getChangeRequestFields() {
  return {
    required: CHANGE_REQUEST_REQUIRED_FIELDS.slice(),
    optional: CHANGE_REQUEST_OPTIONAL_FIELDS.slice(),
  };
}

function getForbiddenChangeRequestFields() {
  return FORBIDDEN_CHANGE_REQUEST_FIELDS.slice();
}

module.exports = {
  CHANGE_REQUEST_REQUIRED_FIELDS,
  CHANGE_REQUEST_OPTIONAL_FIELDS,
  CHANGE_REQUEST_FIELDS,
  FORBIDDEN_CHANGE_REQUEST_FIELDS,
  normalizeChangeRequest,
  createChangeRequest,
  getChangeRequestFields,
  getForbiddenChangeRequestFields,
};

},
18:function(module,exports,__require){
"use strict";

const SELECTION_CONTRACT_VERSION = "selection-target-contract-v1.0";

const SelectionContractErrorCodes = Object.freeze({
  INVALID_TARGET_LIST: "invalid_target_list",
  INVALID_ELEMENT_ID: "invalid_element_id",
  DUPLICATE_ELEMENT_ID: "duplicate_element_id",
  INLINE_ELEMENT_REF_NOT_ALLOWED: "inline_element_ref_not_allowed",
  INVALID_ELEMENT_REF_RESOLVER: "invalid_element_ref_resolver",
  INVALID_ELEMENT_REF: "invalid_element_ref",
  INVALID_SELECTABLE_VALUE: "invalid_selectable_value",
  INVALID_HOST: "invalid_selection_host",
  MISSING_HOST_METHOD: "missing_selection_host_method",
  INVALID_HOST_CALLBACK: "invalid_selection_host_callback",
  INVALID_CONTROLLER: "invalid_selection_controller",
  MISSING_CONTROLLER_METHOD: "missing_selection_controller_method",
  INVALID_SELECTED_ELEMENT_ID: "invalid_selected_element_id",
});

function createResult(errors, details) {
  return Object.freeze({ ok: errors.length === 0, errors, ...(details || {}) });
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function isHTMLElementLike(value) {
  if (!value || typeof value !== "object") return false;
  const GlobalHTMLElement = typeof HTMLElement === "function" ? HTMLElement : null;
  if (GlobalHTMLElement && value instanceof GlobalHTMLElement) return true;
  return value.nodeType === 1 && typeof value.getBoundingClientRect === "function" && typeof value.contains === "function";
}

function validateElementRefResolver(resolver, elementIds) {
  const errors = [];
  const unavailableElementIds = [];
  const boundElementIds = [];

  if (typeof resolver !== "function") {
    errors.push({ code: SelectionContractErrorCodes.INVALID_ELEMENT_REF_RESOLVER, message: "ElementRefResolver muss eine Funktion sein." });
    return createResult(errors, { boundTargetCount: 0, unavailableElementIds });
  }

  (Array.isArray(elementIds) ? elementIds : []).forEach((elementId) => {
    let ref;
    try {
      ref = resolver(elementId);
    } catch (cause) {
      errors.push({ code: SelectionContractErrorCodes.INVALID_ELEMENT_REF, elementId, message: "ElementRefResolver darf fuer ein Ziel nicht werfen.", cause });
      unavailableElementIds.push(elementId);
      return;
    }

    if (ref == null) {
      unavailableElementIds.push(elementId);
      return;
    }

    if (!isHTMLElementLike(ref)) {
      errors.push({ code: SelectionContractErrorCodes.INVALID_ELEMENT_REF, elementId, message: "ElementRefResolver muss HTMLElement oder null liefern." });
      return;
    }

    boundElementIds.push(elementId);
  });

  return createResult(errors, { boundTargetCount: boundElementIds.length, unavailableElementIds, boundElementIds });
}

function normalizeSelectionTargetMeta(target) {
  if (!isObject(target)) return null;
  return Object.freeze({
    elementId: typeof target.elementId === "string" ? target.elementId.trim() : target.elementId,
    ...(target.label === undefined ? {} : { label: target.label }),
    ...(target.parentId === undefined ? {} : { parentId: target.parentId }),
    selectable: target.selectable === undefined ? true : target.selectable,
    ...(target.metadata === undefined ? {} : { metadata: target.metadata }),
  });
}

function validateSelectionTargetContract(input) {
  const errors = [];
  const targets = Array.isArray(input) ? input : input && input.targets;
  const resolver = input && input.getElementRef;

  if (!Array.isArray(targets)) {
    errors.push({ code: SelectionContractErrorCodes.INVALID_TARGET_LIST, message: "Selection-Targets muessen als Array uebergeben werden." });
    return createResult(errors, { normalizedTargets: [], boundTargetCount: 0, unavailableElementIds: [] });
  }

  const seen = new Set();
  const normalizedTargets = [];

  targets.forEach((target, index) => {
    if (!isObject(target)) {
      errors.push({ code: SelectionContractErrorCodes.INVALID_TARGET_LIST, index, message: "Selection-Target muss ein Objekt sein." });
      return;
    }

    if (Object.prototype.hasOwnProperty.call(target, "elementRef")) {
      errors.push({ code: SelectionContractErrorCodes.INLINE_ELEMENT_REF_NOT_ALLOWED, index, message: "HTMLElement-Referenzen gehoeren in den ElementRefResolver, nicht in Registry-Metadaten." });
    }

    const normalized = normalizeSelectionTargetMeta(target);
    if (!isNonEmptyString(normalized.elementId)) {
      errors.push({ code: SelectionContractErrorCodes.INVALID_ELEMENT_ID, index, message: "elementId muss eine nicht leere Zeichenkette sein." });
      return;
    }

    if (seen.has(normalized.elementId)) {
      errors.push({ code: SelectionContractErrorCodes.DUPLICATE_ELEMENT_ID, elementId: normalized.elementId, message: "elementId muss eindeutig sein." });
    }
    seen.add(normalized.elementId);

    if (typeof normalized.selectable !== "boolean") {
      errors.push({ code: SelectionContractErrorCodes.INVALID_SELECTABLE_VALUE, elementId: normalized.elementId, message: "selectable muss boolean sein, falls gesetzt." });
    }

    normalizedTargets.push(normalized);
  });

  const elementIds = normalizedTargets.map((target) => target.elementId);
  const resolverResult = resolver === undefined
    ? createResult([], { boundTargetCount: 0, unavailableElementIds: elementIds.slice(), boundElementIds: [] })
    : validateElementRefResolver(resolver, elementIds);

  return createResult(errors.concat(resolverResult.errors), {
    normalizedTargets,
    boundTargetCount: resolverResult.boundTargetCount,
    unavailableElementIds: resolverResult.unavailableElementIds,
    boundElementIds: resolverResult.boundElementIds || [],
  });
}

module.exports = {
  SELECTION_CONTRACT_VERSION,
  SelectionContractErrorCodes,
  validateSelectionTargetContract,
  validateElementRefResolver,
  normalizeSelectionTargetMeta,
};

},
19:function(module,exports,__require){
"use strict";

const { validateSelectionHost, createSelectionStateSnapshot } = __require(20);
const { resolveSelectionTarget, isElementLike } = __require(21);
const { createHoverOverlay } = __require(22);
const { createSelectedOverlay } = __require(24);

const SelectionRuntimeErrorCodes = Object.freeze({ INVALID_HOST: "invalid_host", LISTENER_SOURCE_MISSING: "listener_source_missing", RESOLVER_FAILED: "resolver_failed", SELECTION_FAILED: "selection_failed", SYNC_FAILED: "sync_failed", OVERLAY_FAILED: "overlay_failed", DESTROYED: "destroyed" });

function safeCall(callback, payload) {
  if (typeof callback !== "function") return;
  try {
    callback(payload);
  } catch (_error) {
    // Externe Beobachter duerfen die Runtime nicht abbrechen und werden nicht erneut gemeldet.
  }
}

function report(options, host, error) {
  safeCall(options && options.onError, error);
  safeCall(host && host.onError, error);
  safeCall(host && host.onStateChange, { error });
}
function makeError(code, message, cause) { const error = new Error(message); error.code = code; if (cause) error.cause = cause; return error; }
function normalizeId(value) { return typeof value === "string" && value.trim() !== "" ? value.trim() : null; }

function createSelectionController(options = {}) {
  const host = options.host;
  const validation = validateSelectionHost(host);
  if (!validation.ok) throw makeError(SelectionRuntimeErrorCodes.INVALID_HOST, `Ungueltiger SelectionHost: ${validation.errors.map((e) => e.message).join(" ")}`);

  const hoverOverlay = options.hoverOverlay || createHoverOverlay(options.overlayOptions && options.overlayOptions.hover);
  const selectedOverlay = options.selectedOverlay || createSelectedOverlay(options.overlayOptions && options.overlayOptions.selected);
  let active = false, destroyed = false, hoveredElementId = null, lastEventTarget = null, selectedElementId = null;
  let boundTargetCount = 0, unavailableElementIds = [];
  const listeners = [];

  function emitState(extra) { safeCall(host.onStateChange, Object.assign({}, getState(), extra || {})); }
  function getTargets() {
    const raw = typeof host.listSelectableTargets === "function" ? host.listSelectableTargets() : host.listSelectableElementIds().map((elementId) => ({ elementId }));
    return Array.isArray(raw) ? raw.map((target) => typeof target === "string" ? { elementId: target } : target).filter(Boolean) : [];
  }
  function getRef(id) { return host.getElementRef(id); }
  function scanBindings(targets) {
    boundTargetCount = 0; unavailableElementIds = [];
    targets.forEach((target) => { const id = target && target.elementId; if (!id) return; let ref; try { ref = getRef(id); } catch (_e) { ref = null; } if (isElementLike(ref)) boundTargetCount += 1; else unavailableElementIds.push(id); });
  }
  function readSelected() { try { return normalizeId(host.getSelectedElementId()); } catch (cause) { const e = makeError(SelectionRuntimeErrorCodes.SYNC_FAILED, "getSelectedElementId() ist fehlgeschlagen.", cause); report(options, host, e); return null; } }
  function findTarget(id, targets) { return targets.find((target) => target.elementId === id) || (id ? { elementId: id } : null); }
  function clearHover() { hoveredElementId = null; try { hoverOverlay.clear(); } catch (cause) { report(options, host, makeError(SelectionRuntimeErrorCodes.OVERLAY_FAILED, "HoverOverlay konnte nicht bereinigt werden.", cause)); } }
  function resolve(eventTarget) {
    const targets = getTargets(); scanBindings(targets);
    return resolveSelectionTarget({ eventTarget, targets, getElementRef: getRef, isExcludedTarget: host.isExcludedTarget });
  }
  function refreshHover() {
    if (!active || !lastEventTarget) { clearHover(); return getState(); }
    try {
      if (typeof host.isExcludedTarget === "function" && host.isExcludedTarget(lastEventTarget)) { clearHover(); return getState(); }
      const match = resolve(lastEventTarget);
      selectedElementId = readSelected();
      if (!match || match.elementId === selectedElementId) { clearHover(); return getState(); }
      hoveredElementId = match.elementId;
      hoverOverlay.show({ ref: match.ref, target: match.target, document: options.document, window: options.window });
      emitState();
    } catch (cause) { clearHover(); report(options, host, makeError(SelectionRuntimeErrorCodes.RESOLVER_FAILED, "Hover-Ziel konnte nicht aufgeloest werden.", cause)); }
    return getState();
  }
  function syncWithSelection() {
    try {
      const targets = getTargets(); scanBindings(targets); selectedElementId = readSelected();
      const target = findTarget(selectedElementId, targets); const ref = selectedElementId ? getRef(selectedElementId) : null;
      if (selectedElementId && isElementLike(ref)) selectedOverlay.show({ ref, target, document: options.document, window: options.window }); else selectedOverlay.clear();
      if (hoveredElementId && hoveredElementId === selectedElementId) clearHover(); else if (lastEventTarget && active) refreshHover();
      emitState();
    } catch (cause) { selectedElementId = null; try { selectedOverlay.clear(); } catch (_e) {} report(options, host, makeError(SelectionRuntimeErrorCodes.SYNC_FAILED, "Selection-Synchronisation ist fehlgeschlagen.", cause)); }
    return getState();
  }
  function onPointerMove(event) { lastEventTarget = event && event.target; refreshHover(); }
  function onPointerLeave() { lastEventTarget = null; clearHover(); emitState(); }
  function onClick(event) {
    if (!active) return;
    lastEventTarget = event && event.target;
    let match; try { match = resolve(lastEventTarget); } catch (cause) { report(options, host, makeError(SelectionRuntimeErrorCodes.RESOLVER_FAILED, "Klick-Ziel konnte nicht aufgeloest werden.", cause)); return; }
    if (!match) return;
    event.preventDefault && event.preventDefault(); event.stopPropagation && event.stopPropagation(); event.stopImmediatePropagation && event.stopImmediatePropagation();
    Promise.resolve().then(() => host.selectElement(match.elementId)).then(() => { syncWithSelection(); if (match.elementId === readSelected()) clearHover(); if (typeof host.onSelection === "function") host.onSelection({ elementId: match.elementId, target: match.target }); }).catch((cause) => { clearHover(); report(options, host, makeError(SelectionRuntimeErrorCodes.SELECTION_FAILED, "selectElement() ist fehlgeschlagen.", cause)); });
  }
  function onKeyDown(event) { if (event && event.key === "Escape") { stop(); clearHover(); } }
  function source() { return typeof host.getInteractionRoot === "function" ? host.getInteractionRoot() : options.document; }
  function add(target, type, fn, opts) { target.addEventListener(type, fn, opts); listeners.push([target, type, fn, opts]); }
  function start() {
    if (destroyed) { report(options, host, makeError(SelectionRuntimeErrorCodes.DESTROYED, "SelectionController wurde zerstoert.")); return getState(); }
    if (active) return getState();
    const root = source(); if (!root || typeof root.addEventListener !== "function") { const e = makeError(SelectionRuntimeErrorCodes.LISTENER_SOURCE_MISSING, "Keine explizite InteractionRoot- oder Document-Eventquelle vorhanden."); report(options, host, e); return getState(); }
    active = true; add(root, "pointermove", onPointerMove); add(root, "pointerleave", onPointerLeave); add(root, "click", onClick, true); add(root, "keydown", onKeyDown);
    syncWithSelection(); emitState(); return getState();
  }
  function stop() { if (!active) return getState(); active = false; while (listeners.length) { const [t, ty, fn, o] = listeners.pop(); t.removeEventListener && t.removeEventListener(ty, fn, o); } clearHover(); emitState(); return getState(); }
  function destroy() { if (destroyed) return getState(); stop(); destroyed = true; hoverOverlay.destroy(); selectedOverlay.destroy(); return getState(); }
  function isActive() { return active; }
  function getState() { return createSelectionStateSnapshot(host, { active, hoveredElementId, boundTargetCount, unavailableElementIds }); }
  syncWithSelection();
  return { start, stop, destroy, isActive, getState, refreshHover, syncWithSelection };
}

module.exports = { createSelectionController, SelectionRuntimeErrorCodes };

},
20:function(module,exports,__require){
"use strict";

const { SelectionContractErrorCodes } = __require(18);

const SELECTION_CONTROLLER_METHODS = Object.freeze([
  "start",
  "stop",
  "destroy",
  "isActive",
  "getState",
  "refreshHover",
  "syncWithSelection",
]);

const SELECTION_HOST_REQUIRED_METHODS = Object.freeze([
  "getElementRef",
  "getSelectedElementId",
  "selectElement",
]);

function createResult(errors) {
  return Object.freeze({ ok: errors.length === 0, errors });
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateOptionalFunction(host, name, errors) {
  if (host[name] !== undefined && typeof host[name] !== "function") {
    errors.push({ code: SelectionContractErrorCodes.INVALID_HOST_CALLBACK, method: name, message: `${name} muss eine Funktion sein, falls gesetzt.` });
  }
}

function validateSelectionHost(host) {
  const errors = [];
  if (!isObject(host)) {
    return createResult([{ code: SelectionContractErrorCodes.INVALID_HOST, message: "SelectionHost muss ein Objekt sein." }]);
  }

  SELECTION_HOST_REQUIRED_METHODS.forEach((method) => {
    if (typeof host[method] !== "function") {
      errors.push({ code: SelectionContractErrorCodes.MISSING_HOST_METHOD, method, message: `SelectionHost muss ${method}() bereitstellen.` });
    }
  });

  [
    "listSelectableElementIds",
    "listSelectableTargets",
    "getElementMeta",
    "isExcludedTarget",
    "onStateChange",
    "onSelection",
    "onError",
    "getInteractionRoot",
  ].forEach((method) => validateOptionalFunction(host, method, errors));

  if (typeof host.listSelectableElementIds !== "function" && typeof host.listSelectableTargets !== "function") {
    errors.push({ code: SelectionContractErrorCodes.MISSING_HOST_METHOD, method: "listSelectableElementIds", message: "SelectionHost muss listSelectableElementIds() oder listSelectableTargets() bereitstellen." });
  }

  return createResult(errors);
}

function validateSelectionControllerContract(controller) {
  const errors = [];
  if (!isObject(controller)) {
    return createResult([{ code: SelectionContractErrorCodes.INVALID_CONTROLLER, message: "SelectionController muss ein Objekt sein." }]);
  }

  SELECTION_CONTROLLER_METHODS.forEach((method) => {
    if (typeof controller[method] !== "function") {
      errors.push({ code: SelectionContractErrorCodes.MISSING_CONTROLLER_METHOD, method, message: `SelectionController muss ${method}() bereitstellen.` });
    }
  });

  return createResult(errors);
}

function normalizeSelectedElementId(value) {
  if (value == null) {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const selectedElementId = value.trim();
  return selectedElementId === "" ? null : selectedElementId;
}

function readSelectedElementId(host) {
  if (!host || typeof host.getSelectedElementId !== "function") {
    return null;
  }

  try {
    return normalizeSelectedElementId(host.getSelectedElementId());
  } catch (_error) {
    return null;
  }
}

function createSelectionStateSnapshot(host, partialState) {
  const selectedElementId = readSelectedElementId(host);
  const state = partialState || {};
  return Object.freeze({
    active: Boolean(state.active),
    hoveredElementId: state.hoveredElementId || null,
    selectedElementId,
    boundTargetCount: Number.isFinite(state.boundTargetCount) ? state.boundTargetCount : 0,
    unavailableElementIds: Array.isArray(state.unavailableElementIds) ? state.unavailableElementIds.slice() : [],
  });
}

module.exports = {
  SELECTION_CONTROLLER_METHODS,
  SELECTION_HOST_REQUIRED_METHODS,
  validateSelectionHost,
  validateSelectionControllerContract,
  createSelectionStateSnapshot,
};

},
21:function(module,exports,__require){
"use strict";

function isElementLike(value) {
  return Boolean(value) && typeof value === "object" && value.nodeType === 1 && typeof value.contains === "function" && typeof value.getBoundingClientRect === "function";
}

function getTargetId(target) {
  return typeof target === "string" ? target : target && target.elementId;
}

function getPriority(target) {
  if (!target || typeof target === "string") return 0;
  if (Number.isFinite(target.priority)) return target.priority;
  if (target.metadata && Number.isFinite(target.metadata.priority)) return target.metadata.priority;
  return 0;
}

function getDepth(target, byId) {
  let depth = 0;
  let parentId = target && typeof target === "object" ? target.parentId : null;
  const seen = new Set();
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    depth += 1;
    const parent = byId.get(parentId);
    parentId = parent && typeof parent === "object" ? parent.parentId : null;
  }
  return depth;
}

function getArea(ref) {
  try {
    const rect = ref.getBoundingClientRect();
    const width = Math.max(0, Number(rect && rect.width) || 0);
    const height = Math.max(0, Number(rect && rect.height) || 0);
    return width * height;
  } catch (_error) {
    return Number.POSITIVE_INFINITY;
  }
}

function resolveSelectionTarget({ eventTarget, targets, getElementRef, isExcludedTarget } = {}) {
  if (!isElementLike(eventTarget) || !Array.isArray(targets) || typeof getElementRef !== "function") return null;
  if (typeof isExcludedTarget === "function" && isExcludedTarget(eventTarget)) return null;

  const byId = new Map();
  targets.forEach((target) => {
    const elementId = getTargetId(target);
    if (typeof elementId === "string" && elementId.trim() !== "") byId.set(elementId, target);
  });

  const hits = [];
  targets.forEach((target, index) => {
    const elementId = getTargetId(target);
    if (typeof elementId !== "string" || elementId.trim() === "") return;
    if (target && typeof target === "object" && target.selectable === false) return;
    let ref;
    try { ref = getElementRef(elementId); } catch (_error) { return; }
    if (!isElementLike(ref)) return;
    let hit = false;
    try { hit = ref === eventTarget || ref.contains(eventTarget); } catch (_error) { hit = false; }
    if (!hit) return;
    hits.push({ target, elementId, ref, index, priority: getPriority(target), depth: getDepth(target, byId), area: getArea(ref) });
  });

  if (hits.length === 0) return null;
  hits.sort((a, b) => (b.priority - a.priority) || (b.depth - a.depth) || (a.area - b.area) || (a.index - b.index));
  return Object.freeze({ elementId: hits[0].elementId, target: hits[0].target, ref: hits[0].ref });
}

module.exports = { resolveSelectionTarget, isElementLike };

},
22:function(module,exports,__require){
"use strict";
const { createSelectionOverlayBase } = __require(23);
function createHoverOverlay(options) { return createSelectionOverlayBase(Object.assign({ role: "hover", borderColor: "#2563eb", backgroundColor: "rgba(37, 99, 235, 0.10)", labelPrefix: "" }, options || {})); }
module.exports = { createHoverOverlay };

},
23:function(module,exports,__require){
"use strict";

const DEFAULTS = Object.freeze({ zIndex: 2147483000, borderWidth: 2, borderRadius: 4, showLabel: true, autoUpdate: true });

function defaultLabel(prefix, target) {
  const label = target && target.label ? target.label : "Element";
  const id = target && target.elementId ? target.elementId : "";
  return prefix ? `${prefix}: ${label} · ${id}` : `${label} · ${id}`;
}

function createSelectionOverlayBase(defaultOptions = {}) {
  const options = Object.assign({}, DEFAULTS, defaultOptions);
  let doc = null;
  let frame = null;
  let labelNode = null;
  let currentRef = null;
  let currentTarget = null;
  const viewportListeners = [];

  function ensure(documentRef) {
    if (frame) return;
    doc = documentRef || (currentRef && currentRef.ownerDocument);
    if (!doc || !doc.createElement || !doc.body || !doc.body.appendChild) throw new Error("SelectionOverlay benoetigt ein Document mit body.");
    frame = doc.createElement("div");
    frame.setAttribute("data-selection-overlay", options.role || "selection");
    Object.assign(frame.style, {
      position: "fixed", pointerEvents: "none", boxSizing: "border-box", zIndex: String(options.zIndex),
      borderStyle: "solid", borderColor: options.borderColor, backgroundColor: options.backgroundColor,
      borderWidth: `${options.borderWidth}px`, borderRadius: `${options.borderRadius}px`, display: "none"
    });
    labelNode = doc.createElement("div");
    Object.assign(labelNode.style, { position: "absolute", left: "0", top: "-1.6em", font: "12px sans-serif", color: options.borderColor, background: "rgba(255,255,255,0.92)", padding: "1px 4px", borderRadius: "3px" });
    frame.appendChild(labelNode);
    doc.body.appendChild(frame);
  }

  function addViewportListener(target, type, listener, capture) {
    if (!target || typeof target.addEventListener !== "function") return;
    target.addEventListener(type, listener, capture);
    viewportListeners.push([target, type, listener, capture]);
  }

  function removeViewportListeners() {
    while (viewportListeners.length) {
      const [target, type, listener, capture] = viewportListeners.pop();
      if (target && typeof target.removeEventListener === "function") target.removeEventListener(type, listener, capture);
    }
  }

  function handleViewportChange() {
    try {
      update();
    } catch (_error) {
      clear();
    }
  }

  function ensureViewportListeners() {
    if (options.autoUpdate === false || viewportListeners.length > 0 || !doc) return;
    addViewportListener(doc, "scroll", handleViewportChange, true);
    const win = options.window || doc.defaultView;
    addViewportListener(win, "resize", handleViewportChange, false);
  }

  function update() {
    if (!frame || !currentRef) return;
    const rect = currentRef.getBoundingClientRect();
    frame.style.left = `${rect.left}px`;
    frame.style.top = `${rect.top}px`;
    frame.style.width = `${rect.width}px`;
    frame.style.height = `${rect.height}px`;
    frame.style.display = "block";
  }

  function show({ ref, target, document: documentRef, window: windowRef } = {}) {
    if (!ref || typeof ref.getBoundingClientRect !== "function") throw new Error("SelectionOverlay benoetigt eine gueltige Element-Referenz.");
    currentRef = ref;
    currentTarget = target || null;
    if (windowRef && options.window !== windowRef) options.window = windowRef;
    ensure(documentRef || ref.ownerDocument);
    if (labelNode) {
      const text = typeof options.labelFormatter === "function" ? options.labelFormatter(currentTarget) : defaultLabel(options.labelPrefix, currentTarget);
      labelNode.textContent = text;
      labelNode.style.display = options.showLabel === false ? "none" : "block";
    }
    ensureViewportListeners();
    update();
  }

  function clear() {
    currentRef = null; currentTarget = null;
    removeViewportListeners();
    if (frame) frame.style.display = "none";
  }

  function destroy() {
    clear();
    if (frame && frame.parentNode && frame.parentNode.removeChild) frame.parentNode.removeChild(frame);
    frame = null; labelNode = null; doc = null;
  }

  return { show, update, clear, destroy, isVisible: () => Boolean(frame && frame.style.display !== "none"), getElement: () => frame, getTarget: () => currentTarget };
}

module.exports = { createSelectionOverlayBase };

},
24:function(module,exports,__require){
"use strict";
const { createSelectionOverlayBase } = __require(23);
function createSelectedOverlay(options) { return createSelectionOverlayBase(Object.assign({ role: "selected", borderColor: "#f97316", backgroundColor: "rgba(249, 115, 22, 0.12)", labelPrefix: "Selected" }, options || {})); }
module.exports = { createSelectedOverlay };

},
25:function(module,exports,__require){
"use strict";

const { RUNTIME_ERROR_CODES } = __require(26);
const { okResult, blockedResult } = __require(27);
const { validateTargetContext, assertScope } = __require(28);
const {
  createSessionState,
  normalizeLayoutEntry,
  normalizeEntries,
  entriesToArray,
} = __require(29);

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function isFn(source, name) {
  return Boolean(source) && typeof source[name] === "function";
}

function parseScoped(args) {
  return args.length === 1
    ? { scopeId: undefined, elementId: args[0] }
    : { scopeId: args[0], elementId: args[1] };
}

function withRollbackInfo(result, rollback) {
  return {
    ...result,
    rollbackComplete: rollback.rollbackComplete,
    rollbackErrors: rollback.rollbackErrors,
    warnings: rollback.rollbackComplete
      ? result.warnings
      : [...(result.warnings || []), RUNTIME_ERROR_CODES.ROLLBACK_FAILED],
  };
}

function callResult(fn, code) {
  try {
    const result = fn();
    if (result && result.ok === false) {
      return blockedResult(code, result.reason || result.message || code, { value: result });
    }
    return okResult(result && Object.prototype.hasOwnProperty.call(result, "value") ? result.value : result);
  } catch (error) {
    return blockedResult(code, error.message || code);
  }
}

function registryListResult(registry) {
  if (!isFn(registry, "listElements")) {
    return blockedResult(RUNTIME_ERROR_CODES.INVALID_REGISTRY, "registry.listElements is required.");
  }
  return callResult(() => registry.listElements(), RUNTIME_ERROR_CODES.REGISTRY_READ_FAILED);
}

function registryGetResult(registry, id) {
  if (!isFn(registry, "getElementById")) {
    return blockedResult(RUNTIME_ERROR_CODES.INVALID_REGISTRY, "registry.getElementById is required.");
  }
  return callResult(() => registry.getElementById(id), RUNTIME_ERROR_CODES.REGISTRY_READ_FAILED);
}

function validateRegistry(registry) {
  if (!registry || !isFn(registry, "getElementById") || !isFn(registry, "listElements")) {
    return blockedResult(
      RUNTIME_ERROR_CODES.INVALID_REGISTRY,
      "registry must provide getElementById and listElements."
    );
  }
  return okResult();
}

function validateHostAdapter(host) {
  const required = [
    "validateElementRef",
    "captureElementLayoutState",
    "applyLayoutEntry",
    "clearElementLayout",
    "restoreElementLayoutState",
    "getCurrentLayoutEntry",
  ];
  const missing = required.filter((methodName) => !isFn(host, methodName));
  if (missing.length > 0) {
    return blockedResult(RUNTIME_ERROR_CODES.INVALID_HOST_ADAPTER, "hostAdapter is missing runtime methods.", {
      value: { missing },
    });
  }
  return okResult();
}

function storageAvailable(storage) {
  if (!storage) return blockedResult(RUNTIME_ERROR_CODES.STORAGE_UNAVAILABLE, "layoutStorage is required.");
  if (storage.available === false) {
    return blockedResult(RUNTIME_ERROR_CODES.STORAGE_UNAVAILABLE, "layoutStorage is not available.");
  }
  return okResult();
}

function storagePersistent(storage) {
  const available = storageAvailable(storage);
  if (!available.ok) return available;
  if (storage.persistent === false) {
    return blockedResult(RUNTIME_ERROR_CODES.STORAGE_NOT_PERSISTENT, "layoutStorage is not persistent.");
  }
  return okResult();
}

function readStorage(storage, context) {
  if (!isFn(storage, "readResult")) {
    return blockedResult(RUNTIME_ERROR_CODES.STORAGE_READ_FAILED, "layoutStorage.readResult is required.");
  }
  const result = callResult(() => storage.readResult(context), RUNTIME_ERROR_CODES.STORAGE_READ_FAILED);
  if (!result.ok) return result;
  const value = result.value && Object.prototype.hasOwnProperty.call(result.value, "entries")
    ? result.value.entries
    : result.value;
  return okResult(entriesToArray(normalizeEntries(value || [])));
}

function verifyStorage(storage, context, expected) {
  const result = readStorage(storage, context);
  if (!result.ok) return result;
  const normalizedExpected = entriesToArray(normalizeEntries(expected));
  if (JSON.stringify(result.value) !== JSON.stringify(normalizedExpected)) {
    return blockedResult(RUNTIME_ERROR_CODES.STORAGE_VERIFY_FAILED, "stored entries did not verify.", {
      value: { expected: normalizedExpected, actual: result.value },
    });
  }
  return okResult(result.value);
}

function writeStorage(storage, context, entries, code) {
  return callResult(() => storage.write(context, clone(entries)), code || RUNTIME_ERROR_CODES.STORAGE_WRITE_FAILED);
}

function validateElement(registry, id) {
  const result = registryGetResult(registry, id);
  if (!result.ok) return result;
  const element = result.value;
  if (!element) return blockedResult(RUNTIME_ERROR_CODES.UNKNOWN_ELEMENT, "unknown element.");
  if (element.editable === false) {
    return blockedResult(RUNTIME_ERROR_CODES.ELEMENT_NOT_EDITABLE, "element is not editable.");
  }
  return okResult(element);
}

function getAllowedOps(element) {
  if (element && element.operations && typeof element.operations === "object") {
    return Object.keys(element.operations).filter((key) => element.operations[key] === true);
  }
  return Array.isArray(element.effectiveOps)
    ? element.effectiveOps
    : (Array.isArray(element.allowedOps) ? element.allowedOps : []);
}

function isOperationAllowed(element, operation) {
  const lockedOps = Array.isArray(element.lockedOps) ? element.lockedOps : [];
  return !lockedOps.includes(operation) && getAllowedOps(element).includes(operation);
}

function validateLayoutEntryForElement(entry, registryElement) {
  const normalized = normalizeLayoutEntry(entry);
  if (!normalized) {
    return blockedResult(RUNTIME_ERROR_CODES.INVALID_LAYOUT_ENTRY, "layout entry is invalid or empty.");
  }
  const registryId = registryElement.elementId || registryElement.id;
  if (normalized.elementId !== registryId) {
    return blockedResult(RUNTIME_ERROR_CODES.INVALID_LAYOUT_ENTRY, "layout entry elementId does not match registry element.");
  }
  const elementValues = normalized.element || normalized;
  const textValues = normalized.text || {};
  const limits = registryElement.limits || registryElement;
  const bounds = [
    [elementValues, "x", "minX", "maxX"], [elementValues, "y", "minY", "maxY"],
    [elementValues, "width", "minWidth", "maxWidth"], [elementValues, "height", "minHeight", "maxHeight"],
    [textValues, "offsetX", "minTextOffsetX", "maxTextOffsetX"], [textValues, "offsetY", "minTextOffsetY", "maxTextOffsetY"],
    [textValues, "fontSize", "minFontSize", "maxFontSize"],
  ];
  for (const [values, field, minKey, maxKey] of bounds) {
    if (!Object.prototype.hasOwnProperty.call(values, field)) continue;
    if (!Number.isFinite(values[field])) return blockedResult(RUNTIME_ERROR_CODES.INVALID_LAYOUT_ENTRY, `${field} must be a finite number.`);
    if ((Number.isFinite(limits[minKey]) && values[field] < limits[minKey]) || (Number.isFinite(limits[maxKey]) && values[field] > limits[maxKey])) {
      return blockedResult(RUNTIME_ERROR_CODES.VALUE_OUT_OF_RANGE, `${field} exceeds registered limits.`, { value: { field, min: limits[minKey], max: limits[maxKey] } });
    }
  }
  if ((Object.prototype.hasOwnProperty.call(elementValues, "x") || Object.prototype.hasOwnProperty.call(elementValues, "y")) && !isOperationAllowed(registryElement, "move")) {
    return blockedResult(RUNTIME_ERROR_CODES.OPERATION_NOT_ALLOWED, "layout entry requires move operation.");
  }
  if (Object.prototype.hasOwnProperty.call(elementValues, "width") && !(isOperationAllowed(registryElement, "resizeWidth") || isOperationAllowed(registryElement, "resize"))) {
    return blockedResult(RUNTIME_ERROR_CODES.OPERATION_NOT_ALLOWED, "layout entry requires resizeWidth operation.");
  }
  if (Object.prototype.hasOwnProperty.call(elementValues, "height") && !(isOperationAllowed(registryElement, "resizeHeight") || isOperationAllowed(registryElement, "resize"))) {
    return blockedResult(RUNTIME_ERROR_CODES.OPERATION_NOT_ALLOWED, "layout entry requires resizeHeight operation.");
  }
  if ((Object.prototype.hasOwnProperty.call(textValues, "offsetX") || Object.prototype.hasOwnProperty.call(textValues, "offsetY")) && !isOperationAllowed(registryElement, "textMove")) {
    return blockedResult(RUNTIME_ERROR_CODES.OPERATION_NOT_ALLOWED, "layout entry requires textMove operation.");
  }
  if (Object.prototype.hasOwnProperty.call(textValues, "fontSize") && !isOperationAllowed(registryElement, "textResize")) {
    return blockedResult(RUNTIME_ERROR_CODES.OPERATION_NOT_ALLOWED, "layout entry requires textResize operation.");
  }
  if (Object.prototype.hasOwnProperty.call(elementValues, "visible")) {
    const visibilityOperation = elementValues.visible === false ? "hide" : "show";
    if (!isOperationAllowed(registryElement, visibilityOperation)) {
      return blockedResult(RUNTIME_ERROR_CODES.OPERATION_NOT_ALLOWED, `layout entry requires ${visibilityOperation} operation.`);
    }
  }
  return okResult(normalized);
}

function operationAllowed(element, operation) {
  return isOperationAllowed(element, operation);
}

function captureHostState(host, elementId) {
  return callResult(() => host.captureElementLayoutState(elementId), RUNTIME_ERROR_CODES.HOST_CAPTURE_FAILED);
}

function readHostEntry(host, elementId) {
  return callResult(() => host.getCurrentLayoutEntry(elementId), RUNTIME_ERROR_CODES.HOST_READ_FAILED);
}

function validateHostRef(host, elementId) {
  return callResult(() => host.validateElementRef(elementId), RUNTIME_ERROR_CODES.ELEMENT_REF_MISSING);
}

function restoreHostState(host, elementId, snapshot) {
  return callResult(
    () => host.restoreElementLayoutState(elementId, clone(snapshot)),
    RUNTIME_ERROR_CODES.ROLLBACK_FAILED
  );
}

function restoreHostSnapshots(host, snapshots) {
  const rollbackErrors = [];
  Object.keys(snapshots).forEach((elementId) => {
    const restored = restoreHostState(host, elementId, snapshots[elementId]);
    if (!restored.ok) {
      rollbackErrors.push({ elementId, code: restored.code, reason: restored.reason });
    }
  });
  return { rollbackComplete: rollbackErrors.length === 0, rollbackErrors };
}

function restorePersistent(storage, context, entries) {
  const write = writeStorage(storage, context, entries, RUNTIME_ERROR_CODES.ROLLBACK_FAILED);
  if (!write.ok) {
    return { rollbackComplete: false, rollbackErrors: [{ target: "storage", code: write.code, reason: write.reason }] };
  }
  const verify = verifyStorage(storage, context, entries);
  if (!verify.ok) {
    return { rollbackComplete: false, rollbackErrors: [{ target: "storage", code: verify.code, reason: verify.reason }] };
  }
  return { rollbackComplete: true, rollbackErrors: [] };
}

function mergeRollbackResults(...results) {
  const rollbackErrors = results.flatMap((result) => result.rollbackErrors || []);
  return { rollbackComplete: rollbackErrors.length === 0, rollbackErrors };
}

function createUiEditorRuntime(options) {
  const cfg = options || {};
  const contextResult = validateTargetContext(cfg.targetContext);
  const context = contextResult.ok ? contextResult.value : null;
  const session = createSessionState(cfg.clock);
  const registry = cfg.registry;
  const host = cfg.hostAdapter;
  const storage = cfg.layoutStorage;

  function preflight(scopeId, needActive) {
    if (!contextResult.ok) return contextResult;
    const scope = assertScope(context, scopeId);
    if (!scope.ok) return scope;
    const registryResult = validateRegistry(registry);
    if (!registryResult.ok) return registryResult;
    const hostResult = validateHostAdapter(host);
    if (!hostResult.ok) return hostResult;
    if (needActive && !session.isActive()) {
      return blockedResult(RUNTIME_ERROR_CODES.SESSION_NOT_ACTIVE, "session is not active.");
    }
    return okResult();
  }


  function listRegistryElements() {
    const listed = registryListResult(registry);
    if (!listed.ok) return listed;
    if (!Array.isArray(listed.value)) {
      return blockedResult(RUNTIME_ERROR_CODES.INVALID_REGISTRY, "registry.listElements must return an array.");
    }
    return okResult(listed.value);
  }

  function validateEntryForHost(entry) {
    const elementResult = validateElement(registry, entry && entry.elementId);
    if (!elementResult.ok) return elementResult;
    const entryResult = validateLayoutEntryForElement(entry, elementResult.value);
    if (!entryResult.ok) return entryResult;
    const ref = validateHostRef(host, entryResult.value.elementId);
    if (!ref.ok) return ref;
    return okResult({ entry: entryResult.value, element: elementResult.value });
  }

  function validateEntriesForHost(entries) {
    const validatedEntries = [];
    const seen = new Set();
    for (const rawEntry of entries) {
      const normalized = normalizeLayoutEntry(rawEntry);
      if (!normalized) return blockedResult(RUNTIME_ERROR_CODES.INVALID_LAYOUT_ENTRY, "layout entry is invalid or empty.");
      if (seen.has(normalized.elementId)) {
        return blockedResult(RUNTIME_ERROR_CODES.INVALID_LAYOUT_ENTRY, "layout entries contain duplicate elementId.");
      }
      seen.add(normalized.elementId);
      const validated = validateEntryForHost(normalized);
      if (!validated.ok) return validated;
      validatedEntries.push(validated.value.entry);
    }
    return okResult(validatedEntries);
  }

  function status(scopeId) {
    const preflightResult = preflight(scopeId, false);
    return preflightResult.ok ? session.status() : preflightResult;
  }

  function beginSession(scopeId) {
    const preflightResult = preflight(scopeId, false);
    if (!preflightResult.ok) return preflightResult;
    if (session.isActive()) {
      return okResult(undefined, {
        code: RUNTIME_ERROR_CODES.ALREADY_ACTIVE,
        status: session.status(),
        warnings: [RUNTIME_ERROR_CODES.ALREADY_ACTIVE],
      });
    }

    const listed = listRegistryElements();
    if (!listed.ok) return listed;
    const entries = [];
    for (const element of listed.value) {
      const current = readHostEntry(host, element.elementId || element.id);
      if (!current.ok) return current;
      const normalized = normalizeLayoutEntry(current.value);
      if (normalized) {
        const entryResult = validateLayoutEntryForElement(normalized, element);
        if (!entryResult.ok) return entryResult;
        entries.push(entryResult.value);
      }
    }

    return okResult(undefined, { status: session.begin(entries) });
  }

  function applyEntryToHost(entry) {
    const validated = validateEntryForHost(entry);
    if (!validated.ok) return validated;
    return callResult(() => host.applyLayoutEntry(validated.value.entry.elementId, validated.value.entry), RUNTIME_ERROR_CODES.HOST_APPLY_FAILED);
  }

  function clearEntryFromHost(elementId, registryElement) {
    const ref = validateHostRef(host, elementId);
    if (!ref.ok) return ref;
    return callResult(() => host.clearElementLayout(elementId, registryElement), RUNTIME_ERROR_CODES.HOST_CLEAR_FAILED);
  }

  function applyChange(changeRequest) {
    const preflightResult = preflight(changeRequest && changeRequest.scope, false);
    if (!preflightResult.ok) return preflightResult;
    if (!session.isActive()) {
      return blockedResult(RUNTIME_ERROR_CODES.SESSION_NOT_ACTIVE, "session is not active.");
    }
    if (!changeRequest || typeof changeRequest !== "object") {
      return blockedResult(RUNTIME_ERROR_CODES.INVALID_LAYOUT_ENTRY, "changeRequest must be an object.");
    }

    const elementResult = validateElement(registry, changeRequest.elementId);
    if (!elementResult.ok) return elementResult;
    const requestedOperation = changeRequest.operation;
    const allowed = operationAllowed(elementResult.value, requestedOperation) ||
      ((requestedOperation === "resizeWidth" || requestedOperation === "resizeHeight") && operationAllowed(elementResult.value, "resize"));
    if (!["move", "resize", "resizeWidth", "resizeHeight", "textMove", "textResize"].includes(requestedOperation) || !allowed) {
      return blockedResult(RUNTIME_ERROR_CODES.OPERATION_NOT_ALLOWED, "operation is not allowed.");
    }

    const entry = normalizeLayoutEntry({ elementId: changeRequest.elementId, ...(changeRequest.payload || {}) });
    if (!entry) {
      return blockedResult(RUNTIME_ERROR_CODES.INVALID_LAYOUT_ENTRY, "changeRequest payload contains no neutral layout entry.");
    }
    const entryValidation = validateLayoutEntryForElement(entry, elementResult.value);
    if (!entryValidation.ok) return entryValidation;

    const snapshot = captureHostState(host, changeRequest.elementId);
    if (!snapshot.ok) return snapshot;
    const oldSessionEntries = session.getSessionEntries();
    const applied = callResult(
      () => host.applyLayoutEntry(changeRequest.elementId, entryValidation.value),
      RUNTIME_ERROR_CODES.HOST_APPLY_FAILED
    );
    if (!applied.ok) {
      session.setSessionEntries(oldSessionEntries);
      return withRollbackInfo(applied, restoreHostSnapshots(host, { [changeRequest.elementId]: snapshot.value }));
    }

    const current = readHostEntry(host, changeRequest.elementId);
    if (!current.ok) {
      session.setSessionEntries(oldSessionEntries);
      return withRollbackInfo(current, restoreHostSnapshots(host, { [changeRequest.elementId]: snapshot.value }));
    }
    const currentEntry = normalizeLayoutEntry(current.value) || entryValidation.value;
    const currentValidation = validateLayoutEntryForElement(currentEntry, elementResult.value);
    if (!currentValidation.ok) {
      session.setSessionEntries(oldSessionEntries);
      return withRollbackInfo(currentValidation, restoreHostSnapshots(host, { [changeRequest.elementId]: snapshot.value }));
    }
    session.setEntry(currentValidation.value);
    return okResult(currentValidation.value, { status: session.status() });
  }

  function discardElementChanges() {
    const { scopeId, elementId } = parseScoped(arguments);
    const preflightResult = preflight(scopeId, true);
    if (!preflightResult.ok) return preflightResult;
    const elementResult = validateElement(registry, elementId);
    if (!elementResult.ok) return elementResult;
    const baseline = normalizeEntries(session.getBaselineEntries()).get(elementId);
    const snapshot = captureHostState(host, elementId);
    if (!snapshot.ok) return snapshot;
    const oldSessionEntries = session.getSessionEntries();
    const applied = baseline ? applyEntryToHost(baseline) : clearEntryFromHost(elementId, elementResult.value);
    if (!applied.ok) {
      session.setSessionEntries(oldSessionEntries);
      return withRollbackInfo(applied, restoreHostSnapshots(host, { [elementId]: snapshot.value }));
    }
    if (baseline) session.setEntry(baseline);
    else session.removeEntry(elementId);
    return okResult(undefined, { status: session.status() });
  }

  function discardAllChanges(scopeId) {
    const preflightResult = preflight(scopeId, true);
    if (!preflightResult.ok) return preflightResult;
    const oldSessionEntries = session.getSessionEntries();
    const baselineEntries = session.getBaselineEntries();
    const baselineById = normalizeEntries(baselineEntries);
    const listed = listRegistryElements();
    if (!listed.ok) return listed;
    const editableElements = listed.value.filter((element) => element.editable !== false);
    const snapshots = {};

    for (const element of editableElements) {
      const elementId = element.elementId || element.id;
      const snapshot = captureHostState(host, elementId);
      if (!snapshot.ok) return snapshot;
      snapshots[elementId] = snapshot.value;
    }

    for (const element of editableElements) {
      const elementId = element.elementId || element.id;
      const entry = baselineById.get(elementId);
      const applied = entry ? applyEntryToHost(entry) : clearEntryFromHost(elementId, element);
      if (!applied.ok) {
        session.setSessionEntries(oldSessionEntries);
        return withRollbackInfo(applied, restoreHostSnapshots(host, snapshots));
      }
    }

    session.setSessionEntries(baselineEntries);
    return okResult(undefined, { status: session.status() });
  }

  function resetSessionBaseline(scopeId) {
    const preflightResult = preflight(scopeId, true);
    if (!preflightResult.ok) return preflightResult;
    return okResult(undefined, { status: session.resetBaselineToSession() });
  }

  function resetSessionBaselineElement() {
    const { scopeId, elementId } = parseScoped(arguments);
    const preflightResult = preflight(scopeId, true);
    if (!preflightResult.ok) return preflightResult;
    const elementResult = validateElement(registry, elementId);
    if (!elementResult.ok) return elementResult;
    return okResult(undefined, { status: session.resetBaselineElement(elementId) });
  }

  function saveLayout(scopeId) {
    const preflightResult = preflight(scopeId, true);
    if (!preflightResult.ok) return preflightResult;
    const persistent = storagePersistent(storage);
    if (!persistent.ok) return persistent;

    const oldSessionEntries = session.getSessionEntries();
    const oldBaselineEntries = session.getBaselineEntries();
    const validatedEntries = validateEntriesForHost(oldSessionEntries);
    if (!validatedEntries.ok) return validatedEntries;
    const oldPersistent = readStorage(storage, context);
    if (!oldPersistent.ok) return oldPersistent;
    const entries = validatedEntries.value;

    const written = writeStorage(storage, context, entries);
    if (!written.ok) return written;
    const verified = verifyStorage(storage, context, entries);
    if (!verified.ok) {
      session.setSessionEntries(oldSessionEntries);
      session.setBaselineEntries(oldBaselineEntries);
      return withRollbackInfo(verified, restorePersistent(storage, context, oldPersistent.value));
    }

    session.resetBaselineToSession();
    return okResult(entries, { status: session.status() });
  }

  function validateLoadedEntries(entries) {
    const normalizedEntries = [];
    const seen = new Set();
    for (const rawEntry of entries) {
      const entry = normalizeLayoutEntry(rawEntry);
      if (!entry) return blockedResult(RUNTIME_ERROR_CODES.INVALID_LAYOUT_ENTRY, "loaded layout entry is invalid.");
      if (seen.has(entry.elementId)) {
        return blockedResult(RUNTIME_ERROR_CODES.INVALID_LAYOUT_ENTRY, "loaded layout entries contain duplicate elementId.");
      }
      seen.add(entry.elementId);
      const validated = validateEntryForHost(entry);
      if (!validated.ok) return validated;
      normalizedEntries.push(validated.value.entry);
    }
    return okResult(normalizedEntries);
  }

  function loadLayout(scopeId) {
    const preflightResult = preflight(scopeId, false);
    if (!preflightResult.ok) return preflightResult;
    const available = storageAvailable(storage);
    if (!available.ok) return available;
    const read = readStorage(storage, context);
    if (!read.ok) return read;
    const validated = validateLoadedEntries(read.value);
    if (!validated.ok) return validated;

    const oldSessionEntries = session.getSessionEntries();
    const oldBaselineEntries = session.getBaselineEntries();
    const loadedEntries = validated.value;
    const loadedById = normalizeEntries(loadedEntries);
    const previousIds = new Set([...normalizeEntries(oldSessionEntries).keys(), ...normalizeEntries(oldBaselineEntries).keys()]);
    const affectedIds = new Set([...loadedById.keys(), ...previousIds]);
    const listed = listRegistryElements();
    if (!listed.ok) return listed;
    const editableById = new Map(listed.value.filter((element) => element.editable !== false).map((element) => [element.elementId || element.id, element]));
    const snapshots = {};

    for (const elementId of affectedIds) {
      const element = editableById.get(elementId);
      if (!element) continue;
      const snapshot = captureHostState(host, elementId);
      if (!snapshot.ok) return snapshot;
      snapshots[elementId] = snapshot.value;
    }

    for (const entry of loadedEntries) {
      const applied = applyEntryToHost(entry);
      if (!applied.ok) {
        session.setSessionEntries(oldSessionEntries);
        session.setBaselineEntries(oldBaselineEntries);
        return withRollbackInfo(applied, restoreHostSnapshots(host, snapshots));
      }
    }

    for (const [elementId, element] of editableById.entries()) {
      if (!affectedIds.has(elementId) || loadedById.has(elementId)) continue;
      const cleared = clearEntryFromHost(elementId, element);
      if (!cleared.ok) {
        session.setSessionEntries(oldSessionEntries);
        session.setBaselineEntries(oldBaselineEntries);
        return withRollbackInfo(cleared, restoreHostSnapshots(host, snapshots));
      }
    }

    if (!session.isActive()) session.begin(oldSessionEntries);
    session.setSessionEntries(loadedEntries);
    session.setBaselineEntries(loadedEntries);
    return okResult(loadedEntries, { status: session.status() });
  }

  function resetLayoutToDefaults(scopeId) {
    const preflightResult = preflight(scopeId, true);
    if (!preflightResult.ok) return preflightResult;
    const persistent = storagePersistent(storage);
    if (!persistent.ok) return persistent;
    const oldPersistent = readStorage(storage, context);
    if (!oldPersistent.ok) return oldPersistent;
    const oldSessionEntries = session.getSessionEntries();
    const oldBaselineEntries = session.getBaselineEntries();
    const listed = listRegistryElements();
    if (!listed.ok) return listed;
    const editableElements = listed.value.filter((element) => element.editable !== false);
    const snapshots = {};

    function rollbackFrom(errorResult) {
      session.setSessionEntries(oldSessionEntries);
      session.setBaselineEntries(oldBaselineEntries);
      const hostRollback = restoreHostSnapshots(host, snapshots);
      const persistentRollback = restorePersistent(storage, context, oldPersistent.value);
      return withRollbackInfo(errorResult, mergeRollbackResults(hostRollback, persistentRollback));
    }

    for (const element of editableElements) {
      const elementId = element.elementId || element.id;
      const snapshot = captureHostState(host, elementId);
      if (!snapshot.ok) return rollbackFrom(snapshot);
      snapshots[elementId] = snapshot.value;
      const cleared = clearEntryFromHost(elementId, element);
      if (!cleared.ok) return rollbackFrom(cleared);
    }

    const clearedStorage = callResult(() => storage.clear(context), RUNTIME_ERROR_CODES.STORAGE_CLEAR_FAILED);
    if (!clearedStorage.ok) return rollbackFrom(clearedStorage);
    const verified = verifyStorage(storage, context, []);
    if (!verified.ok) return rollbackFrom(verified);

    session.setSessionEntries([]);
    session.setBaselineEntries([]);
    return okResult([], { status: session.status() });
  }

  function resetElementToDefaults() {
    const { scopeId, elementId } = parseScoped(arguments);
    const preflightResult = preflight(scopeId, true);
    if (!preflightResult.ok) return preflightResult;
    const elementResult = validateElement(registry, elementId);
    if (!elementResult.ok) return elementResult;
    const persistent = storagePersistent(storage);
    if (!persistent.ok) return persistent;
    const oldPersistent = readStorage(storage, context);
    if (!oldPersistent.ok) return oldPersistent;
    const oldSessionEntries = session.getSessionEntries();
    const oldBaselineEntries = session.getBaselineEntries();
    const snapshot = captureHostState(host, elementId);
    if (!snapshot.ok) return snapshot;

    function rollbackFrom(errorResult) {
      session.setSessionEntries(oldSessionEntries);
      session.setBaselineEntries(oldBaselineEntries);
      const hostRollback = restoreHostSnapshots(host, { [elementId]: snapshot.value });
      const persistentRollback = restorePersistent(storage, context, oldPersistent.value);
      return withRollbackInfo(errorResult, mergeRollbackResults(hostRollback, persistentRollback));
    }

    const cleared = clearEntryFromHost(elementId, elementResult.value);
    if (!cleared.ok) return rollbackFrom(cleared);
    session.removeEntry(elementId);
    session.resetBaselineElement(elementId);

    const written = isFn(storage, "deleteEntry")
      ? callResult(() => storage.deleteEntry(context, elementId), RUNTIME_ERROR_CODES.STORAGE_WRITE_FAILED)
      : writeStorage(storage, context, oldPersistent.value.filter((entry) => entry.elementId !== elementId));
    if (!written.ok) return rollbackFrom(written);

    const verified = readStorage(storage, context);
    if (!verified.ok) return rollbackFrom(verified);
    if (verified.value.some((entry) => entry.elementId === elementId)) {
      return rollbackFrom(blockedResult(RUNTIME_ERROR_CODES.STORAGE_VERIFY_FAILED, "element entry was not removed."));
    }

    return okResult(undefined, { status: session.status() });
  }

  function getPersistenceStatus() {
    const available = storageAvailable(storage);
    return {
      available: available.ok,
      persistent: available.ok && storagePersistent(storage).ok,
      code: available.ok ? (storagePersistent(storage).ok ? "PERSISTENT" : RUNTIME_ERROR_CODES.STORAGE_NOT_PERSISTENT) : available.code,
    };
  }

  function inspectElement() {
    const { scopeId, elementId } = parseScoped(arguments);
    const preflightResult = preflight(scopeId, false);
    if (!preflightResult.ok) return preflightResult;
    const elementResult = registryGetResult(registry, elementId);
    if (!elementResult.ok) return elementResult;
    const element = elementResult.value;
    if (!element) return blockedResult(RUNTIME_ERROR_CODES.UNKNOWN_ELEMENT, "unknown element.");
    const current = readHostEntry(host, elementId);
    if (!current.ok) return current;
    const sessionEntries = normalizeEntries(session.getSessionEntries());
    const baselineEntries = normalizeEntries(session.getBaselineEntries());
    const currentEntry = normalizeLayoutEntry(current.value) || sessionEntries.get(elementId) || { elementId };
    const effectiveLayout = clone(current.value) || clone(currentEntry);
    const baselineEntry = baselineEntries.get(elementId) || null;
    const allowedOps = getAllowedOps(element);
    const lockedOps = Array.isArray(element.lockedOps) ? element.lockedOps : [];
    const effectiveOps = (Array.isArray(element.effectiveOps) ? element.effectiveOps : allowedOps).filter((op) => !lockedOps.includes(op));
    return okResult(undefined, { elementId, currentEntry, effectiveLayout, baselineEntry, changed: JSON.stringify(currentEntry || null) !== JSON.stringify(baselineEntry || null), allowedOps, effectiveOps });
  }

  function reapplyCurrentLayoutState(scopeId) {
    const preflightResult = preflight(scopeId, true);
    if (!preflightResult.ok) return preflightResult;
    const validatedEntries = validateEntriesForHost(session.getSessionEntries());
    if (!validatedEntries.ok) return validatedEntries;
    if (isFn(host, "reapplyLayoutEntries")) {
      const reapplied = callResult(
        () => host.reapplyLayoutEntries(validatedEntries.value),
        RUNTIME_ERROR_CODES.HOST_APPLY_FAILED
      );
      if (!reapplied.ok) return reapplied;
    } else {
      for (const entry of validatedEntries.value) {
        const applied = applyEntryToHost(entry);
        if (!applied.ok) return applied;
      }
    }
    return okResult(undefined, { status: session.status() });
  }

  function endSession(scopeId) {
    const preflightResult = preflight(scopeId, true);
    if (!preflightResult.ok) return preflightResult;
    return okResult(undefined, { status: session.end() });
  }

  return {
    beginSession,
    getSessionStatus: status,
    applyChange,
    discardElementChanges,
    discardAllChanges,
    resetSessionBaseline,
    resetSessionBaselineElement,
    saveLayout,
    loadLayout,
    resetLayoutToDefaults,
    resetElementToDefaults,
    inspectElement,
    getPersistenceStatus,
    reapplyCurrentLayoutState,
    endSession,
  };
}

module.exports = { createUiEditorRuntime, validateLayoutEntryForElement };

},
26:function(module,exports,__require){
"use strict";

const RUNTIME_ERROR_CODES = Object.freeze({
  INVALID_TARGET_CONTEXT: "INVALID_TARGET_CONTEXT",
  INVALID_REGISTRY: "INVALID_REGISTRY",
  REGISTRY_READ_FAILED: "REGISTRY_READ_FAILED",
  INVALID_HOST_ADAPTER: "INVALID_HOST_ADAPTER",
  UNKNOWN_SCOPE: "UNKNOWN_SCOPE",
  UNKNOWN_ELEMENT: "UNKNOWN_ELEMENT",
  ELEMENT_NOT_EDITABLE: "ELEMENT_NOT_EDITABLE",
  OPERATION_NOT_ALLOWED: "OPERATION_NOT_ALLOWED",
  SESSION_NOT_ACTIVE: "SESSION_NOT_ACTIVE",
  STORAGE_UNAVAILABLE: "STORAGE_UNAVAILABLE",
  STORAGE_NOT_PERSISTENT: "STORAGE_NOT_PERSISTENT",
  STORAGE_READ_FAILED: "STORAGE_READ_FAILED",
  STORAGE_WRITE_FAILED: "STORAGE_WRITE_FAILED",
  STORAGE_CLEAR_FAILED: "STORAGE_CLEAR_FAILED",
  STORAGE_VERIFY_FAILED: "STORAGE_VERIFY_FAILED",
  ELEMENT_REF_MISSING: "ELEMENT_REF_MISSING",
  HOST_APPLY_FAILED: "HOST_APPLY_FAILED",
  HOST_CAPTURE_FAILED: "HOST_CAPTURE_FAILED",
  HOST_READ_FAILED: "HOST_READ_FAILED",
  HOST_CLEAR_FAILED: "HOST_CLEAR_FAILED",
  ROLLBACK_FAILED: "ROLLBACK_FAILED",
  INVALID_LAYOUT_ENTRY: "INVALID_LAYOUT_ENTRY",
  VALUE_OUT_OF_RANGE: "VALUE_OUT_OF_RANGE",
  ALREADY_ACTIVE: "ALREADY_ACTIVE",
});

module.exports = { RUNTIME_ERROR_CODES };

},
27:function(module,exports,__require){
"use strict";
function okResult(value, extras) { return { ok: true, ...(extras || {}), ...(value === undefined ? {} : { value }) }; }
function blockedResult(code, reason, extras) { return { ok: false, blocked: true, code, reason, ...(extras || {}) }; }
module.exports = { okResult, blockedResult };

},
28:function(module,exports,__require){
"use strict";
const { RUNTIME_ERROR_CODES } = __require(26);
const { blockedResult, okResult } = __require(27);
function isNonEmptyString(value) { return typeof value === "string" && value.trim().length > 0; }
function normalizeTargetContext(context) {
  if (!context || typeof context !== "object" || Array.isArray(context)) return null;
  return {
    targetAppId: isNonEmptyString(context.targetAppId) ? context.targetAppId.trim() : "",
    moduleId: isNonEmptyString(context.moduleId) ? context.moduleId.trim() : "",
    scopeId: isNonEmptyString(context.scopeId) ? context.scopeId.trim() : "",
    layoutProfileId: isNonEmptyString(context.layoutProfileId) ? context.layoutProfileId.trim() : "default",
  };
}
function validateTargetContext(context) {
  const normalized = normalizeTargetContext(context);
  if (!normalized || !isNonEmptyString(normalized.targetAppId) || !isNonEmptyString(normalized.moduleId) || !isNonEmptyString(normalized.scopeId) || !isNonEmptyString(normalized.layoutProfileId)) {
    return blockedResult(RUNTIME_ERROR_CODES.INVALID_TARGET_CONTEXT, "targetContext requires non-empty targetAppId, moduleId, scopeId and layoutProfileId.");
  }
  return okResult(normalized);
}
function assertScope(context, scopeId) {
  if (scopeId === undefined || scopeId === null || scopeId === "") return okResult(context);
  return scopeId === context.scopeId ? okResult(context) : blockedResult(RUNTIME_ERROR_CODES.UNKNOWN_SCOPE, "scopeId does not match runtime targetContext.");
}
module.exports = { normalizeTargetContext, validateTargetContext, assertScope };

},
29:function(module,exports,__require){
"use strict";
const ELEMENT_FIELDS = Object.freeze(["x", "y", "width", "height", "visible"]);
const TEXT_FIELDS = Object.freeze(["offsetX", "offsetY", "fontSize"]);
const LAYOUT_ENTRY_FIELDS = Object.freeze(["elementId", ...ELEMENT_FIELDS, "element", "text"]);
function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
function normalizeLayoutEntry(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry) || typeof entry.elementId !== "string" || entry.elementId.trim() === "") return null;
  const normalized = { elementId: entry.elementId };
  const nested = Object.prototype.hasOwnProperty.call(entry, "element") || Object.prototype.hasOwnProperty.call(entry, "text");
  if (nested) {
    const element = {};
    const text = {};
    for (const field of ELEMENT_FIELDS) if (entry.element && Object.prototype.hasOwnProperty.call(entry.element, field)) element[field] = clone(entry.element[field]);
    for (const field of TEXT_FIELDS) if (entry.text && Object.prototype.hasOwnProperty.call(entry.text, field)) text[field] = clone(entry.text[field]);
    if (Object.keys(element).length > 0) normalized.element = element;
    if (Object.keys(text).length > 0) normalized.text = text;
  } else {
    // M68-M72 layout entries remain readable; new integrations should use element/text.
    for (const field of ELEMENT_FIELDS) if (Object.prototype.hasOwnProperty.call(entry, field)) normalized[field] = clone(entry[field]);
  }
  return Object.keys(normalized).length === 1 ? null : normalized;
}
function normalizeEntries(entries) {
  const map = new Map();
  const list = Array.isArray(entries) ? entries : Object.values(entries || {});
  for (const entry of list) { const normalized = normalizeLayoutEntry(entry); if (normalized) map.set(normalized.elementId, normalized); }
  return map;
}
function entriesToArray(map) { return Array.from(map.values()).map(clone).sort((a, b) => a.elementId.localeCompare(b.elementId)); }
function entriesEqual(a, b) { return JSON.stringify(a || null) === JSON.stringify(b || null); }
function changedIds(session, baseline) {
  const ids = new Set([...session.keys(), ...baseline.keys()]);
  return Array.from(ids).filter((id) => !entriesEqual(session.get(id), baseline.get(id))).sort();
}
function createSessionState(clock) {
  const now = typeof clock === "function" ? clock : () => Date.now();
  let active = false, baseline = new Map(), session = new Map(), baselineVersion = String(now()), lastStatus = null;
  function status() { const ids = changedIds(session, baseline); const changedByElementId = {}; ids.forEach((id) => { changedByElementId[id] = { baseline: clone(baseline.get(id)) || null, current: clone(session.get(id)) || null }; }); lastStatus = { ok: true, active, changedElementIds: ids, changedCount: ids.length, changedByElementId, baselineVersion }; return clone(lastStatus); }
  return {
    isActive: () => active,
    begin(entries) { baseline = normalizeEntries(entries); session = normalizeEntries(entries); active = true; baselineVersion = String(now()); return status(); },
    end() { active = false; return status(); },
    status,
    getSessionEntries: () => entriesToArray(session),
    getBaselineEntries: () => entriesToArray(baseline),
    setSessionEntries(entries) { session = normalizeEntries(entries); return status(); },
    setBaselineEntries(entries) { baseline = normalizeEntries(entries); baselineVersion = String(now()); return status(); },
    setEntry(entry) { const normalized = normalizeLayoutEntry(entry); if (normalized) session.set(normalized.elementId, normalized); else if (entry && entry.elementId) session.delete(entry.elementId); return status(); },
    removeEntry(id) { session.delete(id); return status(); },
    resetBaselineToSession() { baseline = normalizeEntries(entriesToArray(session)); baselineVersion = String(now()); return status(); },
    resetBaselineElement(id) { if (session.has(id)) baseline.set(id, clone(session.get(id))); else baseline.delete(id); baselineVersion = String(now()); return status(); },
  };
}
module.exports = { ELEMENT_FIELDS, TEXT_FIELDS, LAYOUT_ENTRY_FIELDS, normalizeLayoutEntry, normalizeEntries, entriesToArray, createSessionState };

},
30:function(module,exports,__require){
"use strict";
const { RUNTIME_ERROR_CODES } = __require(26);
const { PANEL_LAYERS, PANEL_MODES } = __require(31);
const { createPanelMessageCatalog } = __require(32);

const PANEL_ERROR_CODES = Object.freeze({
  NO_SELECTION: "NO_SELECTION",
  CURRENT_VALUE_UNAVAILABLE: "CURRENT_VALUE_UNAVAILABLE",
  INVALID_DIALOG_STATE: "INVALID_DIALOG_STATE",
  BUSY: "BUSY",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
});

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function isFn(source, name) {
  return Boolean(source) && typeof source[name] === "function";
}

function blocked(code, reason, details) {
  return { ok: false, blocked: true, code, messageKey: code, ...(reason ? { reason } : {}), ...(details ? { details } : {}) };
}

function okWithCode(result, successCode) {
  if (result && result.ok === false) return result;
  return { ...(result || { ok: true }), ok: true, code: successCode, messageKey: successCode };
}

function opsFor(element) {
  const allowedOps = element && element.operations && typeof element.operations === "object"
    ? Object.keys(element.operations).filter((key) => element.operations[key] === true)
    : (Array.isArray(element && element.allowedOps) ? element.allowedOps.slice() : []);
  const lockedOps = Array.isArray(element && element.lockedOps) ? element.lockedOps : [];
  const sourceEffective = Array.isArray(element && element.effectiveOps) ? element.effectiveOps : allowedOps;
  return {
    allowedOps,
    effectiveOps: sourceEffective.filter((operation) => !lockedOps.includes(operation)),
  };
}

function modesFrom(effectiveOps) {
  const modes = [];
  if (effectiveOps.includes("move")) modes.push(PANEL_MODES.MOVE);
  if (effectiveOps.includes("resize") || effectiveOps.includes("resizeWidth")) modes.push(PANEL_MODES.WIDTH);
  if (effectiveOps.includes("resize") || effectiveOps.includes("resizeHeight")) modes.push(PANEL_MODES.HEIGHT);
  return modes;
}

function textModesFrom(effectiveOps) {
  const modes = [];
  if (effectiveOps.includes("textMove")) modes.push(PANEL_MODES.TEXT_POSITION);
  if (effectiveOps.includes("textResize")) modes.push(PANEL_MODES.TEXT_SIZE);
  return modes;
}

function createUiEditorPanelController(options) {
  const cfg = options || {};
  if (!cfg.runtime) throw new Error("runtime is required");
  if (!cfg.registry) throw new Error("registry is required");

  const runtime = cfg.runtime;
  const registry = cfg.registry;
  const messages = createPanelMessageCatalog(cfg.messages);
  const listeners = new Set();
  let destroyed = false;

  const state = {
    selectedElementId: null,
    selectedElementName: "",
    editable: false,
    allowedOps: [],
    effectiveOps: [],
    modernOperations: false,
    availableModes: [],
    availableTextModes: [],
    layer: PANEL_LAYERS.ELEMENT,
    mode: cfg.initialMode || PANEL_MODES.MOVE,
    stepSize: Number(cfg.stepSize) || 5,
    dialog: { open: false },
    lastResult: null,
    busy: false,
    runtimeStatus: null,
    persistenceStatus: { available: true, persistent: true },
    messages,
  };

  function emit() {
    if (!destroyed) listeners.forEach((listener) => listener(getState()));
  }

  function safeRegistryGet(elementId) {
    if (!isFn(registry, "getElementById")) {
      return blocked(RUNTIME_ERROR_CODES.INVALID_REGISTRY, "registry.getElementById is required.");
    }
    try {
      return { ok: true, value: registry.getElementById(elementId) };
    } catch (error) {
      return blocked(RUNTIME_ERROR_CODES.REGISTRY_READ_FAILED, error.message || "registry read failed.");
    }
  }

  function refreshStatus() {
    if (isFn(runtime, "getSessionStatus")) {
      try {
        const status = runtime.getSessionStatus();
        if (status && status.ok !== false) {
          state.runtimeStatus = {
            active: !!status.active,
            changedCount: status.changedCount || 0,
            changedElementIds: status.changedElementIds || [],
          };
        }
      } catch (error) {
        state.lastResult = blocked(PANEL_ERROR_CODES.UNKNOWN_ERROR, error.message);
      }
    }
    if (isFn(runtime, "getPersistenceStatus")) {
      try {
        state.persistenceStatus = runtime.getPersistenceStatus();
      } catch (error) {
        state.persistenceStatus = { available: false, persistent: false, code: RUNTIME_ERROR_CODES.STORAGE_UNAVAILABLE };
        state.lastResult = blocked(PANEL_ERROR_CODES.UNKNOWN_ERROR, error.message);
      }
    }
    return state.runtimeStatus;
  }

  function applySelection(element, inspectResult) {
    const inspectedOps = inspectResult && inspectResult.ok !== false
      ? { allowedOps: inspectResult.allowedOps, effectiveOps: inspectResult.effectiveOps }
      : {};
    const operationState = opsFor({ ...element, ...inspectedOps });
    state.selectedElementId = element.elementId || element.id;
    state.selectedElementName = element.displayName || element.name || state.selectedElementId;
    state.editable = element.editable !== false;
    state.allowedOps = operationState.allowedOps;
    state.effectiveOps = operationState.effectiveOps;
    state.modernOperations = !!(element.operations && typeof element.operations === "object");
    state.availableModes = state.editable ? modesFrom(operationState.effectiveOps) : [];
    state.availableTextModes = state.editable ? textModesFrom(operationState.effectiveOps) : [];
    if (state.layer === PANEL_LAYERS.TEXT && state.availableTextModes.length === 0) state.layer = PANEL_LAYERS.ELEMENT;
    const modes = state.layer === PANEL_LAYERS.TEXT ? state.availableTextModes : state.availableModes;
    if (!modes.includes(state.mode)) state.mode = modes[0] || PANEL_MODES.MOVE;
  }

  function getState() {
    refreshStatus();
    return clone({ ...state, messages });
  }

  function setLast(result, successCode) {
    state.lastResult = okWithCode(result, successCode);
    if (state.lastResult.rollbackComplete === false) state.lastResult.messageKey = "ROLLBACK_INCOMPLETE";
    refreshStatus();
  }

  async function run(operation, successCode) {
    if (state.busy) {
      state.lastResult = blocked(PANEL_ERROR_CODES.BUSY, "panel is busy.");
      emit();
      return getState();
    }
    state.busy = true;
    emit();
    try {
      setLast(await Promise.resolve().then(operation), successCode);
    } catch (error) {
      state.lastResult = blocked(PANEL_ERROR_CODES.UNKNOWN_ERROR, error.message || "unknown error.", { message: error.message });
    } finally {
      state.busy = false;
      emit();
    }
    return getState();
  }

  function inspectSelected() {
    if (!state.selectedElementId) return blocked(PANEL_ERROR_CODES.NO_SELECTION, "no element selected.");
    if (!isFn(runtime, "inspectElement")) {
      return blocked(PANEL_ERROR_CODES.UNKNOWN_ERROR, "runtime.inspectElement is required.");
    }
    try {
      return runtime.inspectElement(state.selectedElementId);
    } catch (error) {
      return blocked(PANEL_ERROR_CODES.UNKNOWN_ERROR, error.message || "inspect failed.");
    }
  }

  function effectiveLayoutFrom(inspectResult) {
    return clone(
      inspectResult.effectiveLayout ||
      inspectResult.currentValues ||
      (inspectResult.value && (inspectResult.value.effectiveLayout || inspectResult.value.currentValues)) ||
      inspectResult.currentEntry ||
      (inspectResult.value && inspectResult.value.currentEntry) ||
      { elementId: state.selectedElementId }
    );
  }

  function minFor(field) {
    const elementResult = safeRegistryGet(state.selectedElementId);
    if (!elementResult.ok) return elementResult;
    const limits = elementResult.value && elementResult.value.limits;
    const value = elementResult.value && (elementResult.value[field] ?? (limits && limits[field]));
    return { ok: true, value: Number.isFinite(value) ? value : undefined };
  }

  function createChange(direction) {
    if (!state.selectedElementId) return blocked(PANEL_ERROR_CODES.NO_SELECTION, "no element selected.");
    const activeModes = state.layer === PANEL_LAYERS.TEXT ? state.availableTextModes : state.availableModes;
    if (!activeModes.includes(state.mode)) return blocked(RUNTIME_ERROR_CODES.OPERATION_NOT_ALLOWED, "operation is not allowed.");

    const inspected = inspectSelected();
    if (inspected && inspected.ok === false) return inspected;
    const layout = effectiveLayoutFrom(inspected);
    const elementLayout = layout.element || layout;
    const textLayout = layout.text || {};
    const step = state.stepSize;
    let payload = {};

    if (state.mode === PANEL_MODES.MOVE) {
      if (direction === "left") payload = { x: (Number.isFinite(elementLayout.x) ? elementLayout.x : 0) - step };
      else if (direction === "right") payload = { x: (Number.isFinite(elementLayout.x) ? elementLayout.x : 0) + step };
      else if (direction === "up") payload = { y: (Number.isFinite(elementLayout.y) ? elementLayout.y : 0) - step };
      else if (direction === "down") payload = { y: (Number.isFinite(elementLayout.y) ? elementLayout.y : 0) + step };
      else return blocked(RUNTIME_ERROR_CODES.OPERATION_NOT_ALLOWED, "direction is not allowed for move.");
      if (state.modernOperations) payload = { element: payload };
      return runtime.applyChange({ elementId: state.selectedElementId, operation: "move", payload, source: "ui-editor-panel", changeId: `ui-editor-panel:${Date.now()}`, createdAt: new Date().toISOString() });
    }

    if (state.mode === PANEL_MODES.WIDTH) {
      if (!["left", "right"].includes(direction)) return blocked(RUNTIME_ERROR_CODES.OPERATION_NOT_ALLOWED, "direction is not allowed for width.");
      if (!Number.isFinite(elementLayout.width)) return blocked(PANEL_ERROR_CODES.CURRENT_VALUE_UNAVAILABLE, "current width is unavailable.", { field: "width" });
      const min = minFor("minWidth");
      if (!min.ok) return min;
      const max = minFor("maxWidth");
      const width = elementLayout.width + (direction === "left" ? -step : step);
      if (Number.isFinite(min.value) && width < min.value) return blocked("MIN_SIZE_REACHED", "minimum width reached.", { field: "width", min: min.value });
      if (Number.isFinite(max.value) && width > max.value) return blocked("MAX_SIZE_REACHED", "maximum width reached.", { field: "width", max: max.value });
      payload = state.modernOperations ? { element: { width } } : { width, ...(Number.isFinite(elementLayout.height) ? { height: elementLayout.height } : {}) };
      return runtime.applyChange({ elementId: state.selectedElementId, operation: state.effectiveOps.includes("resizeWidth") ? "resizeWidth" : "resize", payload, source: "ui-editor-panel", changeId: `ui-editor-panel:${Date.now()}`, createdAt: new Date().toISOString() });
    }

    if (state.mode === PANEL_MODES.HEIGHT) {
      if (!["up", "down"].includes(direction)) return blocked(RUNTIME_ERROR_CODES.OPERATION_NOT_ALLOWED, "direction is not allowed for height.");
      if (!Number.isFinite(elementLayout.height)) return blocked(PANEL_ERROR_CODES.CURRENT_VALUE_UNAVAILABLE, "current height is unavailable.", { field: "height" });
      const min = minFor("minHeight");
      if (!min.ok) return min;
      const max = minFor("maxHeight");
      const height = elementLayout.height + (direction === "up" ? -step : step);
      if (Number.isFinite(min.value) && height < min.value) return blocked("MIN_SIZE_REACHED", "minimum height reached.", { field: "height", min: min.value });
      if (Number.isFinite(max.value) && height > max.value) return blocked("MAX_SIZE_REACHED", "maximum height reached.", { field: "height", max: max.value });
      payload = state.modernOperations ? { element: { height } } : { height, ...(Number.isFinite(elementLayout.width) ? { width: elementLayout.width } : {}) };
      return runtime.applyChange({ elementId: state.selectedElementId, operation: state.effectiveOps.includes("resizeHeight") ? "resizeHeight" : "resize", payload, source: "ui-editor-panel", changeId: `ui-editor-panel:${Date.now()}`, createdAt: new Date().toISOString() });
    }

    if (state.mode === PANEL_MODES.TEXT_POSITION) {
      const currentX = Number.isFinite(textLayout.offsetX) ? textLayout.offsetX : 0;
      const currentY = Number.isFinite(textLayout.offsetY) ? textLayout.offsetY : 0;
      const limits = safeRegistryGet(state.selectedElementId).value?.limits || {};
      let offsetX = currentX, offsetY = currentY;
      if (direction === "left") offsetX -= step;
      else if (direction === "right") offsetX += step;
      else if (direction === "up") offsetY -= step;
      else if (direction === "down") offsetY += step;
      else return blocked(RUNTIME_ERROR_CODES.OPERATION_NOT_ALLOWED, "direction is not allowed for text position.");
      if (Number.isFinite(limits.minTextOffsetX)) offsetX = Math.max(offsetX, limits.minTextOffsetX);
      if (Number.isFinite(limits.maxTextOffsetX)) offsetX = Math.min(offsetX, limits.maxTextOffsetX);
      if (Number.isFinite(limits.minTextOffsetY)) offsetY = Math.max(offsetY, limits.minTextOffsetY);
      if (Number.isFinite(limits.maxTextOffsetY)) offsetY = Math.min(offsetY, limits.maxTextOffsetY);
      return runtime.applyChange({ elementId: state.selectedElementId, operation: "textMove", payload: { text: { offsetX, offsetY } }, source: "ui-editor-panel" });
    }

    if (state.mode === PANEL_MODES.TEXT_SIZE) {
      if (!["left", "right"].includes(direction)) return blocked(RUNTIME_ERROR_CODES.OPERATION_NOT_ALLOWED, "direction is not allowed for text size.");
      const current = Number.isFinite(textLayout.fontSize) ? textLayout.fontSize : 16;
      const min = minFor("minFontSize"), max = minFor("maxFontSize");
      const fontSize = current + (direction === "left" ? -step : step);
      if (Number.isFinite(min.value) && fontSize < min.value) return blocked("MIN_SIZE_REACHED", "minimum font size reached.");
      if (Number.isFinite(max.value) && fontSize > max.value) return blocked("MAX_SIZE_REACHED", "maximum font size reached.");
      return runtime.applyChange({ elementId: state.selectedElementId, operation: "textResize", payload: { text: { fontSize } }, source: "ui-editor-panel" });
    }

    return blocked(RUNTIME_ERROR_CODES.OPERATION_NOT_ALLOWED, "mode is not allowed.");
  }

  function invalidDialog() {
    state.lastResult = blocked(PANEL_ERROR_CODES.INVALID_DIALOG_STATE, "dialog is not open or has unexpected type.");
    emit();
    return getState();
  }

  return {
    selectElement(elementId) {
      const elementResult = safeRegistryGet(elementId);
      if (!elementResult.ok) {
        state.lastResult = elementResult;
        emit();
        return getState();
      }
      const element = elementResult.value;
      if (!element) {
        state.lastResult = blocked(RUNTIME_ERROR_CODES.UNKNOWN_ELEMENT, "unknown element.");
        emit();
        return getState();
      }
      const inspected = isFn(runtime, "inspectElement") ? (() => { try { return runtime.inspectElement(elementId); } catch (error) { return blocked(PANEL_ERROR_CODES.UNKNOWN_ERROR, error.message); } })() : null;
      if (inspected && inspected.ok === false && inspected.code === RUNTIME_ERROR_CODES.REGISTRY_READ_FAILED) {
        state.lastResult = inspected;
        emit();
        return getState();
      }
      applySelection(element, inspected);
      state.lastResult = inspected && inspected.ok === false ? inspected : null;
      emit();
      return getState();
    },
    clearSelection() {
      state.selectedElementId = null;
      state.selectedElementName = "";
      state.editable = false;
      state.allowedOps = [];
      state.effectiveOps = [];
      state.modernOperations = false;
      state.availableModes = [];
      state.availableTextModes = [];
      state.layer = PANEL_LAYERS.ELEMENT;
      state.lastResult = blocked(PANEL_ERROR_CODES.NO_SELECTION, "no element selected.");
      emit();
      return getState();
    },
    setMode(mode) {
      const available = state.layer === PANEL_LAYERS.TEXT ? state.availableTextModes : state.availableModes;
      if (!Object.values(PANEL_MODES).includes(mode) || !available.includes(mode)) {
        state.lastResult = blocked(RUNTIME_ERROR_CODES.OPERATION_NOT_ALLOWED, "mode is not available.");
      } else {
        state.mode = mode;
      }
      emit();
      return getState();
    },
    setLayer(layer) {
      if (layer === PANEL_LAYERS.TEXT && state.availableTextModes.length === 0) state.lastResult = blocked(RUNTIME_ERROR_CODES.OPERATION_NOT_ALLOWED, "text editing is not registered.");
      else if (!Object.values(PANEL_LAYERS).includes(layer)) state.lastResult = blocked(RUNTIME_ERROR_CODES.OPERATION_NOT_ALLOWED, "layer is not available.");
      else { state.layer = layer; const modes = layer === PANEL_LAYERS.TEXT ? state.availableTextModes : state.availableModes; state.mode = modes.includes(state.mode) ? state.mode : (modes[0] || PANEL_MODES.MOVE); }
      emit(); return getState();
    },
    setStepSize(stepSize) {
      state.stepSize = Math.max(1, Number(stepSize) || 5);
      emit();
      return getState();
    },
    activateDirection(direction) { return run(() => createChange(direction), "CHANGE_APPLIED"); },
    activateCenter() { return run(() => state.selectedElementId ? runtime.discardElementChanges(state.selectedElementId) : blocked(PANEL_ERROR_CODES.NO_SELECTION, "no element selected."), "ELEMENT_CHANGES_DISCARDED"); },
    save() { return run(() => runtime.saveLayout(), "LAYOUT_SAVED"); },
    load() { return run(() => runtime.loadLayout(), "LAYOUT_LOADED"); },
    discardAll() { return run(() => runtime.discardAllChanges(), "ALL_CHANGES_DISCARDED"); },
    close() { if (typeof cfg.onClose === "function") cfg.onClose(); return getState(); },
    requestResetElement() {
      if (!state.selectedElementId) state.lastResult = blocked(PANEL_ERROR_CODES.NO_SELECTION, "no element selected.");
      else state.dialog = { open: true, type: "reset-element", title: messages.get("RESET_ELEMENT_TITLE"), message: messages.get("RESET_ELEMENT_MESSAGE"), confirmLabel: "Element auf Standard zurücksetzen", cancelLabel: "Abbrechen", destructive: true, elementId: state.selectedElementId, elementName: state.selectedElementName };
      emit();
      return getState();
    },
    confirmResetElement() {
      if (!state.dialog || state.dialog.open !== true || state.dialog.type !== "reset-element" || typeof state.dialog.elementId !== "string") return invalidDialog();
      const elementId = state.dialog.elementId;
      state.dialog = { open: false };
      return run(() => runtime.resetElementToDefaults(elementId), "ELEMENT_RESET_TO_DEFAULTS");
    },
    cancelResetElement() { state.dialog = { open: false }; emit(); return getState(); },
    requestResetLayout() {
      state.dialog = { open: true, type: "reset-layout", title: messages.get("RESET_LAYOUT_TITLE"), message: messages.get("RESET_LAYOUT_MESSAGE"), confirmLabel: "Standardlayout wiederherstellen", cancelLabel: "Abbrechen", destructive: true };
      emit();
      return getState();
    },
    confirmResetLayout() {
      if (!state.dialog || state.dialog.open !== true || state.dialog.type !== "reset-layout") return invalidDialog();
      state.dialog = { open: false };
      return run(() => runtime.resetLayoutToDefaults(), "LAYOUT_RESET_TO_DEFAULTS");
    },
    cancelResetLayout() { state.dialog = { open: false }; emit(); return getState(); },
    refresh() { refreshStatus(); emit(); return getState(); },
    getState,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    destroy() { destroyed = true; listeners.clear(); },
  };
}

module.exports = { createUiEditorPanelController, PANEL_ERROR_CODES };

},
31:function(module,exports,__require){
"use strict";
const PANEL_LAYERS = Object.freeze({ ELEMENT: "element", TEXT: "text" });
const PANEL_MODES = Object.freeze({ MOVE: "move", WIDTH: "width", HEIGHT: "height", TEXT_POSITION: "text-position", TEXT_SIZE: "text-size" });
const PANEL_DIRECTIONS = Object.freeze({ UP: "up", DOWN: "down", LEFT: "left", RIGHT: "right", CENTER: "center" });
const PANEL_INTENTS = Object.freeze({
  SELECT_ELEMENT: "select-element", CLEAR_SELECTION: "clear-selection", SET_MODE: "set-mode", SET_STEP_SIZE: "set-step-size",
  SET_LAYER: "set-layer", CLOSE: "close-editor",
  DPAD_UP: "dpad-up", DPAD_DOWN: "dpad-down", DPAD_LEFT: "dpad-left", DPAD_RIGHT: "dpad-right", DPAD_CENTER: "dpad-center",
  SAVE: "save-layout", LOAD: "load-layout", DISCARD_ALL: "discard-all-session-changes",
  REQUEST_RESET_ELEMENT: "request-reset-element-defaults", CONFIRM_RESET_ELEMENT: "confirm-reset-element-defaults", CANCEL_RESET_ELEMENT: "cancel-reset-element-defaults",
  REQUEST_RESET_LAYOUT: "request-reset-layout-defaults", CONFIRM_RESET_LAYOUT: "confirm-reset-layout-defaults", CANCEL_RESET_LAYOUT: "cancel-reset-layout-defaults",
});
module.exports = { PANEL_LAYERS, PANEL_MODES, PANEL_DIRECTIONS, PANEL_INTENTS };

},
32:function(module,exports,__require){
"use strict";
const defaults = Object.freeze({
  NO_SELECTION: "Kein Element ausgewählt.", UNKNOWN_ELEMENT: "Element ist nicht registriert.", ELEMENT_NOT_EDITABLE: "Element ist nicht editierbar.",
  OPERATION_NOT_ALLOWED: "Operation ist nicht erlaubt.", CHANGE_APPLIED: "Änderung übernommen.", ELEMENT_CHANGES_DISCARDED: "Änderungen dieses Elements verworfen.",
  LAYOUT_SAVED: "Layout gespeichert.", LAYOUT_LOADED: "Layout geladen.", ALL_CHANGES_DISCARDED: "Alle Sitzungsänderungen verworfen.",
  ELEMENT_RESET_TO_DEFAULTS: "Element auf Standard zurückgesetzt.", LAYOUT_RESET_TO_DEFAULTS: "Standardlayout wiederhergestellt.",
  STORAGE_UNAVAILABLE: "Persistenz ist nicht verfügbar.", STORAGE_NOT_PERSISTENT: "Persistenz ist nicht dauerhaft.", ROLLBACK_INCOMPLETE: "Rollback unvollständig.",
  UNKNOWN_ERROR: "Unbekannter Fehler.", CURRENT_VALUE_UNAVAILABLE: "Aktueller Wert ist nicht verfügbar.", INVALID_DIALOG_STATE: "Dialog ist nicht offen oder passt nicht zur Aktion.", MIN_SIZE_REACHED: "Mindestgröße erreicht.", BUSY: "Bedienpanel ist beschäftigt.", IDLE: "Bereit.",
  RESET_ELEMENT_TITLE: "Element dauerhaft zurücksetzen", RESET_ELEMENT_MESSAGE: "Nur das ausgewählte Element wird dauerhaft auf den Standard zurückgesetzt. Andere Elemente bleiben unverändert.",
  RESET_LAYOUT_TITLE: "Standardlayout dauerhaft wiederherstellen", RESET_LAYOUT_MESSAGE: "Das gespeicherte Layout für aktuellen Scope und aktuelles Profil wird dauerhaft gelöscht.",
});
function createPanelMessageCatalog(overrides) {
  const messages = { ...defaults, ...(overrides || {}) };
  return Object.freeze({ get(key) { return messages[key] || messages.UNKNOWN_ERROR; }, messages: Object.freeze({ ...messages }) });
}
module.exports = { createPanelMessageCatalog };

},
33:function(module,exports,__require){
"use strict";
const { PANEL_LAYERS, PANEL_MODES, PANEL_INTENTS } = __require(31);
const { createPanelMessageCatalog } = __require(32);
function button(label, intent, enabled, reasonCode, extra) { return { enabled: !!enabled, visible: true, label, intent, ...(reasonCode ? { reasonCode } : {}), ...(extra || {}) }; }
function statusFrom(result, messages) {
  if (!result) return { kind: "idle", code: "IDLE", messageKey: "IDLE", message: messages.get("IDLE") };
  const code = result.code || (result.ok ? "OK" : "UNKNOWN_ERROR");
  const key = result.messageKey || code;
  const incomplete = result.rollbackComplete === false;
  const kind = incomplete ? "warning" : result.blocked ? "blocked" : result.ok === false ? "error" : "success";
  return { kind, code: incomplete ? "ROLLBACK_INCOMPLETE" : code, messageKey: incomplete ? "ROLLBACK_INCOMPLETE" : key, message: result.message || result.reason || messages.get(incomplete ? "ROLLBACK_INCOMPLETE" : key), ...(Object.prototype.hasOwnProperty.call(result,"rollbackComplete") ? { rollbackComplete: result.rollbackComplete } : {}), ...(result.rollbackErrors ? { details: result.rollbackErrors } : result.details ? { details: result.details } : {}) };
}
function createUiEditorPanelViewModel(options) {
  const cfg = options || {}; const state = cfg.controllerState || {}; let messages = state.messages || cfg.messages || createPanelMessageCatalog(); if (!messages || typeof messages.get !== "function") messages = createPanelMessageCatalog(messages && messages.messages ? messages.messages : messages);
  const selected = !!state.selectedElementId; const editable = selected && state.editable !== false;
  const elementModes = Array.isArray(state.availableModes) ? state.availableModes : [];
  const textModes = Array.isArray(state.availableTextModes) ? state.availableTextModes : [];
  const layer = state.layer || PANEL_LAYERS.ELEMENT;
  const availableModes = layer === PANEL_LAYERS.TEXT ? textModes : elementModes;
  const busy = !!state.busy; const persistence = cfg.persistenceStatus || state.persistenceStatus || { available: true, persistent: true };
  const enabledBase = selected && editable && !busy;
  const directionEnabled = (direction) => {
    if (!enabledBase) return false;
    if ([PANEL_MODES.MOVE, PANEL_MODES.TEXT_POSITION].includes(state.mode)) return true;
    if ([PANEL_MODES.WIDTH, PANEL_MODES.TEXT_SIZE].includes(state.mode)) return ["left", "right"].includes(direction);
    if (state.mode === PANEL_MODES.HEIGHT) return ["up", "down"].includes(direction);
    return false;
  };
  const dpad = {
    up: button("↑", PANEL_INTENTS.DPAD_UP, directionEnabled("up"), enabledBase ? undefined : "NO_SELECTION", { direction: "up", ariaLabel: "Nach oben" }),
    down: button("↓", PANEL_INTENTS.DPAD_DOWN, directionEnabled("down"), enabledBase ? undefined : "NO_SELECTION", { direction: "down", ariaLabel: "Nach unten" }),
    left: button("←", PANEL_INTENTS.DPAD_LEFT, directionEnabled("left"), enabledBase ? undefined : "NO_SELECTION", { direction: "left", ariaLabel: "Nach links oder kleiner" }),
    right: button("→", PANEL_INTENTS.DPAD_RIGHT, directionEnabled("right"), enabledBase ? undefined : "NO_SELECTION", { direction: "right", ariaLabel: "Nach rechts oder größer" }),
    center: button("↶", PANEL_INTENTS.DPAD_CENTER, enabledBase, enabledBase ? undefined : "NO_SELECTION", { direction: "center", ariaLabel: "Änderungen dieses Elements verwerfen" }),
  };
  const allModes = [
    { id: PANEL_MODES.MOVE, label: "Verschieben" }, { id: PANEL_MODES.WIDTH, label: "Breite" }, { id: PANEL_MODES.HEIGHT, label: "Höhe" },
    { id: PANEL_MODES.TEXT_POSITION, label: "Position" }, { id: PANEL_MODES.TEXT_SIZE, label: "Größe" },
  ];
  return {
    selection: { selected, elementId: state.selectedElementId || null, name: state.selectedElementName || "", editable, allowedOps: state.allowedOps || [], effectiveOps: state.effectiveOps || [], availableModes },
    layer,
    layers: [
      { id: PANEL_LAYERS.ELEMENT, label: "ELEMENT", enabled: enabledBase && elementModes.length > 0, active: layer === PANEL_LAYERS.ELEMENT },
      { id: PANEL_LAYERS.TEXT, label: "TEXT", enabled: enabledBase && textModes.length > 0, active: layer === PANEL_LAYERS.TEXT },
    ],
    modes: allModes.filter((mode) => layer === PANEL_LAYERS.TEXT ? mode.id.startsWith("text-") : !mode.id.startsWith("text-")).map((mode) => ({ ...mode, enabled: enabledBase && availableModes.includes(mode.id), active: state.mode === mode.id })),
    dpad, stepSize: state.stepSize || 5,
    actions: {
      save: button("Speichern", PANEL_INTENTS.SAVE, !busy && persistence.available && persistence.persistent, !persistence.available ? "STORAGE_UNAVAILABLE" : !persistence.persistent ? "STORAGE_NOT_PERSISTENT" : undefined),
      load: button("Laden", PANEL_INTENTS.LOAD, !busy && persistence.available, !persistence.available ? "STORAGE_UNAVAILABLE" : undefined),
      discardAll: button("Alle Änderungen verwerfen", PANEL_INTENTS.DISCARD_ALL, !busy),
      resetElement: button("Gespeicherte Elementwerte löschen", PANEL_INTENTS.REQUEST_RESET_ELEMENT, enabledBase && persistence.persistent, !persistence.persistent ? "STORAGE_NOT_PERSISTENT" : undefined),
      resetLayout: button("Gesamtes Layout zurücksetzen", PANEL_INTENTS.REQUEST_RESET_LAYOUT, !busy && persistence.persistent, !persistence.persistent ? "STORAGE_NOT_PERSISTENT" : undefined),
      close: button("Editor schließen", PANEL_INTENTS.CLOSE, !busy),
    },
    session: cfg.runtimeStatus || state.runtimeStatus || { active: false, changedCount: 0, changedElementIds: [] }, persistence, dialog: state.dialog || { open: false }, status: statusFrom(cfg.lastResult || state.lastResult, messages), busy,
  };
}
module.exports = { createUiEditorPanelViewModel, statusFrom };

},
34:function(module,exports,__require){
"use strict";
const { createUiEditorPanelViewModel } = __require(33);

function createUiEditorPanel(options) {
  const cfg = options || {};
  if (!cfg.controller) throw new Error("controller is required");
  if (!cfg.mountTarget) throw new Error("mountTarget is required");
  const doc = cfg.documentAdapter || cfg.mountTarget.ownerDocument || document;
  const win = cfg.windowAdapter || (typeof window !== "undefined" ? window : null);
  const root = doc.createElement("section");
  root.className = "ui-editor-panel-root";
  root.setAttribute("aria-label", "UI-Editor Bedienpanel");
  if (root.style) { root.style.position = "fixed"; root.style.zIndex = "2147483647"; }
  cfg.mountTarget.appendChild(root);
  let dialogReturnFocusKey = null, focusAfterRenderKey = null, destroyed = false;
  let position = { x: 16, y: 16 }, drag = null;

  function viewport() { return { width: Number(win && win.innerWidth) || 1280, height: Number(win && win.innerHeight) || 720 }; }
  function panelSize() { const rect = typeof root.getBoundingClientRect === "function" ? root.getBoundingClientRect() : null; return { width: Number(rect && rect.width) || 320, height: Number(rect && rect.height) || 420 }; }
  function clamp(candidate) { const view = viewport(), size = panelSize(); return { x: Math.max(0, Math.min(Number(candidate.x) || 0, Math.max(0, view.width - size.width))), y: Math.max(0, Math.min(Number(candidate.y) || 0, Math.max(0, view.height - size.height))) }; }
  function applyPosition(candidate, persist) {
    position = clamp(candidate);
    if (root.style) { root.style.left = `${position.x}px`; root.style.top = `${position.y}px`; }
    if (persist && cfg.positionStore && typeof cfg.positionStore.write === "function") cfg.positionStore.write(position);
    return { ...position };
  }
  const stored = cfg.positionStore && typeof cfg.positionStore.read === "function" ? cfg.positionStore.read() : null;
  applyPosition(stored && stored.ok && stored.value ? stored.value : (cfg.defaultPosition || position), false);

  function findByFocusKey(key) { const stack = [root]; while (stack.length) { const node = stack.shift(); if (node && node.dataset && node.dataset.focusKey === key) return node; if (node && node.children) Array.prototype.forEach.call(node.children, (child) => stack.push(child)); } return null; }
  function scheduleFocus(key) { focusAfterRenderKey = key; }
  function applyScheduledFocus() { if (!focusAfterRenderKey) return; const target = findByFocusKey(focusAfterRenderKey); focusAfterRenderKey = null; if (target && typeof target.focus === "function") target.focus(); }
  function button(model, onClick, focusKey) { const element = doc.createElement("button"); element.type = "button"; element.textContent = model.label; element.disabled = !model.enabled; element.dataset.intent = model.intent; if (focusKey) element.dataset.focusKey = focusKey; if (model.ariaLabel) element.setAttribute("aria-label", model.ariaLabel); element.addEventListener("click", onClick); return element; }
  function closeDialog(action) { scheduleFocus(dialogReturnFocusKey); return action(); }
  function stop(event) { if (event && typeof event.stopPropagation === "function") event.stopPropagation(); }
  root.addEventListener("click", stop);
  root.addEventListener("pointerdown", stop);

  function startDrag(event) {
    stop(event); if (event && typeof event.preventDefault === "function") event.preventDefault();
    drag = { pointerId: event.pointerId, startX: Number(event.clientX) || 0, startY: Number(event.clientY) || 0, origin: { ...position } };
    if (event.currentTarget && typeof event.currentTarget.setPointerCapture === "function" && event.pointerId != null) event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveDrag(event) { if (!drag || (drag.pointerId != null && event.pointerId != null && drag.pointerId !== event.pointerId)) return; stop(event); applyPosition({ x: drag.origin.x + (Number(event.clientX) || 0) - drag.startX, y: drag.origin.y + (Number(event.clientY) || 0) - drag.startY }, false); }
  function endDrag(event) { if (!drag) return; stop(event); drag = null; applyPosition(position, true); }
  function handleResize() { applyPosition(position, true); }
  if (win && typeof win.addEventListener === "function") { win.addEventListener("pointermove", moveDrag); win.addEventListener("pointerup", endDrag); win.addEventListener("resize", handleResize); }

  function render() {
    if (destroyed) return;
    const vm = createUiEditorPanelViewModel({ controllerState: cfg.controller.getState() });
    root.textContent = "";
    const header = doc.createElement("header"); header.className = "ui-editor-panel-handle"; header.textContent = "UI-Editor"; header.setAttribute("aria-label", "Bedienpanel verschieben"); header.addEventListener("pointerdown", startDrag); root.appendChild(header);
    const name = doc.createElement("div"); name.className = "ui-editor-panel-selection"; name.textContent = vm.selection.selected ? vm.selection.name : "Kein Element ausgewählt"; root.appendChild(name);
    const layers = doc.createElement("div"); layers.className = "ui-editor-panel-layers"; vm.layers.forEach((layer) => { const node = button({ label: layer.label, intent: "set-layer", enabled: layer.enabled }, () => cfg.controller.setLayer(layer.id), `layer:${layer.id}`); if (layer.active) node.setAttribute("aria-pressed", "true"); layers.appendChild(node); }); root.appendChild(layers);
    const modes = doc.createElement("div"); modes.className = "ui-editor-panel-modes"; vm.modes.forEach((mode) => { const node = button({ label: mode.label, intent: "set-mode", enabled: mode.enabled }, () => cfg.controller.setMode(mode.id), `mode:${mode.id}`); if (mode.active) node.setAttribute("aria-pressed", "true"); modes.appendChild(node); }); root.appendChild(modes);
    const dpad = doc.createElement("div"); dpad.className = "ui-editor-panel-dpad"; dpad.tabIndex = 0; dpad.setAttribute("role", "group"); dpad.setAttribute("aria-label", "Steuerkreuz");
    for (const direction of ["up", "left", "center", "right", "down"]) dpad.appendChild(button(vm.dpad[direction], () => direction === "center" ? cfg.controller.activateCenter() : cfg.controller.activateDirection(direction), `dpad:${direction}`));
    dpad.addEventListener("keydown", (event) => { const map = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" }; if (map[event.key]) { event.preventDefault(); cfg.controller.activateDirection(map[event.key]); } }); root.appendChild(dpad);
    const step = doc.createElement("label"); step.className = "ui-editor-panel-step"; step.textContent = "Schritt "; const input = doc.createElement("input"); input.type = "number"; input.min = "1"; input.value = String(vm.stepSize); input.setAttribute("aria-label", "Änderungsschritt"); input.addEventListener("change", () => cfg.controller.setStepSize(input.value)); step.appendChild(input); root.appendChild(step);
    const actions = doc.createElement("div"); actions.className = "ui-editor-panel-actions";
    actions.appendChild(button(vm.actions.save, () => cfg.controller.save(), "action:save")); actions.appendChild(button(vm.actions.load, () => cfg.controller.load(), "action:load")); actions.appendChild(button(vm.actions.discardAll, () => cfg.controller.discardAll(), "action:discardAll"));
    actions.appendChild(button(vm.actions.resetElement, () => { dialogReturnFocusKey = "action:resetElement"; scheduleFocus("dialog:cancel"); cfg.controller.requestResetElement(); }, "action:resetElement"));
    actions.appendChild(button(vm.actions.resetLayout, () => { dialogReturnFocusKey = "action:resetLayout"; scheduleFocus("dialog:cancel"); cfg.controller.requestResetLayout(); }, "action:resetLayout")); actions.appendChild(button(vm.actions.close, () => cfg.controller.close(), "action:close")); root.appendChild(actions);
    const status = doc.createElement("div"); status.className = `ui-editor-panel-status ui-editor-panel-status-${vm.status.kind}`; status.setAttribute("role", "status"); status.textContent = vm.status.message; root.appendChild(status);
    if (vm.dialog && vm.dialog.open) {
      const dialog = doc.createElement("div"); dialog.className = "ui-editor-panel-dialog"; dialog.setAttribute("role", "dialog"); dialog.setAttribute("aria-modal", "true");
      const title = doc.createElement("h2"); title.textContent = vm.dialog.title; dialog.appendChild(title); const message = doc.createElement("p"); message.textContent = vm.dialog.message; dialog.appendChild(message);
      const confirm = button({ label: vm.dialog.confirmLabel, enabled: true, intent: `confirm-${vm.dialog.type}` }, () => closeDialog(vm.dialog.type === "reset-element" ? cfg.controller.confirmResetElement : cfg.controller.confirmResetLayout), "dialog:confirm");
      const cancel = button({ label: vm.dialog.cancelLabel, enabled: true, intent: `cancel-${vm.dialog.type}` }, () => closeDialog(vm.dialog.type === "reset-element" ? cfg.controller.cancelResetElement : cfg.controller.cancelResetLayout), "dialog:cancel"); dialog.appendChild(confirm); dialog.appendChild(cancel);
      dialog.addEventListener("keydown", (event) => { if (event.key === "Escape") { event.preventDefault(); closeDialog(vm.dialog.type === "reset-element" ? cfg.controller.cancelResetElement : cfg.controller.cancelResetLayout); } }); root.appendChild(dialog);
    }
    applyPosition(position, false); applyScheduledFocus();
  }
  const unsubscribe = cfg.controller.subscribe(render); render();
  return { root, render, getPosition: () => ({ ...position }), setPosition: (value) => applyPosition(value, true), destroy() { destroyed = true; unsubscribe(); if (win && typeof win.removeEventListener === "function") { win.removeEventListener("pointermove", moveDrag); win.removeEventListener("pointerup", endDrag); win.removeEventListener("resize", handleResize); } root.remove(); } };
}

module.exports = { createUiEditorPanel };

},
35:function(module,exports,__require){
"use strict";

const PANEL_POSITION_VERSION = 1;

function validPosition(value) {
  return value && Number.isFinite(value.x) && Number.isFinite(value.y);
}

function createPanelPositionStore(options) {
  const cfg = options || {};
  const storage = cfg.storage;
  const namespace = cfg.namespace || "ui-editor-panel-position";
  const targetAppId = cfg.targetAppId || "default";
  const key = `${namespace}::${targetAppId}`;

  return Object.freeze({
    key,
    read() {
      if (!storage || typeof storage.getItem !== "function") return { ok: false, code: "PANEL_POSITION_STORAGE_UNAVAILABLE" };
      try {
        const raw = storage.getItem(key);
        if (raw == null) return { ok: true, value: null };
        const parsed = JSON.parse(raw);
        if (parsed.version !== PANEL_POSITION_VERSION || !validPosition(parsed.position)) return { ok: false, code: "INVALID_PANEL_POSITION" };
        return { ok: true, value: { x: parsed.position.x, y: parsed.position.y } };
      } catch (error) {
        return { ok: false, code: "PANEL_POSITION_READ_FAILED", reason: error.message };
      }
    },
    write(position) {
      if (!validPosition(position)) return { ok: false, code: "INVALID_PANEL_POSITION" };
      if (!storage || typeof storage.setItem !== "function") return { ok: false, code: "PANEL_POSITION_STORAGE_UNAVAILABLE" };
      try {
        storage.setItem(key, JSON.stringify({ version: PANEL_POSITION_VERSION, position: { x: position.x, y: position.y } }));
        return { ok: true };
      } catch (error) {
        return { ok: false, code: "PANEL_POSITION_WRITE_FAILED", reason: error.message };
      }
    },
  });
}

module.exports = { createPanelPositionStore, validPosition };

},
36:function(module,exports,__require){
"use strict";
const {BROWSER_ERROR_CODES,ok,blocked,isValidElementId,isElementRef}=__require(37);
function createElementRefRegistry(){const refs=new Map(); const listeners=new Set(); function emit(type,elementId,elementRef){listeners.forEach(l=>{try{l({type,elementId,elementRef});}catch(_){}});} return {register(elementId,elementRef){if(!isValidElementId(elementId))return blocked(BROWSER_ERROR_CODES.INVALID_ELEMENT_ID,"elementId must be a non-empty string."); if(!isElementRef(elementRef))return blocked(BROWSER_ERROR_CODES.INVALID_ELEMENT_REF,"elementRef must be HTMLElement-like."); if(refs.has(elementId))return blocked(BROWSER_ERROR_CODES.ELEMENT_REF_ALREADY_REGISTERED,"elementRef is already registered."); refs.set(elementId,elementRef); emit("register",elementId,elementRef); return ok(elementRef,{elementId});},unregister(elementId){if(!isValidElementId(elementId))return blocked(BROWSER_ERROR_CODES.INVALID_ELEMENT_ID,"elementId must be a non-empty string."); const existed=refs.delete(elementId); emit("unregister",elementId); return ok(undefined,{elementId,existed});},get(elementId){if(!isValidElementId(elementId))return blocked(BROWSER_ERROR_CODES.INVALID_ELEMENT_ID,"elementId must be a non-empty string."); if(!refs.has(elementId))return blocked(BROWSER_ERROR_CODES.ELEMENT_REF_MISSING,"elementRef is missing."); return ok(refs.get(elementId),{elementId});},has(elementId){return isValidElementId(elementId)&&refs.has(elementId);},listIds(){return Array.from(refs.keys());},clear(){refs.clear(); emit("clear"); return ok();},subscribe(listener){if(typeof listener!=="function")return ()=>{}; listeners.add(listener); return ()=>listeners.delete(listener);}};}
module.exports={createElementRefRegistry};

},
37:function(module,exports,__require){
"use strict";
const BROWSER_ERROR_CODES=Object.freeze({INVALID_ELEMENT_ID:"INVALID_ELEMENT_ID",INVALID_ELEMENT_REF:"INVALID_ELEMENT_REF",ELEMENT_REF_ALREADY_REGISTERED:"ELEMENT_REF_ALREADY_REGISTERED",ELEMENT_REF_MISSING:"ELEMENT_REF_MISSING",HOST_READ_FAILED:"HOST_READ_FAILED",HOST_APPLY_FAILED:"HOST_APPLY_FAILED",HOST_CAPTURE_FAILED:"HOST_CAPTURE_FAILED",HOST_CLEAR_FAILED:"HOST_CLEAR_FAILED",CURRENT_VALUE_UNAVAILABLE:"CURRENT_VALUE_UNAVAILABLE",OVERLAY_MOUNT_MISSING:"OVERLAY_MOUNT_MISSING",OVERLAY_MEASURE_FAILED:"OVERLAY_MEASURE_FAILED",STORAGE_UNAVAILABLE:"STORAGE_UNAVAILABLE",STORAGE_READ_FAILED:"STORAGE_READ_FAILED",STORAGE_WRITE_FAILED:"STORAGE_WRITE_FAILED",STORAGE_CLEAR_FAILED:"STORAGE_CLEAR_FAILED",STORAGE_PARSE_FAILED:"STORAGE_PARSE_FAILED",STORAGE_SCHEMA_UNSUPPORTED:"STORAGE_SCHEMA_UNSUPPORTED",BRIDGE_DESTROYED:"BRIDGE_DESTROYED",UNKNOWN_ELEMENT:"UNKNOWN_ELEMENT"});
function ok(value,extra){return {ok:true,...(value!==undefined?{value}:{}),...(extra||{})};}
function blocked(code,reason,extra){return {ok:false,blocked:true,code,messageKey:code,...(reason?{reason}:{}),...(extra||{})};}
function isValidElementId(id){return typeof id==="string"&&id.trim().length>0;}
function isElementRef(ref){return !!ref&&typeof ref==="object"&&typeof ref.style==="object"&&(typeof ref.getBoundingClientRect==="function"||typeof ref.hidden==="boolean"||"hidden" in ref);}
function safeCall(fn,code){try{return ok(fn());}catch(error){return blocked(code,error.message||code,{errorName:error.name});}}
module.exports={BROWSER_ERROR_CODES,ok,blocked,isValidElementId,isElementRef,safeCall};

},
38:function(module,exports,__require){
"use strict";

const {
  BROWSER_ERROR_CODES,
  ok,
  blocked,
  isValidElementId,
  isElementRef,
} = __require(37);

const EDITOR_X = "--ui-editor-x";
const EDITOR_Y = "--ui-editor-y";
const EDITOR_WIDTH = "--ui-editor-width";
const EDITOR_HEIGHT = "--ui-editor-height";
const EDITOR_VISIBLE = "--ui-editor-visible";
const TARGET_TRANSFORM = "--ui-editor-target-transform";
const TEXT_OFFSET_X = "--ui-editor-text-offset-x";
const TEXT_OFFSET_Y = "--ui-editor-text-offset-y";
const TEXT_FONT_SIZE = "--ui-editor-text-font-size";
const EDITOR_FIELDS = [EDITOR_X, EDITOR_Y, EDITOR_WIDTH, EDITOR_HEIGHT, EDITOR_VISIBLE, TARGET_TRANSFORM, TEXT_OFFSET_X, TEXT_OFFSET_Y, TEXT_FONT_SIZE];
const INLINE_FIELDS = ["transform", "width", "height", "textIndent", "paddingTop", "fontSize"];
const EMPTY_TRANSFORM = "";
const NONE_TRANSFORM = "none";

function px(value) {
  return `${Number(value) || 0}px`;
}

function toNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  const match = String(value || "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : undefined;
}

function getStyleValue(style, key) {
  if (!style) throw new Error("style is unavailable");
  if (typeof style.getPropertyValue === "function") return style.getPropertyValue(key);
  return style[key] || "";
}

function setStyleValue(style, key, value) {
  if (!style) throw new Error("style is unavailable");
  if (typeof style.setProperty === "function") style.setProperty(key, String(value));
  else style[key] = String(value);
}

function removeStyleValue(style, key) {
  if (!style) throw new Error("style is unavailable");
  if (typeof style.removeProperty === "function") style.removeProperty(key);
  else delete style[key];
}

function setInlineStyle(style, key, value) {
  if (!style) throw new Error("style is unavailable");
  style[key] = value || "";
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function normalizeTransform(value) {
  const transform = String(value || "").trim();
  return transform && transform.toLowerCase() !== NONE_TRANSFORM ? transform : EMPTY_TRANSFORM;
}

function readTransformValue(style) {
  if (!style) return EMPTY_TRANSFORM;
  const propertyValue = typeof style.getPropertyValue === "function" ? style.getPropertyValue("transform") : "";
  return propertyValue || style.transform || EMPTY_TRANSFORM;
}

function createBrowserHostAdapter(options) {
  const cfg = options || {};
  const refs = cfg.elementRefs;
  const rectReader = cfg.rectReader || ((element) => element.getBoundingClientRect());
  const computedStyleReader = cfg.computedStyleReader || ((element) => (
    cfg.windowAdapter && typeof cfg.windowAdapter.getComputedStyle === "function"
      ? cfg.windowAdapter.getComputedStyle(element)
      : null
  ));
  const originalByElement = new WeakMap();
  const registry = cfg.registry;

  function registeredOperations(elementId) {
    if (!registry || typeof registry.getElementById !== "function") return [];
    const definition = registry.getElementById(elementId);
    if (!definition) return [];
    if (definition.operations) return Object.keys(definition.operations).filter((key) => definition.operations[key] === true);
    return Array.isArray(definition.effectiveOps) ? definition.effectiveOps : (definition.allowedOps || []);
  }

  function getRef(elementId) {
    if (!isValidElementId(elementId)) return blocked(BROWSER_ERROR_CODES.INVALID_ELEMENT_ID, "invalid elementId");
    const result = refs && typeof refs.get === "function" ? refs.get(elementId) : null;
    const element = result && result.ok !== false ? (result.value || result) : null;
    if (!isElementRef(element)) return blocked(BROWSER_ERROR_CODES.ELEMENT_REF_MISSING, "elementRef is missing.");
    return ok(element);
  }

  function readVisibleState(element, elementId) {
    try {
      return ok({
        elementId,
        inlineStyles: INLINE_FIELDS.reduce((acc, field) => { acc[field] = element.style[field] || ""; return acc; }, {}),
        transform: element.style.transform || "",
        width: element.style.width || "",
        height: element.style.height || "",
        hidden: !!element.hidden,
        customProperties: EDITOR_FIELDS.reduce((acc, key) => {
          acc[key] = getStyleValue(element.style, key) || "";
          return acc;
        }, {}),
      });
    } catch (error) {
      return blocked(BROWSER_ERROR_CODES.HOST_READ_FAILED, error.message || "style read failed");
    }
  }

  function createHostSnapshot(element, elementId) {
    const visibleState = readVisibleState(element, elementId);
    if (!visibleState.ok) return visibleState;
    const hasOriginal = originalByElement.has(element);
    return ok({
      elementId,
      visibleState: visibleState.value,
      ownership: {
        hasOriginal,
        originalSnapshot: hasOriginal ? clone(originalByElement.get(element)) : null,
      },
    });
  }

  function normalizeHostSnapshot(snapshot) {
    if (snapshot && snapshot.visibleState && snapshot.ownership) return snapshot;
    return {
      elementId: snapshot && snapshot.elementId,
      visibleState: snapshot || {},
      ownership: { hasOriginal: false, originalSnapshot: null },
    };
  }

  function ensureOriginal(element, elementId) {
    if (originalByElement.has(element)) return ok(originalByElement.get(element));
    const snapshot = readOriginalState(element, elementId);
    if (!snapshot.ok) return snapshot;
    originalByElement.set(element, clone(snapshot.value));
    return snapshot;
  }

  function restoreSnapshot(element, snapshot) {
    try {
      const inlineStyles = snapshot.inlineStyles || snapshot;
      INLINE_FIELDS.forEach((field) => setInlineStyle(element.style, field, inlineStyles[field] || ""));
      element.hidden = !!snapshot.hidden;
      const customProperties = snapshot.customProperties || {};
      EDITOR_FIELDS.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(customProperties, key) && customProperties[key] !== "") {
          setStyleValue(element.style, key, customProperties[key]);
        } else {
          removeStyleValue(element.style, key);
        }
      });
      return ok();
    } catch (error) {
      return blocked(BROWSER_ERROR_CODES.HOST_APPLY_FAILED, error.message || "style restore failed");
    }
  }

  function readRect(element) {
    try {
      const rect = rectReader(element);
      const width = toNumber(rect && rect.width);
      const height = toNumber(rect && rect.height);
      if (!Number.isFinite(width) || !Number.isFinite(height) || width < 0 || height < 0) {
        return blocked(BROWSER_ERROR_CODES.CURRENT_VALUE_UNAVAILABLE, "rect width/height unavailable.");
      }
      return ok({ width, height, left: toNumber(rect.left) || 0, top: toNumber(rect.top) || 0 });
    } catch (error) {
      return blocked(BROWSER_ERROR_CODES.HOST_READ_FAILED, error.message || "rect read failed");
    }
  }

  function readComputed(element) {
    try {
      return ok(computedStyleReader ? computedStyleReader(element) : null);
    } catch (error) {
      return blocked(BROWSER_ERROR_CODES.HOST_READ_FAILED, error.message || "computed style read failed");
    }
  }

  function readOriginalState(element, elementId) {
    const snapshot = readVisibleState(element, elementId);
    if (!snapshot.ok) return snapshot;
    const inlineTransform = normalizeTransform(snapshot.value.transform);
    if (inlineTransform) {
      snapshot.value.transformBase = inlineTransform;
      snapshot.value.transformBaseSource = "inline";
      return snapshot;
    }
    const computed = readComputed(element);
    if (!computed.ok) return computed;
    const computedTransform = normalizeTransform(readTransformValue(computed.value));
    snapshot.value.transformBase = computedTransform;
    snapshot.value.transformBaseSource = computedTransform ? "computed" : "none";
    return snapshot;
  }

  function getCurrentEntry(elementId, element) {
    const rect = readRect(element);
    if (!rect.ok) return rect;
    const computed = readComputed(element);
    if (!computed.ok) return computed;
    try {
      const width = toNumber(getStyleValue(element.style, EDITOR_WIDTH))
        ?? toNumber(element.style.width)
        ?? toNumber(computed.value && computed.value.width)
        ?? rect.value.width;
      const height = toNumber(getStyleValue(element.style, EDITOR_HEIGHT))
        ?? toNumber(element.style.height)
        ?? toNumber(computed.value && computed.value.height)
        ?? rect.value.height;
      if (!Number.isFinite(width) || !Number.isFinite(height) || width < 0 || height < 0) {
        return blocked(BROWSER_ERROR_CODES.CURRENT_VALUE_UNAVAILABLE, "current size unavailable.");
      }
      const operations = registeredOperations(elementId);
      if (operations.some((operation) => ["resizeWidth", "resizeHeight", "textMove", "textResize"].includes(operation))) {
        const elementValues = {};
        if (operations.includes("move")) { elementValues.x = toNumber(getStyleValue(element.style, EDITOR_X)) || 0; elementValues.y = toNumber(getStyleValue(element.style, EDITOR_Y)) || 0; }
        if (operations.includes("resizeWidth")) elementValues.width = width;
        if (operations.includes("resizeHeight")) elementValues.height = height;
        if (operations.includes("show") || operations.includes("hide")) elementValues.visible = !(element.hidden === true || getStyleValue(element.style, EDITOR_VISIBLE) === "false");
        const result = { elementId };
        if (Object.keys(elementValues).length > 0) result.element = elementValues;
        if (operations.includes("textMove") || operations.includes("textResize")) {
          result.text = {
            offsetX: toNumber(getStyleValue(element.style, TEXT_OFFSET_X)) || 0,
            offsetY: toNumber(getStyleValue(element.style, TEXT_OFFSET_Y)) || 0,
            fontSize: toNumber(getStyleValue(element.style, TEXT_FONT_SIZE)) ?? toNumber(computed.value && computed.value.fontSize) ?? 16,
          };
        }
        return ok(result);
      }
      return ok({ elementId, x: toNumber(getStyleValue(element.style, EDITOR_X)) || 0, y: toNumber(getStyleValue(element.style, EDITOR_Y)) || 0, width, height, visible: !(element.hidden === true || getStyleValue(element.style, EDITOR_VISIBLE) === "false") });
    } catch (error) {
      return blocked(BROWSER_ERROR_CODES.HOST_READ_FAILED, error.message || "style read failed");
    }
  }

  function applyTransform(element, elementId) {
    const original = ensureOriginal(element, elementId);
    if (!original.ok) return original;
    const targetTransform = normalizeTransform(original.value.transformBase || original.value.transform || EMPTY_TRANSFORM);
    try {
      if (targetTransform) {
        setStyleValue(element.style, TARGET_TRANSFORM, targetTransform);
        element.style.transform = `var(${TARGET_TRANSFORM}) translate(var(${EDITOR_X}, 0px), var(${EDITOR_Y}, 0px))`;
      } else {
        removeStyleValue(element.style, TARGET_TRANSFORM);
        element.style.transform = `translate(var(${EDITOR_X}, 0px), var(${EDITOR_Y}, 0px))`;
      }
      return ok();
    } catch (error) {
      return blocked(BROWSER_ERROR_CODES.HOST_APPLY_FAILED, error.message || "transform apply failed");
    }
  }

  return {
    validateElementRef(elementId) {
      return getRef(elementId);
    },
    captureElementLayoutState(elementId) {
      const ref = getRef(elementId);
      if (!ref.ok) return ref;
      return createHostSnapshot(ref.value, elementId);
    },
    applyLayoutEntry(elementId, entry) {
      const ref = getRef(elementId);
      if (!ref.ok) return ref;
      const element = ref.value;
      const original = ensureOriginal(element, elementId);
      if (!original.ok) return original;
      try {
        const elementValues = entry.element || entry;
        const textValues = entry.text || {};
        if (Object.prototype.hasOwnProperty.call(elementValues, "x")) setStyleValue(element.style, EDITOR_X, px(elementValues.x));
        if (Object.prototype.hasOwnProperty.call(elementValues, "y")) setStyleValue(element.style, EDITOR_Y, px(elementValues.y));
        if (Object.prototype.hasOwnProperty.call(elementValues, "x") || Object.prototype.hasOwnProperty.call(elementValues, "y")) {
          const appliedTransform = applyTransform(element, elementId);
          if (!appliedTransform.ok) return appliedTransform;
        }
        if (Object.prototype.hasOwnProperty.call(elementValues, "width")) {
          setStyleValue(element.style, EDITOR_WIDTH, px(elementValues.width));
          element.style.width = px(elementValues.width);
        }
        if (Object.prototype.hasOwnProperty.call(elementValues, "height")) {
          setStyleValue(element.style, EDITOR_HEIGHT, px(elementValues.height));
          element.style.height = px(elementValues.height);
        }
        if (Object.prototype.hasOwnProperty.call(elementValues, "visible")) {
          setStyleValue(element.style, EDITOR_VISIBLE, elementValues.visible ? "true" : "false");
          element.hidden = elementValues.visible === false;
        }
        if (Object.prototype.hasOwnProperty.call(textValues, "offsetX")) {
          setStyleValue(element.style, TEXT_OFFSET_X, px(textValues.offsetX));
          element.style.textIndent = `var(${TEXT_OFFSET_X}, 0px)`;
        }
        if (Object.prototype.hasOwnProperty.call(textValues, "offsetY")) {
          setStyleValue(element.style, TEXT_OFFSET_Y, px(textValues.offsetY));
          element.style.paddingTop = `var(${TEXT_OFFSET_Y}, 0px)`;
        }
        if (Object.prototype.hasOwnProperty.call(textValues, "fontSize")) {
          setStyleValue(element.style, TEXT_FONT_SIZE, px(textValues.fontSize));
          element.style.fontSize = `var(${TEXT_FONT_SIZE})`;
        }
        return ok();
      } catch (error) {
        return blocked(BROWSER_ERROR_CODES.HOST_APPLY_FAILED, error.message || "layout apply failed");
      }
    },
    clearElementLayout(elementId) {
      const ref = getRef(elementId);
      if (!ref.ok) return ref;
      const original = originalByElement.get(ref.value);
      if (!original) return ok();
      const restored = restoreSnapshot(ref.value, original);
      if (restored.ok) originalByElement.delete(ref.value);
      return restored;
    },
    restoreElementLayoutState(elementId, snapshot) {
      const ref = getRef(elementId);
      if (!ref.ok) return ref;
      const hostSnapshot = normalizeHostSnapshot(snapshot || {});
      const restored = restoreSnapshot(ref.value, hostSnapshot.visibleState || {});
      if (!restored.ok) return restored;
      if (hostSnapshot.ownership && hostSnapshot.ownership.hasOriginal) {
        originalByElement.set(ref.value, clone(hostSnapshot.ownership.originalSnapshot));
      } else {
        originalByElement.delete(ref.value);
      }
      return ok();
    },
    getCurrentLayoutEntry(elementId) {
      const ref = getRef(elementId);
      return ref.ok ? getCurrentEntry(elementId, ref.value) : ref;
    },
    reapplyLayoutEntries(entries) {
      for (const entry of entries || []) {
        const applied = this.applyLayoutEntry(entry.elementId, entry);
        if (!applied.ok) return applied;
      }
      return ok();
    },
  };
}

module.exports = { createBrowserHostAdapter };

},
39:function(module,exports,__require){
"use strict";
const {BROWSER_ERROR_CODES,ok,blocked,isValidElementId}=__require(37);
function createBrowserSelectionHost(options){const cfg=options||{}; const listeners=new Set(); let destroyed=false; let selection={selectedElementId:null,selectedElementName:"",elementRefAvailable:false}; function emit(){if(!destroyed){const s={...selection}; listeners.forEach(l=>{try{l(s);}catch(_){}}); if(typeof cfg.onSelectionChange==="function")cfg.onSelectionChange(s);}} function getElement(id){try{if(cfg.registry&&typeof cfg.registry["getElementBy"+"Id"]==="function")return cfg.registry["getElementBy"+"Id"](id); if(cfg.registry&&typeof cfg.registry.get==="function"){const r=cfg.registry.get(id); return r&&r.ok!==false?r.value:null;}}catch(e){return undefined;} return null;} return {select(elementId){if(destroyed)return blocked("SELECTION_HOST_DESTROYED","selection host destroyed"); if(!isValidElementId(elementId))return blocked(BROWSER_ERROR_CODES.INVALID_ELEMENT_ID,"invalid elementId"); const element=getElement(elementId); if(!element)return blocked(BROWSER_ERROR_CODES.UNKNOWN_ELEMENT,"unknown element"); const ref=cfg.elementRefs&&cfg.elementRefs.get?cfg.elementRefs.get(elementId):null; const available=!!(ref&&ref.ok!==false&&(ref.value||ref)); if(!available)return blocked(BROWSER_ERROR_CODES.ELEMENT_REF_MISSING,"elementRef is missing."); selection={selectedElementId:elementId,selectedElementName:element.name||elementId,elementRefAvailable:available}; emit(); return ok(selection);},clear(){selection={selectedElementId:null,selectedElementName:"",elementRefAvailable:false}; emit(); return ok(selection);},getSelection(){return {...selection};},subscribe(listener){if(typeof listener!=="function")return ()=>{}; listeners.add(listener); return ()=>listeners.delete(listener);},destroy(){destroyed=true; listeners.clear();}};}
module.exports={createBrowserSelectionHost};

},
40:function(module,exports,__require){
"use strict";

const { BROWSER_ERROR_CODES, ok, blocked, isElementRef } = __require(37);

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function createBrowserOverlayHost(options) {
  const cfg = options || {};
  const mount = cfg.overlayMountTarget;
  const clock = cfg.clock || (() => Date.now());
  const rectReader = cfg.rectReader || ((element) => element.getBoundingClientRect());
  const windowAdapter = cfg.windowAdapter;
  const documentAdapter = cfg.documentAdapter || (mount && mount.ownerDocument);
  const theme = { color: "#f59e0b", width: "2px", zIndex: "2147483647", ...(cfg.theme || {}) };

  let overlayElement = null;
  let currentRef = null;
  let state = { visible: false, elementId: null, rect: null, lastUpdatedAt: null };
  const listeners = [];

  function createOverlayElement() {
    if (overlayElement) return overlayElement;
    if (!mount || typeof mount.appendChild !== "function") return null;
    overlayElement = documentAdapter && typeof documentAdapter.createElement === "function"
      ? documentAdapter.createElement("div")
      : { style: {}, remove() {} };
    overlayElement.className = "ui-editor-browser-overlay";
    Object.assign(overlayElement.style, {
      position: "absolute",
      pointerEvents: "none",
      boxSizing: "border-box",
      border: `${theme.width} solid ${theme.color}`,
      zIndex: String(theme.zIndex),
      display: "none",
    });
    mount.appendChild(overlayElement);
    return overlayElement;
  }

  function measure(elementRef) {
    try {
      const elementRect = rectReader(elementRef);
      const mountRect = mount && typeof mount.getBoundingClientRect === "function"
        ? mount.getBoundingClientRect()
        : { left: 0, top: 0 };
      const width = elementRect && elementRect.width;
      const height = elementRect && elementRect.height;
      if (!finiteNumber(width) || !finiteNumber(height) || width < 0 || height < 0) return null;
      return {
        left: (elementRect.left || 0) - (mountRect.left || 0) + (mount.scrollLeft || 0),
        top: (elementRect.top || 0) - (mountRect.top || 0) + (mount.scrollTop || 0),
        width,
        height,
      };
    } catch (_error) {
      return null;
    }
  }

  function applyRect(rect) {
    const node = createOverlayElement();
    if (!node) return blocked(BROWSER_ERROR_CODES.OVERLAY_MOUNT_MISSING, "overlay mount target is missing.");
    Object.assign(node.style, {
      display: "block",
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
    return ok();
  }

  function hide() {
    if (overlayElement) overlayElement.style.display = "none";
    state = { visible: false, elementId: null, rect: null, lastUpdatedAt: clock() };
    currentRef = null;
    return ok(state);
  }

  function update() {
    if (!state.visible || !currentRef) return ok(state);
    const rect = measure(currentRef);
    if (!rect) {
      hide();
      return blocked(BROWSER_ERROR_CODES.OVERLAY_MEASURE_FAILED, "overlay measure failed.");
    }
    const applied = applyRect(rect);
    if (!applied.ok) return applied;
    state = { visible: true, elementId: state.elementId, rect, lastUpdatedAt: clock() };
    return ok(state);
  }

  if (windowAdapter && typeof windowAdapter.addEventListener === "function") {
    ["resize", "scroll"].forEach((type) => {
      const listener = () => update();
      try {
        windowAdapter.addEventListener(type, listener);
        listeners.push([type, listener]);
      } catch (_error) {}
    });
  }

  return {
    show(elementId, elementRef) {
      if (!mount) return blocked(BROWSER_ERROR_CODES.OVERLAY_MOUNT_MISSING, "overlay mount target is missing.");
      if (!isElementRef(elementRef)) {
        hide();
        return blocked(BROWSER_ERROR_CODES.INVALID_ELEMENT_REF, "invalid elementRef");
      }
      currentRef = elementRef;
      state = { visible: true, elementId, rect: null, lastUpdatedAt: null };
      return update();
    },
    update,
    hide,
    getState() {
      return JSON.parse(JSON.stringify(state));
    },
    destroy() {
      listeners.splice(0).forEach(([type, listener]) => {
        try {
          if (windowAdapter && typeof windowAdapter.removeEventListener === "function") {
            windowAdapter.removeEventListener(type, listener);
          }
        } catch (_error) {}
      });
      if (overlayElement && typeof overlayElement.remove === "function") overlayElement.remove();
      overlayElement = null;
      currentRef = null;
      state = { visible: false, elementId: null, rect: null, lastUpdatedAt: clock() };
    },
  };
}

module.exports = { createBrowserOverlayHost };

},
41:function(module,exports,__require){
"use strict";

const { BROWSER_ERROR_CODES, ok, blocked, isValidElementId } = __require(37);

const SCHEMA_VERSION = 1;
const CONTEXT_KEYS = ["targetAppId", "moduleId", "scopeId", "layoutProfileId"];

function validContext(context) {
  return context && CONTEXT_KEYS.every((key) => typeof context[key] === "string" && context[key].trim().length > 0);
}

function sameContext(a, b) {
  return validContext(a) && validContext(b) && CONTEXT_KEYS.every((key) => a[key] === b[key]);
}

function containsDomRef(value, seen) {
  if (!value || typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (typeof value.getBoundingClientRect === "function" || (value.style && typeof value.style === "object")) return true;
  return Object.keys(value).some((key) => containsDomRef(value[key], seen));
}

function cloneJsonEntries(entries) {
  if (!Array.isArray(entries)) return null;
  if (entries.some((entry) => containsDomRef(entry, new Set()))) return null;
  try {
    return JSON.parse(JSON.stringify(entries));
  } catch (_error) {
    return null;
  }
}

function createBrowserLayoutStorage(options) {
  const cfg = options || {};
  const storage = cfg.storage;
  const namespace = cfg.namespace || "ui-editor-layout";
  const clock = cfg.clock || (() => new Date().toISOString());

  function available() {
    return !!(
      storage &&
      typeof storage.getItem === "function" &&
      typeof storage.setItem === "function" &&
      typeof storage.removeItem === "function"
    );
  }

  function validateStorage() {
    return available() ? ok() : blocked(BROWSER_ERROR_CODES.STORAGE_UNAVAILABLE, "storage unavailable");
  }

  function validateContext(context) {
    return validContext(context) ? ok() : blocked("INVALID_TARGET_CONTEXT", "invalid context");
  }

  function key(context) {
    return `${namespace}::${context.targetAppId}::${context.moduleId}::${context.scopeId}::${context.layoutProfileId}`;
  }

  function readResult(context) {
    const storageResult = validateStorage();
    if (!storageResult.ok) return storageResult;
    const contextResult = validateContext(context);
    if (!contextResult.ok) return contextResult;
    let raw;
    try {
      raw = storage.getItem(key(context));
    } catch (error) {
      return blocked(BROWSER_ERROR_CODES.STORAGE_READ_FAILED, error.message || "read failed");
    }
    if (raw == null) return ok({ schemaVersion: SCHEMA_VERSION, context, entries: [], savedAt: null });
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      return blocked(BROWSER_ERROR_CODES.STORAGE_PARSE_FAILED, error.message || "parse failed");
    }
    if (parsed.schemaVersion !== SCHEMA_VERSION) {
      return blocked(BROWSER_ERROR_CODES.STORAGE_SCHEMA_UNSUPPORTED, "unsupported schemaVersion");
    }
    if (!sameContext(parsed.context, context) || !Array.isArray(parsed.entries)) {
      return blocked(BROWSER_ERROR_CODES.STORAGE_READ_FAILED, "stored payload does not match context/schema");
    }
    return ok(parsed);
  }

  function write(context, entries) {
    const storageResult = validateStorage();
    if (!storageResult.ok) return storageResult;
    const contextResult = validateContext(context);
    if (!contextResult.ok) return contextResult;
    const jsonEntries = cloneJsonEntries(entries);
    if (!jsonEntries) return blocked(BROWSER_ERROR_CODES.STORAGE_WRITE_FAILED, "entries must be JSON data without DOM refs");
    const payload = { schemaVersion: SCHEMA_VERSION, context: { ...context }, entries: jsonEntries, savedAt: clock() };
    try {
      storage.setItem(key(context), JSON.stringify(payload));
      return ok(payload);
    } catch (error) {
      return blocked(BROWSER_ERROR_CODES.STORAGE_WRITE_FAILED, error.message || "write failed");
    }
  }

  function clear(context) {
    const storageResult = validateStorage();
    if (!storageResult.ok) return storageResult;
    const contextResult = validateContext(context);
    if (!contextResult.ok) return contextResult;
    try {
      storage.removeItem(key(context));
      return ok();
    } catch (error) {
      return blocked(BROWSER_ERROR_CODES.STORAGE_CLEAR_FAILED, error.message || "clear failed");
    }
  }

  function deleteEntry(context, elementId) {
    const contextResult = validateContext(context);
    if (!contextResult.ok) return contextResult;
    if (!isValidElementId(elementId)) return blocked(BROWSER_ERROR_CODES.INVALID_ELEMENT_ID, "invalid elementId");
    const read = readResult(context);
    if (!read.ok) return read;
    const nextEntries = read.value.entries.filter((entry) => !entry || entry.elementId !== elementId);
    if (nextEntries.length === read.value.entries.length) return ok(read.value, { deleted: false });
    const written = write(context, nextEntries);
    return written.ok ? ok(written.value, { deleted: true }) : written;
  }

  return {
    available: available(),
    persistent: available(),
    getKey: key,
    readResult,
    write,
    clear,
    deleteEntry,
  };
}

module.exports = { createBrowserLayoutStorage };

},
42:function(module,exports,__require){
"use strict";

const { BROWSER_ERROR_CODES, ok, blocked } = __require(37);

function createUiEditorBrowserBridge(options) {
  const cfg = options || {};
  let destroyed = false;
  let suppressControllerSelectionEmission = false;
  let lastControllerSignature = null;
  const unsubs = [];

  function getSelection() {
    return cfg.selectionHost && typeof cfg.selectionHost.getSelection === "function"
      ? cfg.selectionHost.getSelection()
      : { selectedElementId: null };
  }

  function ref(elementId) {
    const result = cfg.elementRefs && typeof cfg.elementRefs.get === "function" ? cfg.elementRefs.get(elementId) : null;
    return result && result.ok !== false ? result.value : null;
  }

  function updateOverlay() {
    if (destroyed) return blocked(BROWSER_ERROR_CODES.BRIDGE_DESTROYED, "bridge destroyed");
    const selection = getSelection();
    if (selection.selectedElementId && cfg.overlayHost && typeof cfg.overlayHost.update === "function") {
      return cfg.overlayHost.update();
    }
    return ok();
  }

  function showSelection(elementId) {
    if (cfg.controller && typeof cfg.controller.selectElement === "function") cfg.controller.selectElement(elementId);
    if (cfg.overlayHost && typeof cfg.overlayHost.show === "function") cfg.overlayHost.show(elementId, ref(elementId));
  }

  function clearSelection() {
    if (cfg.controller && typeof cfg.controller.clearSelection === "function") cfg.controller.clearSelection();
    if (cfg.overlayHost && typeof cfg.overlayHost.hide === "function") cfg.overlayHost.hide();
  }

  function controllerSignature(state) {
    const result = state && state.lastResult;
    return JSON.stringify({
      selectedElementId: state && state.selectedElementId,
      busy: !!(state && state.busy),
      changedCount: state && state.runtimeStatus && state.runtimeStatus.changedCount,
      changedElementIds: state && state.runtimeStatus && state.runtimeStatus.changedElementIds,
      code: result && result.code,
      ok: result && result.ok,
      rollbackComplete: result && result.rollbackComplete,
      dialogOpen: state && state.dialog && state.dialog.open,
    });
  }

  if (cfg.selectionHost && typeof cfg.selectionHost.subscribe === "function") {
    unsubs.push(cfg.selectionHost.subscribe((selection) => {
      if (destroyed) return;
      suppressControllerSelectionEmission = true;
      if (selection.selectedElementId) showSelection(selection.selectedElementId);
      else clearSelection();
      suppressControllerSelectionEmission = false;
    }));
  }

  if (cfg.controller && typeof cfg.controller.subscribe === "function") {
    unsubs.push(cfg.controller.subscribe((state) => {
      if (destroyed) return;
      const signature = controllerSignature(state);
      if (signature === lastControllerSignature) return;
      lastControllerSignature = signature;
      if (suppressControllerSelectionEmission) return;
      if (!state || state.busy) return;
      if (!state.selectedElementId) return;
      updateOverlay();
    }));
  }

  return {
    updateOverlay,
    afterLayoutChange: updateOverlay,
    afterLoad: updateOverlay,
    afterReset: updateOverlay,
    afterDiscard: updateOverlay,
    afterReapply: updateOverlay,
    clearSelection() {
      if (destroyed) return blocked(BROWSER_ERROR_CODES.BRIDGE_DESTROYED, "bridge destroyed");
      if (cfg.selectionHost && typeof cfg.selectionHost.clear === "function") cfg.selectionHost.clear();
      return ok();
    },
    destroy() {
      destroyed = true;
      unsubs.splice(0).forEach((unsubscribe) => {
        try { unsubscribe(); } catch (_error) {}
      });
      if (cfg.overlayHost && typeof cfg.overlayHost.hide === "function") cfg.overlayHost.hide();
    },
  };
}

module.exports = { createUiEditorBrowserBridge };

},
43:function(module,exports,__require){
"use strict";

const ELEMENTS = Object.freeze([
  { id: "demo.card", name: "Demo-Karte", type: "component", role: "content", parentId: "demo.root", order: 1, visible: true, editable: true, allowedOps: ["move", "resize", "show", "hide"], lockedOps: [], effectiveOps: ["move", "resize", "show", "hide"], minWidth: 160, minHeight: 110 },
  { id: "demo.heading", name: "Demo-Überschrift", type: "component", role: "content", parentId: "demo.root", order: 2, visible: true, editable: true, allowedOps: ["move", "show", "hide"], lockedOps: ["resize"], effectiveOps: ["move", "show", "hide"] },
  { id: "demo.action", name: "Demo-Aktion", type: "button", role: "action", parentId: "demo.root", order: 3, visible: true, editable: true, allowedOps: ["move", "resize", "show", "hide"], lockedOps: [], effectiveOps: ["move", "resize", "show", "hide"], minWidth: 120, minHeight: 44 },
  { id: "demo.info", name: "Demo-Info", type: "component", role: "status", parentId: "demo.root", order: 4, visible: true, editable: true, allowedOps: ["resize", "show", "hide"], lockedOps: ["move"], effectiveOps: ["resize", "show", "hide"], minWidth: 180, minHeight: 80 },
  { id: "demo.locked", name: "Demo gesperrt", type: "component", role: "system", parentId: "demo.root", order: 5, visible: true, editable: false, allowedOps: ["show", "hide"], lockedOps: ["move", "resize"], effectiveOps: ["show", "hide"], minWidth: 100, minHeight: 40 },
]);

function createReferenceRegistry() {
  const byId = new Map(ELEMENTS.map((element) => [element.id, { ...element, allowedOps: element.allowedOps.slice(), lockedOps: element.lockedOps.slice(), effectiveOps: element.effectiveOps.slice() }]));
  return Object.freeze({
    getElementById(id) { return byId.get(id) || null; },
    listElements() { return Array.from(byId.values()).map((element) => ({ ...element, allowedOps: element.allowedOps.slice(), lockedOps: element.lockedOps.slice(), effectiveOps: element.effectiveOps.slice() })); },
  });
}

module.exports = { ELEMENTS, createReferenceRegistry };

},
44:function(module,exports,__require){
"use strict";

const REFERENCE_PROFILES = Object.freeze(["default", "compact"]);

function createReferenceTargetContext(profileId) {
  const layoutProfileId = REFERENCE_PROFILES.includes(profileId) ? profileId : "default";
  return Object.freeze({
    targetAppId: "ui-editor-reference",
    moduleId: "browser-demo",
    scopeId: "main",
    layoutProfileId,
  });
}

module.exports = { REFERENCE_PROFILES, createReferenceTargetContext };

}};const __cache={};function __require(id){if(__cache[id])return __cache[id].exports;const module={exports:{}};__cache[id]=module;__modules[id](module,module.exports,__require);return module.exports;}const app=__require(0);if(typeof window!=="undefined")window.createReferenceApp=app.createReferenceApp;})();
