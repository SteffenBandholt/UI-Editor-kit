#!/usr/bin/env node

const assert = require("node:assert/strict");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const HIDDEN_ELEMENTS_RUNTIME_PATH = path.join(REPO_ROOT, "src/runtime/hiddenElements/index.cjs");

function assertHiddenElementsRuntime(runtime) {
  assert.equal(typeof runtime.normalizeHiddenElement, "function");
  assert.equal(typeof runtime.getHiddenElements, "function");
  assert.equal(typeof runtime.buildHiddenElementsButtonViewModel, "function");
  assert.equal(typeof runtime.buildHiddenElementsPopoverViewModel, "function");
  assert.equal(typeof runtime.buildHiddenElementsViewModel, "function");

  assert.equal(runtime.normalizeHiddenElement(null), null);
  assert.equal(runtime.normalizeHiddenElement({ visible: false }), null);
  assert.deepEqual(runtime.normalizeHiddenElement({
    id: " sample.field ",
    name: " Sample field ",
    visible: false,
  }), {
    elementId: "sample.field",
    label: "Sample field",
    visible: false,
    hidden: true,
    canShow: true,
    action: "show",
    enabled: true,
  });

  const elements = [
    { elementId: "visible.field", label: "Visible field", visible: true, canShow: true },
    { elementId: "hidden.field", label: "Hidden field", visible: false, canShow: true },
    { id: "locked.field", name: "Locked field", hidden: true, canShow: false },
    { elementId: "", label: "Ignored", visible: false },
  ];
  const hiddenElements = runtime.getHiddenElements(elements);

  assert.equal(hiddenElements.length, 2);
  assert.deepEqual(hiddenElements.map((element) => element.elementId), ["hidden.field", "locked.field"]);
  assert.equal(hiddenElements[0].enabled, true);
  assert.equal(hiddenElements[1].enabled, false);

  assert.deepEqual(runtime.buildHiddenElementsButtonViewModel({ elements: [] }), {
    visible: false,
    enabled: false,
    label: "Ausgeblendete: 0",
    hiddenCount: 0,
  });
  assert.deepEqual(runtime.buildHiddenElementsButtonViewModel({ elements: [], showWhenEmpty: true }), {
    visible: true,
    enabled: false,
    label: "Ausgeblendete: 0",
    hiddenCount: 0,
  });

  const button = runtime.buildHiddenElementsButtonViewModel({ elements });
  assert.deepEqual(button, {
    visible: true,
    enabled: true,
    label: "Ausgeblendete: 2",
    hiddenCount: 2,
  });

  const popover = runtime.buildHiddenElementsPopoverViewModel({ elements });
  assert.equal(popover.title, "Ausgeblendete Elemente");
  assert.deepEqual(popover.items, [
    { elementId: "hidden.field", label: "Hidden field", action: "show", enabled: true },
    { elementId: "locked.field", label: "Locked field", action: "show", enabled: false },
  ]);

  const viewModel = runtime.buildHiddenElementsViewModel({ elements });
  assert.equal(viewModel.hiddenCount, 2);
  assert.deepEqual(viewModel.button, button);
  assert.deepEqual(viewModel.popover, popover);

  const serialized = JSON.stringify(viewModel);
  assert.equal(serialized.includes("<"), false);
  assert.equal(Object.values(viewModel).some((value) => value && typeof value === "object" && typeof value.nodeType === "number"), false);
}

function run() {
  assertHiddenElementsRuntime(require(HIDDEN_ELEMENTS_RUNTIME_PATH));
  console.log("TESTS OK: hidden-elements-runtime");
}

if (require.main === module) {
  run();
}

module.exports = { assertHiddenElementsRuntime };
