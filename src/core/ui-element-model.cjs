"use strict";

const UI_ELEMENT_TYPES = Object.freeze([
  "root",
  "area",
  "group",
  "subgroup",
  "component",
  "componentPart",
  "table",
  "tableColumn",
  "list",
  "card",
  "dialog",
  "toolbar",
  "button",
  "field",
  "label",
  "fieldGroup",
  "statusIndicator",
]);

const UI_ELEMENT_ROLES = Object.freeze([
  "layout",
  "content",
  "meta",
  "structure",
  "status",
  "date",
  "responsible",
  "visibility",
  "action",
  "navigation",
  "editor-launcher",
  "system",
  "scopeRoot",
  "contentArea",
  "formArea",
  "layoutGroup",
  "fieldCollection",
  "formFieldGroup",
  "fieldLabel",
  "dataFieldLayout",
  "contentTable",
  "contentColumn",
  "metaColumn",
  "domainActionLayout",
]);

const UI_ELEMENT_OPERATIONS = Object.freeze([
  "inspect",
  "show",
  "hide",
  "move",
  "resize",
  "resizeWidth",
  "resizeHeight",
  "textMove",
  "textResize",
  "setVisibility",
  "spacingIncrease",
  "spacingDecrease",
  "spacingSet",
  "spacingReset",
  "reorder",
  "rename",
  "changeWidth",
  "pin",
  "unpin",
  "reset",
  "applyPreset",
  "delete",
  "executeTargetAction",
  "modifyDomainData",
  "createRecord",
  "deleteRecord",
]);

const UI_ELEMENT_REQUIRED_FIELDS = Object.freeze([
  "id",
  "name",
  "type",
  "role",
  "parentId",
  "order",
  "visible",
  "editable",
  "allowedOps",
  "lockedOps",
]);

const UI_ELEMENT_OPTIONAL_FIELDS = Object.freeze([
  "columnRole",
  "fieldKind",
  "actionKind",
  "componentKind",
  "width",
  "minWidth",
  "maxWidth",
  "layoutArea",
  "selectionKind",
  "selectionLevels",
  "operationEffects",
  "operationAffectedIds",
  "geometry",
  "spacingTargets",
]);

const UI_ELEMENT_ARRAY_FIELDS = Object.freeze(["allowedOps", "lockedOps", "selectionLevels", "spacingTargets"]);
const UI_ELEMENT_BOOLEAN_FIELDS = Object.freeze(["visible", "editable"]);
const UI_ELEMENT_NUMERIC_FIELDS = Object.freeze(["order", "width", "minWidth", "maxWidth"]);
const UI_ELEMENT_FIELDS = Object.freeze([...UI_ELEMENT_REQUIRED_FIELDS, ...UI_ELEMENT_OPTIONAL_FIELDS]);

function hasOwn(source, key) {
  return Boolean(source) && Object.prototype.hasOwnProperty.call(source, key);
}

function cloneFieldValue(fieldName, value) {
  if (UI_ELEMENT_ARRAY_FIELDS.includes(fieldName) && Array.isArray(value)) {
    return value.slice();
  }

  return value;
}

function normalizeUiElement(element) {
  if (!element || typeof element !== "object" || Array.isArray(element)) {
    return {};
  }

  const normalized = {};

  for (const fieldName of UI_ELEMENT_FIELDS) {
    if (!hasOwn(element, fieldName)) {
      continue;
    }

    normalized[fieldName] = cloneFieldValue(fieldName, element[fieldName]);
  }

  return normalized;
}

function createUiElement(values) {
  return normalizeUiElement(values);
}

module.exports = {
  UI_ELEMENT_TYPES,
  UI_ELEMENT_ROLES,
  UI_ELEMENT_OPERATIONS,
  UI_ELEMENT_REQUIRED_FIELDS,
  UI_ELEMENT_OPTIONAL_FIELDS,
  UI_ELEMENT_ARRAY_FIELDS,
  UI_ELEMENT_BOOLEAN_FIELDS,
  UI_ELEMENT_NUMERIC_FIELDS,
  UI_ELEMENT_FIELDS,
  normalizeUiElement,
  createUiElement,
};
