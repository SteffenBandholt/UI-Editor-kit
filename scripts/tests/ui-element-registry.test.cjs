#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const REGISTRY_PATH = path.join(REPO_ROOT, "src/core/ui-element-registry.cjs");

const { createUiElementRegistry } = require(REGISTRY_PATH);

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function run() {
  const emptyRegistry = createUiElementRegistry();
  assert.equal(typeof emptyRegistry.registerElement, "function");
  assert.equal(typeof emptyRegistry.getElementById, "function");
  assert.equal(typeof emptyRegistry.listElements, "function");
  assert.equal(typeof emptyRegistry.clear, "function");
  assert.equal(typeof emptyRegistry.size, "function");
  assert.equal(emptyRegistry.size(), 0);
  assert.deepEqual(emptyRegistry.listElements(), []);
  assert.equal(emptyRegistry.getElementById("missing.element"), null);

  const registry = createUiElementRegistry();
  const firstElement = {
    id: "workspace.main.table",
    name: "Tabelle",
    type: "table",
    role: "content",
    parentId: "workspace.main.area",
    order: 20,
    visible: true,
    editable: true,
    allowedOps: ["inspect", "move"],
    lockedOps: ["rename"],
  };
  const secondElement = {
    id: "workspace.main.toolbar",
    name: "Toolbar",
    type: "toolbar",
    role: "layout",
    parentId: "workspace.main.area",
    order: 10,
    visible: true,
    editable: false,
    allowedOps: ["inspect"],
    lockedOps: [],
  };

  const registeredFirst = registry.registerElement(firstElement);
  registry.registerElement(secondElement);

  assert.deepEqual(registeredFirst, {
    id: "workspace.main.table",
    name: "Tabelle",
    type: "table",
    role: "content",
    parentId: "workspace.main.area",
    order: 20,
    visible: true,
    editable: true,
    allowedOps: ["inspect", "move"],
    lockedOps: ["rename"],
  });
  assert.equal(registry.size(), 2);

  const listedElements = registry.listElements();
  assert.deepEqual(
    listedElements.map((element) => element.id),
    ["workspace.main.table", "workspace.main.toolbar"]
  );

  const loadedElement = registry.getElementById("workspace.main.table");
  assert.deepEqual(loadedElement, {
    id: "workspace.main.table",
    name: "Tabelle",
    type: "table",
    role: "content",
    parentId: "workspace.main.area",
    order: 20,
    visible: true,
    editable: true,
    allowedOps: ["inspect", "move"],
    lockedOps: ["rename"],
  });
  assert.equal(registry.getElementById("workspace.main.unknown"), null);

  assert.throws(
    () => registry.registerElement(secondElement),
    /Element-ID bereits registriert: workspace\.main\.toolbar/
  );

  assert.throws(
    () => registry.registerElement({ name: "Ohne ID" }),
    /registerElement erfordert eine nicht leere string-id\./
  );

  assert.throws(
    () => registry.registerElement({ id: "" }),
    /registerElement erfordert eine nicht leere string-id\./
  );

  assert.throws(
    () => registry.registerElement([]),
    /registerElement erwartet ein Element-Objekt\./
  );

  const sparseRegistry = createUiElementRegistry();
  sparseRegistry.registerElement({ id: "workspace.sparse", allowedOps: [] });
  const sparseStored = sparseRegistry.getElementById("workspace.sparse");
  assert.deepEqual(sparseStored, {
    id: "workspace.sparse",
    allowedOps: [],
  });
  assert.equal(hasOwn(sparseStored, "name"), false);
  assert.equal(hasOwn(sparseStored, "type"), false);
  assert.equal(hasOwn(sparseStored, "role"), false);
  assert.equal(hasOwn(sparseStored, "parentId"), false);
  assert.equal(hasOwn(sparseStored, "order"), false);
  assert.equal(hasOwn(sparseStored, "visible"), false);
  assert.equal(hasOwn(sparseStored, "editable"), false);
  assert.equal(hasOwn(sparseStored, "lockedOps"), false);

  const mutationRegistry = createUiElementRegistry();
  const sourceElement = {
    id: "workspace.main.field.status",
    name: "Statusfeld",
    type: "field",
    role: "status",
    parentId: "workspace.main.group",
    order: 3,
    visible: true,
    editable: true,
    allowedOps: ["inspect", "show"],
    lockedOps: ["hide"],
  };

  mutationRegistry.registerElement(sourceElement);
  sourceElement.name = "Geaendert";
  sourceElement.allowedOps.push("move");
  sourceElement.lockedOps.push("rename");

  const storedAfterSourceMutation = mutationRegistry.getElementById("workspace.main.field.status");
  assert.equal(storedAfterSourceMutation.name, "Statusfeld");
  assert.deepEqual(storedAfterSourceMutation.allowedOps, ["inspect", "show"]);
  assert.deepEqual(storedAfterSourceMutation.lockedOps, ["hide"]);
  assert.equal(storedAfterSourceMutation.allowedOps === sourceElement.allowedOps, false);
  assert.equal(storedAfterSourceMutation.lockedOps === sourceElement.lockedOps, false);

  const listedMutationCopy = mutationRegistry.listElements();
  listedMutationCopy[0].name = "Von Liste veraendert";
  listedMutationCopy[0].allowedOps.push("resize");
  listedMutationCopy[0].lockedOps.push("reset");

  const storedAfterListMutation = mutationRegistry.getElementById("workspace.main.field.status");
  assert.equal(storedAfterListMutation.name, "Statusfeld");
  assert.deepEqual(storedAfterListMutation.allowedOps, ["inspect", "show"]);
  assert.deepEqual(storedAfterListMutation.lockedOps, ["hide"]);

  const loadedMutationCopy = mutationRegistry.getElementById("workspace.main.field.status");
  loadedMutationCopy.name = "Per Lookup veraendert";
  loadedMutationCopy.allowedOps.push("pin");

  const storedAfterLookupMutation = mutationRegistry.getElementById("workspace.main.field.status");
  assert.equal(storedAfterLookupMutation.name, "Statusfeld");
  assert.deepEqual(storedAfterLookupMutation.allowedOps, ["inspect", "show"]);

  mutationRegistry.clear();
  assert.equal(mutationRegistry.size(), 0);
  assert.deepEqual(mutationRegistry.listElements(), []);
  assert.equal(mutationRegistry.getElementById("workspace.main.field.status"), null);

  const sourceText = fs.readFileSync(REGISTRY_PATH, "utf8");
  const forbiddenMarkers = [
    "document",
    "window",
    "querySelector",
    "DOMParser",
    "data-ui",
    "mini-inspector",
    ".html",
    "demo/",
    "demo\\",
  ];

  forbiddenMarkers.forEach((marker) => {
    assert.equal(
      sourceText.includes(marker),
      false,
      `ui-element-registry enthaelt verbotene Abhaengigkeitsspur: ${marker}`
    );
  });

  console.log("TESTS OK: ui-element-registry");
}

run();
