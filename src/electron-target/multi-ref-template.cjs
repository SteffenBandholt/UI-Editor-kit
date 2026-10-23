"use strict";

const { SPACING_OPERATIONS, validateSpacingIntent } = require("../core/spacing-contract.cjs");
const OPERATIONS = new Set(["move", "resize", "resizeWidth", "resizeHeight", ...SPACING_OPERATIONS]);
const clone = value => structuredClone(value);
const sameRefs = (left, right) => left.length === right.length && left.every((ref, i) => ref === right[i]);
const finite = value => typeof value === "number" && Number.isFinite(value);

// Local host-side implementation for the existing native pipe adapter. The app
// supplies explicit refs and renderer primitives. No scan, persistence or IDs
// derived from data, and no ownership of app state is introduced here.
function createMultiRefTemplateTarget({ entry, resolveReferences, capture, apply, restore, read, isReferenceValid = ref => ref.isConnected !== false }) {
  if (entry?.referenceKind !== "multi" || !entry.id || !entry.parentId ||
      !Array.isArray(entry.allowedOps) || entry.allowedOps.some(op => !OPERATIONS.has(op)) ||
      [resolveReferences, capture, apply, restore, read, isReferenceValid].some(fn => typeof fn !== "function"))
    throw new TypeError("An explicit multi-ref layout contract and renderer callbacks are required.");
  entry = clone(entry);
  const baseline = {
    elementId: entry.id, x: 0, y: 0, width: 0, height: 0,
    textOffsetX: null, textOffsetY: null, fontSize: null, visible: true,
    ...Object.fromEntries(["x", "y", "width", "height"].filter(key => Object.hasOwn(entry.baseline || {}, key)).map(key => [key, entry.baseline[key]])), spacing: clone(entry.baseline?.spacing || {}),
  };
  function validate(state) {
    for (const key of ["x", "y", "width", "height"]) {
      if (!finite(state[key]) || (["width", "height"].includes(key) && state[key] < 0)) throw Error("invalid_layout_value");
      const cap = key[0].toUpperCase() + key.slice(1);
      for (const [prefix, test] of [["min", (a, b) => a < b], ["max", (a, b) => a > b]]) {
        const limit = entry.baseline?.[prefix + cap];
        if (limit != null && (!finite(limit) || test(state[key], limit))) throw Error("invalid_layout_value");
      }
    }
    if (Object.entries(state.spacing).some(([key, value]) => !entry.spacingTargets?.includes(key) || !finite(value) || value < 0))
      throw Error("invalid_layout_value");
  }
  validate(baseline);
  let working = clone(baseline), busy = false, blocked = false;
  function refs() {
    const value = resolveReferences();
    if (!Array.isArray(value) || value.some(ref => !ref || !isReferenceValid(ref)) || new Set(value).size !== value.length) throw Error("template_reference_invalid");
    return value.slice();
  }
  function matches(actual, desired) {
    if (!actual) return false;
    return ["x", "y", "width", "height"].every(key => finite(actual[key]) && Math.abs(actual[key] - desired[key]) <= 0.05) &&
      Object.entries(desired.spacing).every(([key, value]) => finite(actual.spacing?.[key]) && Math.abs(actual.spacing[key] - value) <= 0.05);
  }
  async function transact(desired) {
    if (busy || blocked) return { success: false, errorCode: blocked ? "template_rollback_failed" : "template_busy", rollbackSucceeded: !blocked };
    busy = true;
    const snapshots = [];
    try {
      validate(desired);
      const current = refs();
      // Capture all nodes before any mutation; rollback includes a node whose
      // apply callback mutates and then throws, and detached old nodes.
      for (const ref of current) snapshots.push([ref, await capture(ref)]);
      if (!sameRefs(current, refs())) throw Error("template_reference_unstable");
      for (const ref of current) await apply(ref, clone(desired));
      for (const ref of current) if (!matches(await read(ref), desired)) throw Error("template_readback_invalid");
      if (!sameRefs(current, refs())) throw Error("template_reference_unstable");
      working = clone(desired);
      return { success: true, rollbackSucceeded: true, templateReadback: {
        mountedInstanceCount: current.length, appliedInstanceCount: current.length, referenceStable: true,
      } };
    } catch (error) {
      let rollbackSucceeded = true;
      for (const [ref, snapshot] of snapshots.reverse()) {
        try { await restore(ref, snapshot); } catch { rollbackSucceeded = false; }
      }
      blocked = !rollbackSucceeded;
      return { success: false, errorCode: rollbackSucceeded ? error.message : "template_rollback_failed", rollbackSucceeded };
    } finally { busy = false; }
  }
  async function submitChange(request) {
    const previousState = clone(working);
    const envelope = { changeId: request?.changeId, elementId: entry.id, operation: request?.operation,
      previousState, newState: null, message: "Template layout" };
    try {
      if (request?.elementId !== entry.id || !entry.allowedOps.includes(request.operation) || entry.lockedOps?.includes(request.operation))
        throw Error("operation_not_allowed");
      const keys = { move: ["x", "y"], resize: ["width", "height"], resizeWidth: ["width"], resizeHeight: ["height"] }[request.operation];
      const payload = request.payload;
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw Error("invalid_payload");
      const desired = clone(working);
      if (keys) {
        if (Object.keys(payload).length !== keys.length || keys.some(key => !finite(payload[key]))) throw Error("invalid_payload");
        for (const key of keys) desired[key] = payload[key];
      } else {
        if (Object.keys(payload).length !== 1 || !validateSpacingIntent(request.operation, payload, entry.spacingTargets || []).ok)
          throw Error("invalid_payload");
        const { target, value } = payload.spacing;
        if (request.operation !== "spacingReset" && !finite(value)) throw Error("invalid_payload");
        const old = desired.spacing[target] || 0;
        desired.spacing[target] = request.operation === "spacingReset" ? baseline.spacing[target] || 0 :
          request.operation === "spacingIncrease" ? old + value : request.operation === "spacingDecrease" ? Math.max(0, old - value) : value;
      }
      const result = await transact(desired);
      return { ...envelope, ...result, newState: result.success ? clone(working) : null };
    } catch (error) { return { ...envelope, success: false, errorCode: error.message, rollbackSucceeded: true }; }
  }
  return Object.freeze({
    getLayoutState: () => clone(working),
    getReferenceStatus: () => { const current = refs(); return { referenceKind: "multi", mountedInstanceCount: current.length, referenceResolved: current.length > 0 }; },
    submitChange,
    // Called explicitly by the target after its renderer changes the reference
    // set, before publishing it for selection. Reuses the same layout state.
    reapply: () => transact(clone(working)),
  });
}
module.exports = Object.freeze({ createMultiRefTemplateTarget });
