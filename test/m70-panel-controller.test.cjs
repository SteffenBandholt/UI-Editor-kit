"use strict";
const { assert, setup } = require("./m70-test-helpers.cjs");
const { createUiEditorPanelController } = require("../src/index.cjs");

(async () => {
  const { registry, host, runtime, storage } = setup();
  const controller = createUiEditorPanelController({ runtime, registry });
  assert.equal(controller.getState().selectedElementId, null);

  controller.selectElement("demo.card");
  assert.equal(controller.getState().selectedElementName, "Card");
  assert.deepEqual(controller.getState().availableModes, ["move"]);
  controller.setMode("width");
  assert.equal(controller.getState().lastResult.code, "OPERATION_NOT_ALLOWED");
  await controller.activateDirection("right");
  assert.equal(host.dump()["demo.card"].x, 5);
  await controller.activateDirection("up");
  assert.equal(host.dump()["demo.card"].y, -5);

  controller.selectElement("demo.table");
  assert.deepEqual(controller.getState().availableModes, ["width", "height"]);
  assert.equal(controller.getState().mode, "width");
  await controller.activateDirection("right");
  assert.equal(host.dump()["demo.table"].width, 25);
  await controller.activateDirection("up");
  assert.equal(controller.getState().lastResult.code, "OPERATION_NOT_ALLOWED");
  controller.setMode("height");
  controller.setStepSize(3);
  await controller.activateDirection("down");
  assert.equal(host.dump()["demo.table"].height, 23);
  await controller.activateCenter();
  assert.equal(storage.calls.some((call) => call[0] === "write" || call[0] === "clear" || call[0] === "delete"), false);
  assert.equal(host.dump()["demo.table"].width, 20);

  controller.selectElement("missing");
  assert.equal(controller.getState().lastResult.code, "UNKNOWN_ELEMENT");
  controller.selectElement("demo.locked");
  assert.equal(controller.getState().editable, false);

  const naturalWidth = setup({ "demo.table": { elementId: "demo.table", width: 200, height: 50 } });
  const naturalWidthController = createUiEditorPanelController({ runtime: naturalWidth.runtime, registry: naturalWidth.registry });
  naturalWidthController.selectElement("demo.table");
  await naturalWidthController.activateDirection("right");
  assert.equal(naturalWidth.host.dump()["demo.table"].width, 205);

  const missingWidthRuntime = {
    getSessionStatus() { return { ok: true, active: true, changedCount: 0, changedElementIds: [] }; },
    getPersistenceStatus() { return { available: true, persistent: true }; },
    inspectElement() { return { ok: true, currentEntry: { elementId: "demo.table" }, effectiveLayout: { elementId: "demo.table" }, allowedOps: ["resize"], effectiveOps: ["resize"] }; },
    applyChange() { throw new Error("applyChange must not be called"); },
  };
  const missingWidthController = createUiEditorPanelController({ runtime: missingWidthRuntime, registry });
  missingWidthController.selectElement("demo.table");
  await missingWidthController.activateDirection("right");
  assert.equal(missingWidthController.getState().lastResult.code, "CURRENT_VALUE_UNAVAILABLE");

  const naturalHeight = setup({ "demo.table": { elementId: "demo.table", width: 25, height: 200 } });
  const naturalHeightController = createUiEditorPanelController({ runtime: naturalHeight.runtime, registry: naturalHeight.registry });
  naturalHeightController.selectElement("demo.table");
  naturalHeightController.setMode("height");
  await naturalHeightController.activateDirection("down");
  assert.equal(naturalHeight.host.dump()["demo.table"].height, 205);

  const throwingRegistry = { getElementById() { throw new Error("registry boom"); } };
  const throwingController = createUiEditorPanelController({ runtime, registry: throwingRegistry });
  assert.doesNotThrow(() => throwingController.selectElement("demo.card"));
  assert.equal(throwingController.getState().lastResult.code, "REGISTRY_READ_FAILED");
  assert.equal(throwingController.getState().selectedElementId, null);

  let applied = 0;
  const minThrowRuntime = {
    getSessionStatus() { return { ok: true, active: true, changedCount: 0, changedElementIds: [] }; },
    getPersistenceStatus() { return { available: true, persistent: true }; },
    inspectElement() { return { ok: true, currentEntry: { elementId: "demo.table", width: 20 }, effectiveLayout: { elementId: "demo.table", width: 20 }, allowedOps: ["resize"], effectiveOps: ["resize"] }; },
    applyChange() { applied += 1; return { ok: true }; },
  };
  const minThrowRegistry = { getElementById(id) { if (id === "demo.table") return { id, name: "Table", editable: true, allowedOps: ["resize"], lockedOps: [] }; return null; } };
  const minThrowController = createUiEditorPanelController({ runtime: minThrowRuntime, registry: minThrowRegistry });
  minThrowController.selectElement("demo.table");
  minThrowRegistry.getElementById = () => { throw new Error("min read failed"); };
  await minThrowController.activateDirection("right");
  assert.equal(minThrowController.getState().lastResult.code, "REGISTRY_READ_FAILED");
  assert.equal(applied, 0);

  console.log("m70 panel controller ok");
})();
