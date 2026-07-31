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
const { validateLayoutEntryForElement } = require("./runtime/ui-editor-runtime.cjs");
const { createUiEditorRuntime } = require("./runtime/step-validating-ui-editor-runtime.cjs");
const { createUiEditorPanelController } = require("./panel/ui-editor-panel-controller.cjs");
const { createUiEditorPanelViewModel } = require("./panel/ui-editor-panel-view-model.cjs");
const { createPanelMessageCatalog } = require("./panel/panel-message-catalog.cjs");
const { PANEL_INTENTS, PANEL_LAYERS, PANEL_MODES, PANEL_DIRECTIONS } = require("./panel/panel-intents.cjs");
const { createPanelPositionStore } = require("./panel/panel-position-store.cjs");
const { RUNTIME_ERROR_CODES } = require("./runtime/runtime-error-codes.cjs");
const { normalizeTargetContext, validateTargetContext } = require("./runtime/runtime-context.cjs");
const { normalizeLayoutEntry } = require("./runtime/session-state.cjs");
const { resolveOperationStep } = require("./runtime/operation-step-resolver.cjs");
const electronTargetContract = require("./electron-target/electron-target-contract.cjs");
const localTargetProtocol = require("./electron-target/local-target-protocol.cjs");
const electronErrorCodes = require("./electron-target/electron-error-codes.cjs");
const namedPipeClient = require("./electron-target/named-pipe-client.cjs");
const targetRegistration = require("./electron-target/target-registration.cjs");
const pdfTargetContract = require("./electron-target/pdf-target-contract.cjs");
const layoutProfileStartup = require("./electron-target/layout-profile-startup.cjs");
const geometryRiskContract = require("./core/geometry-risk-contract.cjs");
const spacingContract = require("./core/spacing-contract.cjs");
const tableLayoutContract = require("./core/table-layout-contract.cjs");
const uiTopologyFingerprint = require("./core/ui-topology-fingerprint.cjs");
const textResizeContract = require("./core/text-resize-contract.cjs");

module.exports = Object.freeze({
  createUiEditorRuntime,
  validateLayoutEntryForElement,
  createUiEditorPanelController,
  createUiEditorPanelViewModel,
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
  resolveOperationStep,
  ...electronTargetContract,
  ...localTargetProtocol,
  ...electronErrorCodes,
  ...namedPipeClient,
  ...targetRegistration,
  ...pdfTargetContract,
  ...layoutProfileStartup,
  ...geometryRiskContract,
  ...spacingContract,
  ...tableLayoutContract,
  ...uiTopologyFingerprint,
  ...textResizeContract,
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
});
