"use strict";

const {
  validateTargetAppAdapterPath,
  createTargetAppAdapterRuntime,
  getTargetAppAdapterPathSummary,
} = require("./core/target-app-adapter-path.cjs");
const { createEditorRuntimeLauncher } = require("./core/editor-runtime-launcher.cjs");
const { createEditorRuntimeStatusViewModel } = require("./core/editor-runtime-status-view-model.cjs");
const { createEditorSelectionViewModel } = require("./core/editor-selection-view-model.cjs");
const { createEditorScopeViewModel } = require("./core/editor-scope-view-model.cjs");
const { createEditorLayoutControlViewModel } = require("./core/editor-layout-control-view-model.cjs");
const {
  validateLayoutState,
  normalizeLayoutState,
  createLayoutState,
  getLayoutStateProfileKey,
  assertCompatibleLayoutProfile,
} = require("./core/layout-state-contract.cjs");
const { createMemoryLayoutStateStore } = require("./core/layout-state-store.cjs");
const {
  SELECTION_CONTRACT_VERSION,
  SelectionContractErrorCodes,
  validateSelectionTargetContract,
  validateElementRefResolver,
} = require("./contracts/selectionTargetContract.js");
const { createSelectionController, SelectionRuntimeErrorCodes } = require("./selection/selectionController.js");
const { createHoverOverlay } = require("./selection/hoverOverlay.js");
const { createSelectedOverlay } = require("./selection/selectedOverlay.js");
const { resolveSelectionTarget } = require("./selection/targetResolver.js");
const {
  validateSelectionHost,
  validateSelectionControllerContract,
  createSelectionStateSnapshot,
} = require("./contracts/selectionControllerContract.js");

module.exports = Object.freeze({
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
