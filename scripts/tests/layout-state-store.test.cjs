#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const STORE_PATH = path.join(REPO_ROOT, "src/core/layout-state-store.cjs");

const { createLayoutStateStore, LAYOUT_STATE_FILTER_FIELDS } = require("../../src/core/layout-state-store.cjs");

function record(overrides = {}) {
  return {
    layoutProfileId: "layout-profile-default",
    targetAppId: "target-app-technical",
    uiScope: "workspace-main",
    elementId: "workspace.main.area",
    changeId: "change-001",
    operation: "resize",
    layoutValue: { width: 320, placement: { x: 4, y: 8 } },
    version: 1,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:10:00.000Z",
    ...overrides,
  };
}

function assertNoForbiddenFragments(text, label) {
  const forbiddenFragments = [
    "node:fs",
    "node:path",
    "writeFile",
    "readFile",
    "mkdir",
    "sqlite",
    "postgres",
    "mysql",
    "fetch(",
    "http",
    "host-adapter",
    "target-app",
    "document.",
    "window.",
    "querySelector",
    "createElement",
    "innerHTML",
    "Browser",
    "HTML",
    "DOM",
    "Mini-Inspector",
    "Host-App-Demo",
    "Layoutdiagnose",
    "data-ui",
    "Demo",
    ["B", "BM"].join(""),
    ["Proto", "koll"].join(""),
    ["Rest", "arbeiten"].join(""),
    ["T", "OP"].join(""),
    ["Bau", "vorhaben"].join(""),
  ];

  forbiddenFragments.forEach((fragment) => {
    assert.equal(text.includes(fragment), false, `${label} enthaelt verbotenen Fragmenttext: ${fragment}`);
  });
}

function assertRejectsForbiddenFilter(store, filter) {
  assert.throws(() => store.listLayoutStateRecords(filter), /Layout-State-Filter ist nicht erlaubt/);
  assert.throws(() => store.getLatestLayoutStateRecord(filter), /Layout-State-Filter ist nicht erlaubt/);
  assert.throws(() => store.resetLayoutState(filter), /Layout-State-Filter ist nicht erlaubt/);
}

function run() {
  assert.deepEqual(LAYOUT_STATE_FILTER_FIELDS, ["layoutProfileId", "targetAppId", "uiScope", "elementId"]);

  const emptyStore = createLayoutStateStore();
  assert.deepEqual(emptyStore.listLayoutStateRecords(), []);
  assert.equal(emptyStore.getLatestLayoutStateRecord(), null);

  const store = createLayoutStateStore();
  const input = record({ unknown: "removed", recordId: "not-copied" });
  const saved = store.saveLayoutStateRecord(input);
  assert.equal(saved.layoutProfileId, "layout-profile-default");
  assert.equal(Object.prototype.hasOwnProperty.call(saved, "unknown"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(saved, "recordId"), false);
  assert.deepEqual(store.listLayoutStateRecords(), [saved]);

  store.saveLayoutStateRecord(record({
    layoutProfileId: "layout-profile-alt",
    targetAppId: "target-app-alt",
    uiScope: "workspace-secondary",
    elementId: "workspace.secondary.card",
    changeId: "change-002",
    version: 2,
  }));
  store.saveLayoutStateRecord(record({
    layoutProfileId: "layout-profile-default",
    targetAppId: "target-app-technical",
    uiScope: "workspace-main",
    elementId: "workspace.main.table",
    changeId: "change-003",
    version: 3,
  }));

  assert.equal(store.listLayoutStateRecords().length, 3);
  assert.equal(store.listLayoutStateRecords({ layoutProfileId: "layout-profile-default" }).length, 2);
  assert.equal(store.listLayoutStateRecords({ targetAppId: "target-app-alt" }).length, 1);
  assert.equal(store.listLayoutStateRecords({ uiScope: "workspace-secondary" }).length, 1);
  assert.equal(store.listLayoutStateRecords({ elementId: "workspace.main.table" }).length, 1);

  assertRejectsForbiddenFilter(store, { recordId: "not-allowed" });
  assertRejectsForbiddenFilter(store, { tableName: "not-allowed" });
  assertRejectsForbiddenFilter(store, { unknown: "not-allowed" });

  const latestDefault = store.getLatestLayoutStateRecord({ layoutProfileId: "layout-profile-default" });
  assert.equal(latestDefault.changeId, "change-003");
  assert.equal(latestDefault.version, 3);
  assert.equal(store.getLatestLayoutStateRecord({ elementId: "missing" }), null);

  const mutableInput = record({
    changeId: "change-004",
    elementId: "workspace.mutable.input",
    layoutValue: { width: 20, nested: { height: 30 } },
    version: 4,
  });
  store.saveLayoutStateRecord(mutableInput);
  mutableInput.layoutValue.width = 99;
  mutableInput.layoutValue.nested.height = 99;
  assert.deepEqual(store.getLatestLayoutStateRecord({ elementId: "workspace.mutable.input" }).layoutValue, {
    width: 20,
    nested: { height: 30 },
  });

  const listed = store.listLayoutStateRecords({ elementId: "workspace.mutable.input" });
  listed[0].layoutValue.width = 77;
  listed[0].layoutValue.nested.height = 77;
  assert.deepEqual(store.getLatestLayoutStateRecord({ elementId: "workspace.mutable.input" }).layoutValue, {
    width: 20,
    nested: { height: 30 },
  });

  const resetStore = createLayoutStateStore();
  resetStore.saveLayoutStateRecord(record({ elementId: "workspace.reset.one", changeId: "reset-1" }));
  resetStore.saveLayoutStateRecord(record({ elementId: "workspace.reset.two", changeId: "reset-2" }));
  resetStore.saveLayoutStateRecord(record({ elementId: "workspace.reset.one", changeId: "reset-3", version: 3 }));
  const removedCount = resetStore.resetLayoutState({ elementId: "workspace.reset.one" });
  assert.equal(removedCount, 2);
  assert.deepEqual(resetStore.listLayoutStateRecords().map((entry) => entry.elementId), ["workspace.reset.two"]);

  resetStore.clearLayoutStateRecords();
  assert.deepEqual(resetStore.listLayoutStateRecords(), []);

  const fachStore = createLayoutStateStore();
  fachStore.saveLayoutStateRecord(record({
    recordId: "not-copied",
    tableName: "not-copied",
    database: "not-copied",
    project: "not-copied",
    task: "not-copied",
    layoutValue: {
      width: 10,
      recordId: "not-copied",
      nested: { tableName: "not-copied", height: 12 },
    },
  }));
  const fachSaved = fachStore.getLatestLayoutStateRecord();
  ["recordId", "tableName", "database", "project", "task"].forEach((fieldName) => {
    assert.equal(Object.prototype.hasOwnProperty.call(fachSaved, fieldName), false);
  });
  assert.deepEqual(fachSaved.layoutValue, { width: 10, nested: { height: 12 } });

  let sideEffectExecuted = false;
  fachStore.saveLayoutStateRecord(record({
    writeFile() {
      sideEffectExecuted = true;
    },
    contactTargetApp() {
      sideEffectExecuted = true;
    },
  }));
  assert.equal(sideEffectExecuted, false);

  const moduleText = fs.readFileSync(STORE_PATH, "utf8");
  assertNoForbiddenFragments(moduleText, "layout-state-store");

  console.log("TESTS OK: layout-state-store");
}

run();
