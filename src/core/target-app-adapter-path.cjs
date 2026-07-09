"use strict";

const { createEditorCore } = require("./editor-core.cjs");
const { validateHostAdapterContract } = require("./host-adapter-contract.cjs");
const { validateTargetAppAdapterManifest } = require("./target-app-adapter-manifest.cjs");
const { createEditorRuntimeLauncher } = require("./editor-runtime-launcher.cjs");
const { createEditorRuntimeStatusViewModel } = require("./editor-runtime-status-view-model.cjs");
const { createEditorScopeViewModel } = require("./editor-scope-view-model.cjs");
const { createEditorSelectionViewModel } = require("./editor-selection-view-model.cjs");
const { createEditorLayoutControlViewModel } = require("./editor-layout-control-view-model.cjs");
const { createMemoryLayoutStateStore } = require("./layout-state-store.cjs");

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
