export const UI_EDITOR_ID_ATTRIBUTE = "data-ui-editor-id";

function normalizeString(value) {
  return String(value || "").trim();
}

export function getNodeUiEditorId(node = null) {
  return normalizeString(node?.getAttribute?.(UI_EDITOR_ID_ATTRIBUTE));
}

export function findAncestorUiEditorElementById(targetNode = null, elementId = "") {
  const normalizedElementId = normalizeString(elementId);
  if (!targetNode || !normalizedElementId) return null;

  let current = targetNode.parentElement || null;
  while (current) {
    if (getNodeUiEditorId(current) === normalizedElementId) return current;
    current = current.parentElement || null;
  }

  return null;
}

export function normalizePreviewTargetMode(value = null) {
  if (typeof value === "string") return value.trim().toLowerCase();
  if (value && typeof value === "object" && typeof value.mode === "string") {
    return value.mode.trim().toLowerCase();
  }
  if (typeof value === "boolean") return value ? "parent" : "";
  return "";
}

export function getPreviewTargetMode(registryElement = null) {
  const explicitMode = normalizePreviewTargetMode(registryElement?.previewTargetMode)
    || normalizePreviewTargetMode(registryElement?.previewTarget)
    || normalizePreviewTargetMode(registryElement?.affectsContainer)
    || normalizePreviewTargetMode(registryElement?.editGranularity);

  if (["self", "element", "selected"].includes(explicitMode)) return "self";
  if (["parent", "container", "layoutcontainer", "layout-container"].includes(explicitMode)) return "parent";
  return "auto";
}

function resolveSelectedElement({ selectionElement = null, selectedId = "", getRegisteredElementById = null } = {}) {
  const normalizedSelectedId = normalizeString(selectedId || selectionElement?.id);
  if (normalizedSelectedId && typeof getRegisteredElementById === "function") {
    return getRegisteredElementById(normalizedSelectedId) || selectionElement;
  }

  return selectionElement;
}

export function resolvePreviewTargetElement({
  selectionElement = null,
  selectedId = "",
  targetNode = null,
  getRegisteredElementById = null,
} = {}) {
  if (!targetNode) return null;

  const selectedElement = resolveSelectedElement({ selectionElement, selectedId, getRegisteredElementById });
  if (getPreviewTargetMode(selectedElement) !== "parent") return targetNode;

  return findAncestorUiEditorElementById(targetNode, selectedElement?.parentId) || targetNode;
}

export function getPreviewTargetElement(state = {}) {
  return state?.selectedPreviewTargetNode || state?.selectedTargetNode || null;
}

export function getPreviewTargetElementId(state = {}, targetNode = null) {
  return getNodeUiEditorId(targetNode) || normalizeString(state?.selectedElement?.id);
}
