"use strict";
const LAYOUT_ENTRY_FIELDS = Object.freeze(["elementId", "x", "y", "width", "height", "visible", "textOffsetX", "textOffsetY", "fontSize"]);
function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
function normalizeLayoutEntry(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry) || typeof entry.elementId !== "string" || entry.elementId.trim() === "") return null;
  const normalized = { elementId: entry.elementId };
  for (const field of LAYOUT_ENTRY_FIELDS) if (field !== "elementId" && Object.prototype.hasOwnProperty.call(entry, field)) normalized[field] = clone(entry[field]);
  return Object.keys(normalized).length === 1 ? null : normalized;
}
function normalizeEntries(entries) {
  const map = new Map();
  const list = Array.isArray(entries) ? entries : Object.values(entries || {});
  for (const entry of list) { const normalized = normalizeLayoutEntry(entry); if (normalized) map.set(normalized.elementId, normalized); }
  return map;
}
function entriesToArray(map) { return Array.from(map.values()).map(clone).sort((a, b) => a.elementId.localeCompare(b.elementId)); }
function entriesEqual(a, b) { return JSON.stringify(a || null) === JSON.stringify(b || null); }
function changedIds(session, baseline) {
  const ids = new Set([...session.keys(), ...baseline.keys()]);
  return Array.from(ids).filter((id) => !entriesEqual(session.get(id), baseline.get(id))).sort();
}
function createSessionState(clock) {
  const now = typeof clock === "function" ? clock : () => Date.now();
  let active = false, baseline = new Map(), session = new Map(), baselineVersion = String(now()), lastStatus = null;
  function status() { const ids = changedIds(session, baseline); const changedByElementId = {}; ids.forEach((id) => { changedByElementId[id] = { baseline: clone(baseline.get(id)) || null, current: clone(session.get(id)) || null }; }); lastStatus = { ok: true, active, changedElementIds: ids, changedCount: ids.length, changedByElementId, baselineVersion }; return clone(lastStatus); }
  return {
    isActive: () => active,
    begin(entries) { baseline = normalizeEntries(entries); session = normalizeEntries(entries); active = true; baselineVersion = String(now()); return status(); },
    end() { active = false; return status(); },
    status,
    getSessionEntries: () => entriesToArray(session),
    getBaselineEntries: () => entriesToArray(baseline),
    setSessionEntries(entries) { session = normalizeEntries(entries); return status(); },
    setBaselineEntries(entries) { baseline = normalizeEntries(entries); baselineVersion = String(now()); return status(); },
    setEntry(entry) { const normalized = normalizeLayoutEntry(entry); if (normalized) session.set(normalized.elementId, normalized); else if (entry && entry.elementId) session.delete(entry.elementId); return status(); },
    removeEntry(id) { session.delete(id); return status(); },
    resetBaselineToSession() { baseline = normalizeEntries(entriesToArray(session)); baselineVersion = String(now()); return status(); },
    resetBaselineElement(id) { if (session.has(id)) baseline.set(id, clone(session.get(id))); else baseline.delete(id); baselineVersion = String(now()); return status(); },
  };
}
module.exports = { LAYOUT_ENTRY_FIELDS, normalizeLayoutEntry, normalizeEntries, entriesToArray, createSessionState };
