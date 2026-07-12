"use strict";

const SELECTION_CONTRACT_VERSION = "selection-target-contract-v1.0";

const SelectionContractErrorCodes = Object.freeze({
  INVALID_TARGET_LIST: "invalid_target_list",
  INVALID_ELEMENT_ID: "invalid_element_id",
  DUPLICATE_ELEMENT_ID: "duplicate_element_id",
  INLINE_ELEMENT_REF_NOT_ALLOWED: "inline_element_ref_not_allowed",
  INVALID_ELEMENT_REF_RESOLVER: "invalid_element_ref_resolver",
  INVALID_ELEMENT_REF: "invalid_element_ref",
  INVALID_SELECTABLE_VALUE: "invalid_selectable_value",
  INVALID_HOST: "invalid_selection_host",
  MISSING_HOST_METHOD: "missing_selection_host_method",
  INVALID_HOST_CALLBACK: "invalid_selection_host_callback",
  INVALID_CONTROLLER: "invalid_selection_controller",
  MISSING_CONTROLLER_METHOD: "missing_selection_controller_method",
});

function createResult(errors, details) {
  return Object.freeze({ ok: errors.length === 0, errors, ...(details || {}) });
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function isHTMLElementLike(value) {
  if (!value || typeof value !== "object") return false;
  const GlobalHTMLElement = typeof HTMLElement === "function" ? HTMLElement : null;
  if (GlobalHTMLElement && value instanceof GlobalHTMLElement) return true;
  return value.nodeType === 1 && typeof value.getBoundingClientRect === "function" && typeof value.contains === "function";
}

function validateElementRefResolver(resolver, elementIds) {
  const errors = [];
  const unavailableElementIds = [];
  const boundElementIds = [];

  if (typeof resolver !== "function") {
    errors.push({ code: SelectionContractErrorCodes.INVALID_ELEMENT_REF_RESOLVER, message: "ElementRefResolver muss eine Funktion sein." });
    return createResult(errors, { boundTargetCount: 0, unavailableElementIds });
  }

  (Array.isArray(elementIds) ? elementIds : []).forEach((elementId) => {
    let ref;
    try {
      ref = resolver(elementId);
    } catch (cause) {
      errors.push({ code: SelectionContractErrorCodes.INVALID_ELEMENT_REF, elementId, message: "ElementRefResolver darf fuer ein Ziel nicht werfen.", cause });
      unavailableElementIds.push(elementId);
      return;
    }

    if (ref == null) {
      unavailableElementIds.push(elementId);
      return;
    }

    if (!isHTMLElementLike(ref)) {
      errors.push({ code: SelectionContractErrorCodes.INVALID_ELEMENT_REF, elementId, message: "ElementRefResolver muss HTMLElement oder null liefern." });
      return;
    }

    boundElementIds.push(elementId);
  });

  return createResult(errors, { boundTargetCount: boundElementIds.length, unavailableElementIds, boundElementIds });
}

function normalizeSelectionTargetMeta(target) {
  if (!isObject(target)) return null;
  return Object.freeze({
    elementId: typeof target.elementId === "string" ? target.elementId.trim() : target.elementId,
    ...(target.label === undefined ? {} : { label: target.label }),
    ...(target.parentId === undefined ? {} : { parentId: target.parentId }),
    selectable: target.selectable === undefined ? true : target.selectable,
    ...(target.metadata === undefined ? {} : { metadata: target.metadata }),
  });
}

function validateSelectionTargetContract(input) {
  const errors = [];
  const targets = Array.isArray(input) ? input : input && input.targets;
  const resolver = input && input.getElementRef;

  if (!Array.isArray(targets)) {
    errors.push({ code: SelectionContractErrorCodes.INVALID_TARGET_LIST, message: "Selection-Targets muessen als Array uebergeben werden." });
    return createResult(errors, { normalizedTargets: [], boundTargetCount: 0, unavailableElementIds: [] });
  }

  const seen = new Set();
  const normalizedTargets = [];

  targets.forEach((target, index) => {
    if (!isObject(target)) {
      errors.push({ code: SelectionContractErrorCodes.INVALID_TARGET_LIST, index, message: "Selection-Target muss ein Objekt sein." });
      return;
    }

    if (Object.prototype.hasOwnProperty.call(target, "elementRef")) {
      errors.push({ code: SelectionContractErrorCodes.INLINE_ELEMENT_REF_NOT_ALLOWED, index, message: "HTMLElement-Referenzen gehoeren in den ElementRefResolver, nicht in Registry-Metadaten." });
    }

    const normalized = normalizeSelectionTargetMeta(target);
    if (!isNonEmptyString(normalized.elementId)) {
      errors.push({ code: SelectionContractErrorCodes.INVALID_ELEMENT_ID, index, message: "elementId muss eine nicht leere Zeichenkette sein." });
      return;
    }

    if (seen.has(normalized.elementId)) {
      errors.push({ code: SelectionContractErrorCodes.DUPLICATE_ELEMENT_ID, elementId: normalized.elementId, message: "elementId muss eindeutig sein." });
    }
    seen.add(normalized.elementId);

    if (typeof normalized.selectable !== "boolean") {
      errors.push({ code: SelectionContractErrorCodes.INVALID_SELECTABLE_VALUE, elementId: normalized.elementId, message: "selectable muss boolean sein, falls gesetzt." });
    }

    normalizedTargets.push(normalized);
  });

  const elementIds = normalizedTargets.map((target) => target.elementId);
  const resolverResult = resolver === undefined
    ? createResult([], { boundTargetCount: 0, unavailableElementIds: elementIds.slice(), boundElementIds: [] })
    : validateElementRefResolver(resolver, elementIds);

  return createResult(errors.concat(resolverResult.errors), {
    normalizedTargets,
    boundTargetCount: resolverResult.boundTargetCount,
    unavailableElementIds: resolverResult.unavailableElementIds,
    boundElementIds: resolverResult.boundElementIds || [],
  });
}

module.exports = {
  SELECTION_CONTRACT_VERSION,
  SelectionContractErrorCodes,
  validateSelectionTargetContract,
  validateElementRefResolver,
  normalizeSelectionTargetMeta,
};
