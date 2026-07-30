"use strict";

const crypto = require("node:crypto");

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeUiTopology(nodes) {
  if (!Array.isArray(nodes)) throw new TypeError("Topologieknoten muessen als Liste geliefert werden.");
  const included = nodes
    .filter((node) => node && node.dynamicContent !== true)
    .map((node) => Object.freeze({
      kind: text(node.kind),
      stableId: text(node.stableId),
      parentId: node.parentId == null ? null : text(node.parentId),
      order: Number.isInteger(node.order) ? node.order : -1,
    }));
  const ids = new Set(included.map((node) => node.stableId));
  for (const node of included) {
    if (!node.kind || !node.stableId || node.order < 0) throw new TypeError("Jeder Topologieknoten braucht Typ, stabile ID und Reihenfolge.");
    if (node.parentId && !ids.has(node.parentId)) throw new TypeError(`Topologie-Parent fehlt: ${node.parentId}`);
  }
  if (ids.size !== included.length) throw new TypeError("Stabile Topologie-IDs muessen eindeutig sein.");
  return Object.freeze(included
    .slice()
    .sort((left, right) => (left.parentId || "").localeCompare(right.parentId || "") || left.order - right.order || left.stableId.localeCompare(right.stableId)));
}

function createUiTopologyFingerprint(nodes) {
  const canonical = JSON.stringify(normalizeUiTopology(nodes));
  return `sha256:${crypto.createHash("sha256").update(canonical, "utf8").digest("hex")}`;
}

function compareUiTopology(before, after) {
  const beforeFingerprint = createUiTopologyFingerprint(before);
  const afterFingerprint = createUiTopologyFingerprint(after);
  return Object.freeze({
    ok: beforeFingerprint === afterFingerprint,
    beforeFingerprint,
    afterFingerprint,
    errorCode: beforeFingerprint === afterFingerprint ? null : "target_ui_topology_changed",
  });
}

module.exports = Object.freeze({
  normalizeUiTopology,
  createUiTopologyFingerprint,
  compareUiTopology,
});
