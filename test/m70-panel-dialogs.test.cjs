"use strict";
const { assert, setup } = require("./m70-test-helpers.cjs");
const { createUiEditorPanelController } = require("../src/index.cjs");

(async () => {
  const { registry, runtime, storage } = setup();
  const controller = createUiEditorPanelController({ runtime, registry });
  controller.selectElement("demo.card");
  controller.requestResetElement();
  assert.equal(controller.getState().dialog.type, "reset-element");
  controller.cancelResetElement();
  assert.equal(controller.getState().dialog.open, false);
  assert.equal(storage.calls.filter((call) => call[0] === "delete").length, 0);
  controller.requestResetElement();
  await controller.confirmResetElement();
  assert.equal(storage.calls.filter((call) => call[0] === "delete").length, 1);
  controller.requestResetLayout();
  assert.equal(controller.getState().dialog.type, "reset-layout");
  await controller.confirmResetLayout();
  assert.equal(storage.calls.some((call) => call[0] === "clear"), true);

  let elementResetCalls = 0;
  let layoutResetCalls = 0;
  const guardedRuntime = {
    getSessionStatus() { return { ok: true, active: true, changedCount: 0, changedElementIds: [] }; },
    getPersistenceStatus() { return { available: true, persistent: true }; },
    inspectElement() { return { ok: true, allowedOps: ["move"], effectiveOps: ["move"], currentEntry: { elementId: "demo.card" }, effectiveLayout: { elementId: "demo.card" } }; },
    resetElementToDefaults() { elementResetCalls += 1; return { ok: true }; },
    resetLayoutToDefaults() { layoutResetCalls += 1; return { ok: true }; },
  };
  const guarded = createUiEditorPanelController({ runtime: guardedRuntime, registry });
  guarded.selectElement("demo.card");
  guarded.confirmResetElement();
  assert.equal(guarded.getState().lastResult.code, "INVALID_DIALOG_STATE");
  assert.equal(elementResetCalls, 0);
  guarded.requestResetElement();
  guarded.confirmResetLayout();
  assert.equal(guarded.getState().lastResult.code, "INVALID_DIALOG_STATE");
  assert.equal(layoutResetCalls, 0);

  console.log("m70 panel dialogs ok");
})();
