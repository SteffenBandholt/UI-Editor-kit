"use strict";

const ELEMENTS = Object.freeze([
  { id: "demo.card", name: "Demo-Karte", type: "component", role: "content", parentId: "demo.root", order: 1, visible: true, editable: true, allowedOps: ["move", "resize", "show", "hide"], lockedOps: [], effectiveOps: ["move", "resize", "show", "hide"], minWidth: 160, minHeight: 110 },
  { id: "demo.heading", name: "Demo-Überschrift", type: "component", role: "content", parentId: "demo.root", order: 2, visible: true, editable: true, allowedOps: ["move", "show", "hide"], lockedOps: ["resize"], effectiveOps: ["move", "show", "hide"] },
  { id: "demo.action", name: "Demo-Aktion", type: "button", role: "action", parentId: "demo.root", order: 3, visible: true, editable: true, allowedOps: ["move", "resize", "show", "hide"], lockedOps: [], effectiveOps: ["move", "resize", "show", "hide"], minWidth: 120, minHeight: 44 },
  { id: "demo.info", name: "Demo-Info", type: "component", role: "status", parentId: "demo.root", order: 4, visible: true, editable: true, allowedOps: ["resize", "show", "hide"], lockedOps: ["move"], effectiveOps: ["resize", "show", "hide"], minWidth: 180, minHeight: 80 },
  { id: "demo.locked", name: "Demo gesperrt", type: "component", role: "system", parentId: "demo.root", order: 5, visible: true, editable: false, allowedOps: [], lockedOps: ["move", "resize", "show", "hide"], effectiveOps: [], minWidth: 100, minHeight: 40 },
]);

function createReferenceRegistry() {
  const byId = new Map(ELEMENTS.map((element) => [element.id, { ...element, allowedOps: element.allowedOps.slice(), lockedOps: element.lockedOps.slice(), effectiveOps: element.effectiveOps.slice() }]));
  return Object.freeze({
    getElementById(id) { return byId.get(id) || null; },
    listElements() { return Array.from(byId.values()).map((element) => ({ ...element, allowedOps: element.allowedOps.slice(), lockedOps: element.lockedOps.slice(), effectiveOps: element.effectiveOps.slice() })); },
  });
}

module.exports = { ELEMENTS, createReferenceRegistry };
