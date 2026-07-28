"use strict";

const EDIT_MODES = Object.freeze({ GUIDED: "guided", FREE: "free" });
const RISK_TYPES = Object.freeze({
  LEAVES_GROUP: "leavesGroup",
  LEAVES_PARENT: "leavesParent",
  ENTERS_NEIGHBOR_AREA: "entersNeighborArea",
  OVERLAPS_NEIGHBOR: "overlapsNeighbor",
  LEAVES_EDITABLE_AREA: "leavesEditableArea",
  GROUP_OVERLAP: "groupOverlap",
  UNUSUAL_SPACING: "unusualSpacing",
});
const RISK_ACTIONS = Object.freeze({
  CLAMP_TO_GROUP: "clampToGroup",
  CLAMP_TO_AREA: "clampToArea",
  APPLY_ANYWAY: "applyAnyway",
  GO_BACK: "goBack",
  CANCEL: "cancel",
});

function finite(value) { return typeof value === "number" && Number.isFinite(value); }
function text(value, fallback = "") { return typeof value === "string" && value.trim() ? value.trim() : fallback; }
function copyBounds(value, field = "bounds") {
  if (!value || !["left", "top", "width", "height"].every((key) => finite(value[key])) || value.width <= 0 || value.height <= 0) {
    throw Object.assign(new TypeError(`${field} muss ein endliches Rechteck mit positiver Groesse sein.`), { code: "invalid_geometry" });
  }
  return Object.freeze({ left: value.left, top: value.top, width: value.width, height: value.height });
}
function right(bounds) { return bounds.left + bounds.width; }
function bottom(bounds) { return bounds.top + bounds.height; }
function contains(container, candidate, tolerance = 0.01) {
  return candidate.left >= container.left - tolerance && candidate.top >= container.top - tolerance &&
    right(candidate) <= right(container) + tolerance && bottom(candidate) <= bottom(container) + tolerance;
}
function intersection(left, rightValue) {
  const x = Math.max(left.left, rightValue.left);
  const y = Math.max(left.top, rightValue.top);
  const width = Math.max(0, Math.min(right(left), right(rightValue)) - x);
  const height = Math.max(0, Math.min(bottom(left), bottom(rightValue)) - y);
  return width > 0 && height > 0 ? Object.freeze({ left: x, top: y, width, height }) : null;
}
function area(bounds) { return bounds ? bounds.width * bounds.height : 0; }
function target(value, fallbackBounds) {
  if (!value || typeof value !== "object" || !text(value.elementId)) throw Object.assign(new TypeError("Ziel braucht eine stabile Element-ID."), { code: "missing_element_id" });
  return Object.freeze({
    elementId: text(value.elementId),
    displayName: text(value.displayName, "Ausgewähltes Element"),
    elementType: text(value.elementType, "element"),
    bounds: copyBounds(value.bounds || fallbackBounds, "target.bounds"),
  });
}
function related(value, fallbackLabel) {
  if (!value) return null;
  return Object.freeze({
    elementId: text(value.elementId),
    displayName: text(value.displayName, fallbackLabel),
    elementType: text(value.elementType, "area"),
    bounds: copyBounds(value.bounds, `${fallbackLabel}.bounds`),
  });
}
function neighbor(value) {
  const normalized = target(value);
  return Object.freeze({ ...normalized, overlapBounds: value.overlapBounds ? copyBounds(value.overlapBounds, "neighbor.overlapBounds") : null });
}
function addRisk(risks, riskType, subject) {
  if (!risks.some((risk) => risk.riskType === riskType && risk.subject?.elementId === subject?.elementId)) risks.push(Object.freeze({ riskType, subject: subject || null }));
}
function actions(editMode, risks) {
  const result = [];
  if (editMode === EDIT_MODES.GUIDED && risks.some((risk) => risk.riskType === RISK_TYPES.LEAVES_GROUP)) result.push(RISK_ACTIONS.CLAMP_TO_GROUP);
  if (editMode === EDIT_MODES.GUIDED && risks.some((risk) => [RISK_TYPES.LEAVES_PARENT, RISK_TYPES.LEAVES_EDITABLE_AREA].includes(risk.riskType))) result.push(RISK_ACTIONS.CLAMP_TO_AREA);
  result.push(RISK_ACTIONS.APPLY_ANYWAY);
  if (risks.some((risk) => [RISK_TYPES.ENTERS_NEIGHBOR_AREA, RISK_TYPES.OVERLAPS_NEIGHBOR, RISK_TYPES.GROUP_OVERLAP].includes(risk.riskType))) result.push(RISK_ACTIONS.GO_BACK);
  result.push(RISK_ACTIONS.CANCEL);
  return Object.freeze([...new Set(result)]);
}
function notice(risk, context) {
  const name = context.target.displayName;
  const subject = risk.subject?.displayName;
  switch (risk.riskType) {
    case RISK_TYPES.LEAVES_GROUP: return { title: "Element verlässt seine Gruppe", message: `Das Element „${name}“ wird außerhalb der Gruppe „${context.group?.displayName || "zugehörige Gruppe"}“ verschoben.` };
    case RISK_TYPES.LEAVES_PARENT: return { title: "Element verlässt seinen Bereich", message: `Ein Teil des Elements „${name}“ liegt künftig außerhalb von „${context.parent?.displayName || "seinem Bereich"}“.` };
    case RISK_TYPES.ENTERS_NEIGHBOR_AREA: return { title: "Element wird in einen Nachbarbereich verschoben", message: `Das Element „${name}“ wird in den Bereich „${subject || "eines Nachbarelements"}“ verschoben.` };
    case RISK_TYPES.OVERLAPS_NEIGHBOR: return { title: "Element überlappt ein Nachbarelement", message: `Das Element „${name}“ überlappt „${subject || "ein Nachbarelement"}“.` };
    case RISK_TYPES.LEAVES_EDITABLE_AREA: return { title: "Element verlässt den bearbeitbaren Bereich", message: `Ein Teil des Elements liegt künftig außerhalb des Bereichs „${context.editableArea?.displayName || "bearbeitbarer Bereich"}“.` };
    case RISK_TYPES.GROUP_OVERLAP: return { title: "Gruppe überlappt eine andere Gruppe", message: `Die Gruppe „${name}“ überlappt „${subject || "eine Nachbargruppe"}“.` };
    default: return { title: "Ungewöhnlich großer Abstand", message: `Das Element „${name}“ wird ungewöhnlich weit von seinem bisherigen Bereich verschoben.` };
  }
}
function clampBounds(candidate, container) {
  const left = candidate.width >= container.width ? container.left : Math.min(Math.max(candidate.left, container.left), right(container) - candidate.width);
  const top = candidate.height >= container.height ? container.top : Math.min(Math.max(candidate.top, container.top), bottom(container) - candidate.height);
  return Object.freeze({ left, top, width: candidate.width, height: candidate.height });
}

function evaluateGeometryRisk(input) {
  if (!input || typeof input !== "object") throw new TypeError("Geometrierisikokontext fehlt.");
  const editMode = input.editMode === EDIT_MODES.FREE ? EDIT_MODES.FREE : EDIT_MODES.GUIDED;
  const currentBounds = copyBounds(input.currentBounds || input.target?.bounds, "currentBounds");
  const targetBounds = copyBounds(input.targetBounds, "targetBounds");
  const normalizedTarget = target(input.target, currentBounds);
  const group = related(input.group, "Gruppe");
  const parent = related(input.parent, "Bereich");
  const editableArea = related(input.editableArea, "Bearbeitbarer Bereich");
  const affectedNeighbors = (Array.isArray(input.affectedNeighbors) ? input.affectedNeighbors : []).map((item) => {
    const overlapBounds = intersection(targetBounds, copyBounds(item.bounds, "neighbor.bounds"));
    return Object.freeze({ ...neighbor({ ...item, overlapBounds }), geometryChanged: item.geometryChanged === true });
  });
  const risks = [];
  if (group && !contains(group.bounds, targetBounds)) addRisk(risks, RISK_TYPES.LEAVES_GROUP, group);
  if (parent && !contains(parent.bounds, targetBounds)) addRisk(risks, RISK_TYPES.LEAVES_PARENT, parent);
  if (editableArea && !contains(editableArea.bounds, targetBounds)) addRisk(risks, RISK_TYPES.LEAVES_EDITABLE_AREA, editableArea);
  for (const item of affectedNeighbors) {
    const nextOverlap = item.overlapBounds;
    const previousOverlap = intersection(currentBounds, item.bounds);
    if (!nextOverlap || area(nextOverlap) <= area(previousOverlap) + 0.5) continue;
    if (["area", "group", "fieldGroup", "layoutZone"].includes(item.elementType)) addRisk(risks, RISK_TYPES.ENTERS_NEIGHBOR_AREA, item);
    else addRisk(risks, RISK_TYPES.OVERLAPS_NEIGHBOR, item);
    if (["group", "fieldGroup"].includes(normalizedTarget.elementType) && ["group", "fieldGroup"].includes(item.elementType)) addRisk(risks, RISK_TYPES.GROUP_OVERLAP, item);
    continue;
  }
  for (const item of affectedNeighbors) {
    if (item.geometryChanged && !risks.some((risk) => risk.subject?.elementId === item.elementId))
      addRisk(risks, RISK_TYPES.ENTERS_NEIGHBOR_AREA, item);
  }
  const distance = Math.hypot(targetBounds.left - currentBounds.left, targetBounds.top - currentBounds.top);
  const unusualDistance = finite(input.unusualSpacingThreshold) ? input.unusualSpacingThreshold : Math.max(currentBounds.width, currentBounds.height) * 4;
  if (distance > unusualDistance) addRisk(risks, RISK_TYPES.UNUSUAL_SPACING, null);
  const context = { target: normalizedTarget, group, parent, editableArea };
  const primary = risks.length ? notice(risks[0], context) : null;
  const operationId = text(input.operationId);
  if (!operationId) throw Object.assign(new TypeError("operationId fehlt."), { code: "missing_operation_id" });
  const technicalDetails = Object.freeze({
    elementId: normalizedTarget.elementId,
    groupId: group?.elementId || null,
    parentId: parent?.elementId || null,
    editableAreaId: editableArea?.elementId || null,
    scopeId: text(input.scopeId) || null,
    registryVersion: input.registryVersion ?? null,
    registryFingerprint: text(input.registryFingerprint) || null,
    effectScope: text(input.effectScope) || null,
    affectedElementIds: Object.freeze(affectedNeighbors.map((item) => item.elementId)),
    currentBounds,
    targetBounds,
    errorCode: text(input.errorCode) || null,
    hostAdapterReadback: input.hostAdapterReadback ?? null,
    rollbackStatus: text(input.rollbackStatus, "guaranteed"),
  });
  return Object.freeze({
    hasRisks: risks.length > 0,
    editMode,
    riskType: risks[0]?.riskType || null,
    risks: Object.freeze(risks),
    title: primary?.title || "",
    message: primary?.message || "",
    target: Object.freeze({ ...normalizedTarget, bounds: targetBounds }),
    group,
    parent,
    editableArea,
    affectedNeighbors: Object.freeze(affectedNeighbors),
    suggestedActions: actions(editMode, risks),
    technicalDetails,
    operationId,
    rollbackToken: text(input.rollbackToken) || null,
    preview: Object.freeze({ currentBounds, targetBounds, groupBounds: group?.bounds || null, areaBounds: editableArea?.bounds || parent?.bounds || null }),
    clampedToGroupBounds: group ? clampBounds(targetBounds, group.bounds) : null,
    clampedToAreaBounds: editableArea || parent ? clampBounds(targetBounds, (editableArea || parent).bounds) : null,
  });
}

function createPdfGeometryNotice({ riskType = RISK_TYPES.LEAVES_EDITABLE_AREA, displayName = "PDF-Element", areaName = "Seitenbereich", technicalDetails = {} } = {}) {
  const normalizedRisk = Object.values(RISK_TYPES).includes(riskType) ? riskType : RISK_TYPES.LEAVES_EDITABLE_AREA;
  const title = normalizedRisk === RISK_TYPES.OVERLAPS_NEIGHBOR ? "PDF-Element überlappt ein anderes Element" : "PDF-Element verlässt den Seitenbereich";
  const message = normalizedRisk === RISK_TYPES.OVERLAPS_NEIGHBOR
    ? `Das Element „${text(displayName, "PDF-Element")}“ überlappt ein anderes PDF-Element.`
    : `Das Element „${text(displayName, "PDF-Element")}“ überschreitet den Bereich „${text(areaName, "Seitenbereich")}“.`;
  return Object.freeze({ title, message, riskType: normalizedRisk, technicalDetails: Object.freeze({ ...technicalDetails }) });
}

module.exports = Object.freeze({ EDIT_MODES, RISK_TYPES, RISK_ACTIONS, evaluateGeometryRisk, createPdfGeometryNotice, clampBounds, intersection, contains });
