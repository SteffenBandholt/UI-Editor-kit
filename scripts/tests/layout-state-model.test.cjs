#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const contract = require("../../src/core/layout-state-contract.cjs");

const MODULE_PATH = path.join(__dirname, "../../src/core/layout-state-contract.cjs");

function state(overrides = {}) {
  return {
    schemaVersion: 1,
    targetAppId: "neutral-target-app",
    uiScope: "scope.alpha",
    layoutScope: "layout.alpha",
    layoutProfileId: "layout.alpha.profile",
    version: 1,
    source: "saved",
    elements: { "scope.alpha.header": { x: 1, y: 2, width: 300, height: 80, spacing: 8, order: 1 } },
    changes: [{ x: 2, y: 3 }],
    layoutValues: { "scope.alpha.group.primary": { width: 420, height: 180 } },
    ...overrides,
  };
}
function codes(result) { return result.errors.map((error) => error.code); }
function hasCode(result, code) { return codes(result).includes(code); }
function run() {
  assert.equal(contract.SUPPORTED_LAYOUT_SCHEMA_VERSION, 1);
  assert.deepEqual(contract.LAYOUT_STATE_REQUIRED_FIELDS, ["schemaVersion", "targetAppId", "uiScope", "layoutScope", "layoutProfileId"]);
  assert.equal(contract.validateLayoutState(state()).ok, true);
  const revisionOnly = state({ revision: 2 });
  delete revisionOnly.version;
  assert.equal(contract.validateLayoutState(revisionOnly).ok, true);
  assert.equal(contract.validateLayoutState(null).ok, false);
  assert.equal(hasCode(contract.validateLayoutState({}), "unsupported_layout_schema_version"), true);
  assert.equal(hasCode(contract.validateLayoutState(state({ schemaVersion: 2 })), "unsupported_layout_schema_version"), true);
  assert.equal(hasCode(contract.validateLayoutState(state({ targetAppId: "" })), "invalid_layout_state"), true);
  assert.equal(hasCode(contract.validateLayoutState(state({ version: 0 })), "invalid_layout_state"), true);
  const missingRevision = state();
  delete missingRevision.version;
  delete missingRevision.revision;
  assert.equal(hasCode(contract.validateLayoutState(missingRevision), "invalid_layout_state"), true);
  assert.equal(hasCode(contract.validateLayoutState(state({ source: "unknown" })), "invalid_layout_state"), true);
  assert.equal(hasCode(contract.validateLayoutState(state({ recordId: "neutral-record" })), "invalid_layout_state"), true);
  assert.equal(hasCode(contract.validateLayoutState(state({ elements: { a: { width: 10, unknownNeutral: true } } })), "invalid_layout_state"), true);
  assert.equal(hasCode(contract.validateLayoutState(state({ changes: [{ width: 10, action: "run" }] })), "invalid_layout_state"), true);
  assert.equal(hasCode(contract.validateLayoutState(state({ elements: { a: { label: "Title" } } })), "invalid_layout_state"), true);
  assert.equal(contract.validateLayoutState(state({ elements: { a: { label: "Title", visible: true } } }), { allowedPayloadFields: ["label", "visible"] }).ok, true);

  const normalized = contract.normalizeLayoutState(state({ extra: true }));
  assert.equal(Object.prototype.hasOwnProperty.call(normalized, "extra"), false);
  const cloned = contract.createLayoutState(state());
  cloned.elements["scope.alpha.header"].width = 1;
  assert.equal(state().elements["scope.alpha.header"].width, 300);
  assert.equal(contract.getLayoutStateProfileKey(state()), "neutral-target-app\u001fscope.alpha\u001flayout.alpha\u001flayout.alpha.profile");
  assert.equal(contract.assertCompatibleLayoutProfile(state(), { uiScope: "scope.beta" }).errors[0].code, "incompatible_layout_profile");

  const source = fs.readFileSync(MODULE_PATH, "utf8").toLowerCase();
  ["query" + "selector", "doc" + "ument.", "win" + "dow.", "p" + "df", "m" + "ail", "au" + "dio"].forEach((term) => assert.equal(source.includes(term), false));
  console.log("TESTS OK: layout-state-model");
}
run();
