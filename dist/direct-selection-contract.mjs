export const DIRECT_SELECTION_KINDS = Object.freeze([
  "element", "group", "layoutZone", "label", "field", "button", "icon", "statusText", "table", "column",
]);

export const LAYOUT_EFFECT_SCOPES = Object.freeze([
  "elementOnly", "groupWithChildren", "layoutZone", "parentReflowRequired", "forbidden",
]);

export function createDirectSelectionHierarchy(elements, elementId) {
  const entries = new Map((Array.isArray(elements) ? elements : []).map((entry) => [entry.id, entry]));
  const chain = [];
  const visited = new Set();
  let current = entries.get(String(elementId || ""));
  while (current && !visited.has(current.id)) {
    chain.push(current);
    visited.add(current.id);
    current = current.parentId ? entries.get(current.parentId) : null;
  }
  const candidates = [];
  if (chain[0]) candidates.push({ entry: chain[0], level: "Element" });
  const group = chain.slice(1).find((entry) => entry.selectionKind === "group");
  if (group) candidates.push({ entry: group, level: "Gruppe" });
  const area = chain.slice(1).find((entry) => entry.selectionKind === "layoutZone");
  if (area) candidates.push({ entry: area, level: "Bereich" });
  return candidates.filter((candidate, index, values) => values.findIndex((item) => item.entry.id === candidate.entry.id) === index);
}

export function cycleDirectSelectionIndex(index, count, backwards = false) {
  if (!Number.isInteger(count) || count <= 0) return -1;
  const current = Number.isInteger(index) ? index : 0;
  return (current + (backwards ? -1 : 1) + count) % count;
}

export function directSelectionFramePresentation(level, active = false) {
  if (level === "Gruppe") return Object.freeze({ lineStyle: "dashed", lineWidth: 3, badge: "Gruppe", inset: 3, active });
  if (level === "Bereich") return Object.freeze({ lineStyle: "double", lineWidth: 4, badge: "Bereich", inset: 6, active });
  return Object.freeze({ lineStyle: "solid", lineWidth: 2, badge: "Element", inset: 0, active });
}

export function describeDirectSelection(candidate, directChildCount = 0) {
  if (!candidate?.entry) return "";
  const count = candidate.level === "Gruppe" ? ` – ${Math.max(0, Number(directChildCount) || 0)} Elemente` : "";
  return `${candidate.level}: ${candidate.entry.name}${count}`;
}

export function validateLayoutEffect(entry, operation) {
  if (!entry || !Array.isArray(entry.allowedOps) || !entry.allowedOps.includes(operation))
    return Object.freeze({ ok: false, effectScope: "forbidden", code: "operation_not_allowed" });
  const effectScope = entry.operationEffects?.[operation] || "forbidden";
  if (!LAYOUT_EFFECT_SCOPES.includes(effectScope) || effectScope === "forbidden")
    return Object.freeze({ ok: false, effectScope: "forbidden", code: "layout_effect_forbidden" });
  return Object.freeze({
    ok: true,
    effectScope,
    warnsAboutReflow: effectScope === "parentReflowRequired",
    affectsMultiple: effectScope !== "elementOnly",
    affectedElementIds: Object.freeze([entry.id, ...(entry.operationAffectedIds?.[operation] || [])]),
  });
}
