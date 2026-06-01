"use strict";

const EDITOR_UI_MODES = Object.freeze(["tree", "details", "changeDraft"]);

function cloneNeutralValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneNeutralValue(entry));
  }

  if (value && typeof value === "object") {
    const clone = {};
    Object.keys(value).forEach((key) => {
      clone[key] = cloneNeutralValue(value[key]);
    });
    return clone;
  }

  return value;
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertMode(mode) {
  if (!EDITOR_UI_MODES.includes(mode)) {
    throw new TypeError(`Unbekannter Editor-UI-Modus: ${mode}`);
  }
}

function normalizeExpandedElementIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(value.filter((entry) => typeof entry === "string")));
}

function normalizeInitialValues(initialValues) {
  if (initialValues === undefined || initialValues === null) {
    return {};
  }

  if (!isObject(initialValues)) {
    throw new TypeError("Editor-UI-State-Initialwerte muessen ein Objekt sein.");
  }

  return cloneNeutralValue(initialValues);
}

function createEditorUiState(initialValues) {
  const normalizedInitialValues = normalizeInitialValues(initialValues);
  const initialMode = normalizedInitialValues.mode || "tree";
  assertMode(initialMode);

  let state = {
    selectedElementId: normalizedInitialValues.selectedElementId || null,
    expandedElementIds: normalizeExpandedElementIds(normalizedInitialValues.expandedElementIds),
    lastError: normalizedInitialValues.lastError === undefined ? null : cloneNeutralValue(normalizedInitialValues.lastError),
    mode: initialMode,
  };

  function getState() {
    return cloneNeutralValue(state);
  }

  function selectElement(elementId) {
    state = {
      ...state,
      selectedElementId: elementId === undefined ? null : cloneNeutralValue(elementId),
    };
    return getState();
  }

  function clearSelection() {
    state = {
      ...state,
      selectedElementId: null,
    };
    return getState();
  }

  function expandElement(elementId) {
    if (typeof elementId !== "string" || elementId.trim() === "") {
      throw new TypeError("expandElement erwartet eine nicht leere Element-ID.");
    }

    if (!state.expandedElementIds.includes(elementId)) {
      state = {
        ...state,
        expandedElementIds: state.expandedElementIds.concat(elementId),
      };
    }

    return getState();
  }

  function collapseElement(elementId) {
    state = {
      ...state,
      expandedElementIds: state.expandedElementIds.filter((entry) => entry !== elementId),
    };
    return getState();
  }

  function isExpanded(elementId) {
    return state.expandedElementIds.includes(elementId);
  }

  function setMode(mode) {
    assertMode(mode);
    state = {
      ...state,
      mode,
    };
    return getState();
  }

  function setError(error) {
    state = {
      ...state,
      lastError: cloneNeutralValue(error),
    };
    return getState();
  }

  function clearError() {
    state = {
      ...state,
      lastError: null,
    };
    return getState();
  }

  return {
    getState,
    selectElement,
    clearSelection,
    expandElement,
    collapseElement,
    isExpanded,
    setMode,
    setError,
    clearError,
  };
}

module.exports = {
  EDITOR_UI_MODES,
  createEditorUiState,
};
