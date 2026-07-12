"use strict";

function isElementLike(value) {
  return Boolean(value) && typeof value === "object" && value.nodeType === 1 && typeof value.contains === "function" && typeof value.getBoundingClientRect === "function";
}

function getTargetId(target) {
  return typeof target === "string" ? target : target && target.elementId;
}

function getPriority(target) {
  if (!target || typeof target === "string") return 0;
  if (Number.isFinite(target.priority)) return target.priority;
  if (target.metadata && Number.isFinite(target.metadata.priority)) return target.metadata.priority;
  return 0;
}

function getDepth(target, byId) {
  let depth = 0;
  let parentId = target && typeof target === "object" ? target.parentId : null;
  const seen = new Set();
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    depth += 1;
    const parent = byId.get(parentId);
    parentId = parent && typeof parent === "object" ? parent.parentId : null;
  }
  return depth;
}

function getArea(ref) {
  try {
    const rect = ref.getBoundingClientRect();
    const width = Math.max(0, Number(rect && rect.width) || 0);
    const height = Math.max(0, Number(rect && rect.height) || 0);
    return width * height;
  } catch (_error) {
    return Number.POSITIVE_INFINITY;
  }
}

function resolveSelectionTarget({ eventTarget, targets, getElementRef, isExcludedTarget } = {}) {
  if (!isElementLike(eventTarget) || !Array.isArray(targets) || typeof getElementRef !== "function") return null;
  if (typeof isExcludedTarget === "function" && isExcludedTarget(eventTarget)) return null;

  const byId = new Map();
  targets.forEach((target) => {
    const elementId = getTargetId(target);
    if (typeof elementId === "string" && elementId.trim() !== "") byId.set(elementId, target);
  });

  const hits = [];
  targets.forEach((target, index) => {
    const elementId = getTargetId(target);
    if (typeof elementId !== "string" || elementId.trim() === "") return;
    if (target && typeof target === "object" && target.selectable === false) return;
    let ref;
    try { ref = getElementRef(elementId); } catch (_error) { return; }
    if (!isElementLike(ref)) return;
    let hit = false;
    try { hit = ref === eventTarget || ref.contains(eventTarget); } catch (_error) { hit = false; }
    if (!hit) return;
    hits.push({ target, elementId, ref, index, priority: getPriority(target), depth: getDepth(target, byId), area: getArea(ref) });
  });

  if (hits.length === 0) return null;
  hits.sort((a, b) => (b.priority - a.priority) || (b.depth - a.depth) || (a.area - b.area) || (a.index - b.index));
  return Object.freeze({ elementId: hits[0].elementId, target: hits[0].target, ref: hits[0].ref });
}

module.exports = { resolveSelectionTarget, isElementLike };
