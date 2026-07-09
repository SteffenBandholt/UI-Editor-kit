"use strict";

const { getEditorStatusMessage } = require("./editor-status-messages.cjs");

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
