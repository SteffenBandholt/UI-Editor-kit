"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createMultiRefTemplateTarget } = require("../../src/index.cjs");
const { createUiScopeFingerprint, loadTargetStartupLayout } = require("../../src/electron-target/layout-profile-startup.cjs");
const { createRegistryFingerprint, validateRegistrationSnapshot, compareRegistrySnapshots } = require("../../src/electron-target/target-registration.cjs");
const copy = value => structuredClone(value);
const baseline = { x: 0, y: 0, width: 100, height: 20, spacing: { afterElement: 0 } };
const entry = { id: "sample.rows.template", name: "Rows", type: "group", role: "layout", scopeId: "sample", parentId: "sample", order: 1,
  visible: true, editable: true, semanticKey: "rows", registrationStatus: "editorEnabled", refKey: "rows", referenceKind: "multi",
  mountedInstanceCount: 0, referenceResolved: false, baseline, allowedOps: ["move", "resizeWidth", "spacingSet", "spacingIncrease", "spacingDecrease", "spacingReset"], lockedOps: [], spacingTargets: ["afterElement"] };
const rootEntry = { ...entry, id: "sample", semanticKey: "root", refKey: "root", parentId: null, referenceKind: "single", referenceResolved: true, type: "root", role: "scopeRoot", allowedOps: [], editable: false, spacingTargets: [] };
const scope = { scopeId: "sample", status: "complete", inventoryStatus: "complete", expectedElementIds: ["sample", entry.id], elements: [rootEntry, entry] };
function snapshot(s = scope) { return { contract: { applicationId: "sample", displayName: "Sample", appVersion: "1", framework: "electron", contractVersion: "1.2", adapterVersion: "1.2", uiCapability: "layout", pdfCapability: "unavailable", supportedOperations: entry.allowedOps, labelFieldSeparation: true, visibilityCapability: true, registryVersion: 1, registryFingerprint: createRegistryFingerprint([s]), registryStatus: "complete", activeScopes: ["sample"] }, registryScopes: [s] }; }
async function run() {
  let refs = [], fail = false, unstable = false, rollbackFail = false, wrongReadback = false;
  const target = createMultiRefTemplateTarget({ entry, resolveReferences: () => refs,
    capture: ref => copy(ref), apply(ref, state) { Object.assign(ref, copy(state)); if (unstable) refs = []; if (fail) throw Error("renderer_failure"); },
    restore(ref, state) { if (rollbackFail) throw Error("restore_failure"); Object.assign(ref, state); },
    read: ref => wrongReadback ? { ...ref, width: 999 } : ref });
  let sequence = 0;
  const submit = (operation, payload) => target.submitChange({ changeId: String(++sequence), elementId: entry.id, operation, payload });
  for (const count of [0, 1, 4]) {
    refs = Array.from({ length: count }, () => copy(baseline));
    assert.equal((await target.reapply()).success, true);
    const result = await submit("resizeWidth", { width: 140 + count });
    assert.equal(result.success, true);
    assert.deepEqual(result.templateReadback, { mountedInstanceCount: count, appliedInstanceCount: count, referenceStable: true });
    assert(refs.every(ref => ref.width === 140 + count));
    assert.equal((await submit("spacingIncrease", { spacing: { target: "afterElement", value: 3 } })).success, true);
  }
  const saved = target.getLayoutState();
  refs = [copy(baseline), copy(baseline)];
  assert.equal((await target.reapply()).success, true);
  assert(refs.every(ref => ref.width === saved.width && ref.spacing.afterElement === saved.spacing.afterElement));
  assert.equal((await submit("resizeWidth", { width: 10, recordId: 17 })).success, false);
  assert.equal((await submit("resizeWidth", { width: Infinity })).success, false);
  assert.equal((await submit("deleteRecord", {})).success, false);
  assert.equal((await target.submitChange({ elementId: "sample.rows.record-42", operation: "resizeWidth", payload: { width: 10 } })).success, false);
  const before = copy(refs);
  fail = true;
  assert.equal((await submit("resizeWidth", { width: 160 })).rollbackSucceeded, true);
  assert.deepEqual(refs, before);
  assert.deepEqual(target.getLayoutState(), saved);
  fail = false;
  assert.equal((await submit("resizeWidth", { width: 160 })).success, true, "A rolled-back failure can retry");
  assert.equal((await submit("resizeWidth", { width: saved.width })).success, true);
  refs[0].isConnected = false;
  assert.equal((await target.reapply()).errorCode, "template_reference_invalid");
  delete refs[0].isConnected;
  wrongReadback = true;
  assert.equal((await submit("resizeWidth", { width: 160 })).errorCode, "template_readback_invalid");
  assert.deepEqual(refs, before);
  wrongReadback = false; unstable = true;
  const oldRefs = refs.slice();
  assert.equal((await submit("resizeWidth", { width: 160 })).errorCode, "template_reference_unstable");
  assert.deepEqual(oldRefs, before);
  assert.deepEqual(target.getLayoutState(), saved);
  unstable = false; refs = oldRefs;
  fail = true; rollbackFail = true;
  assert.equal((await submit("resizeWidth", { width: 160 })).rollbackSucceeded, false);
  fail = false; rollbackFail = false;
  assert.equal((await target.reapply()).errorCode, "template_rollback_failed");

  const validation = validateRegistrationSnapshot(snapshot());
  assert.equal(validation.ok, true, JSON.stringify(validation.errors));
  const mounted = copy(scope); Object.assign(mounted.elements[1], { mountedInstanceCount: 4, referenceResolved: true });
  assert.equal(createRegistryFingerprint([mounted]), createRegistryFingerprint([scope]));
  assert.equal(createUiScopeFingerprint(mounted), createUiScopeFingerprint(scope));
  const single = copy(mounted); single.elements[1].referenceKind = "single";
  assert.notEqual(createUiScopeFingerprint(single), createUiScopeFingerprint(scope));
  assert.equal(compareRegistrySnapshots(snapshot(scope), snapshot(single)).status, "incompatible");
  const missing = copy(scope); missing.elements[1].parentId = "missing";
  assert.equal(validateRegistrationSnapshot(snapshot(missing)).ok, false);
  const bad = copy(scope); bad.elements[1].mountedInstanceCount = -1;
  assert.equal(validateRegistrationSnapshot(snapshot(bad)).ok, false);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kit-multi-template-"));
  try {
    const document = { schemaVersion: 2, applicationId: "sample", profileId: "standard", savedAt: new Date().toISOString(), scopes: [{
      scopeId: "sample", registryFingerprint: createUiScopeFingerprint(scope), explicitOperations: { [entry.id]: ["resizeWidth", "spacingIncrease"] },
      layoutState: { elements: [{ elementId: "sample", scopeId: "sample" }, { elementId: entry.id, scopeId: "sample", x: saved.x, y: saved.y, width: saved.width, spacing: saved.spacing }] },
    }] };
    const file = path.join(dir, "standard.layout-profile.json"), bytes = JSON.stringify(document);
    fs.writeFileSync(file, bytes);
    for (const current of [scope, mounted]) {
      const loaded = loadTargetStartupLayout({ profileRoot: dir, applicationId: "sample", activeScopes: ["sample"], registryScopes: [current] });
      assert.equal(loaded.ok, true, JSON.stringify(loaded));
      assert.equal(loaded.scopes[0].elements.find(item => item.elementId === entry.id).width, saved.width);
    }
    fs.writeFileSync(file, "uncommitted candidate");
    fs.writeFileSync(file + ".save-transaction.json", JSON.stringify({ schemaVersion: 1, previousProfileBase64: Buffer.from(bytes).toString("base64") }));
    assert.equal(loadTargetStartupLayout({ profileRoot: dir, applicationId: "sample", activeScopes: ["sample"], registryScopes: [scope] }).ok, true);
    assert.equal(fs.readFileSync(file, "utf8"), bytes);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  console.log("MULTI_REF_TEMPLATE_OK: 0/1/N, rerender, empty, atomic rollback, unstable refs, retry, profile restart and journal recovery");
}
run().catch(error => { console.error(error); process.exitCode = 1; });
