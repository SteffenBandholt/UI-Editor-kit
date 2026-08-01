const UI_COMPONENT_REFERENCE_KINDS = Object.freeze(["single", "multi"]);
const UI_COMPONENT_PRESENCE_MODES = Object.freeze(["always", "whenVisibleInstances"]);

function isObject(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function text(value) { return typeof value === "string" ? value.trim() : ""; }
function finite(value) { return Number.isFinite(Number(value)); }
function error(code, message, details = {}) { return Object.freeze({ code, message, ...details }); }

function cloneElement(element, component, slot) {
  return Object.freeze({
    ...element,
    componentId: component.componentId,
    scopeId: text(element.scopeId) || component.scopeId,
    slotId: slot.slotId,
    refKey: text(element.refKey),
    referenceKind: slot.referenceKind,
    requiredSlot: slot.required !== false,
  });
}

function normalizeUiComponentContract(component) {
  if (!isObject(component)) return null;
  const componentId = text(component.componentId);
  const scopeId = text(component.scopeId);
  const requiredSlots = Array.isArray(component.requiredSlots)
    ? [...new Set(component.requiredSlots.map(text).filter(Boolean))]
    : [];
  const slots = Array.isArray(component.slots)
    ? component.slots.map((slot) => {
      if (!isObject(slot)) return slot;
      const normalized = {
        ...slot,
        slotId: text(slot.slotId),
        required: slot.required !== false,
        referenceKind: text(slot.referenceKind) || "single",
        presence: text(slot.presence) || "always",
      };
      if (isObject(slot.element)) normalized.element = cloneElement(slot.element, { componentId, scopeId }, normalized);
      return Object.freeze(normalized);
    })
    : [];
  return Object.freeze({ ...component, componentId, scopeId, requiredSlots: Object.freeze(requiredSlots), slots: Object.freeze(slots) });
}

function aggregateUiComponentContracts(components) {
  const normalized = Object.freeze((Array.isArray(components) ? components : []).map(normalizeUiComponentContract));
  const elements = Object.freeze(normalized.flatMap((component) => component?.slots || []).map((slot) => slot?.element).filter(Boolean));
  return Object.freeze({ components: normalized, elements });
}

function validateStableElementId(element, component, slot, errors) {
  const elementId = text(element?.id);
  const context = { componentId: component.componentId, slotId: slot.slotId, elementId };
  if (!elementId || !/^[A-Za-z][A-Za-z0-9]*(?:[._-][A-Za-z0-9]+)+$/.test(elementId) || element?.stableIdSource !== "declaration") {
    errors.push(error("component_unstable_element_id", "Element-ID muss statisch aus der Quelldeklaration stammen.", context));
  }
}

function validateBounds(element, component, slot, errors) {
  const operations = Array.isArray(element.allowedOps) ? element.allowedOps : [];
  const baseline = isObject(element.baseline) ? element.baseline : {};
  const context = { componentId: component.componentId, slotId: slot.slotId, elementId: text(element.id) };
  const validRange = (minimum, maximum) => finite(minimum) && finite(maximum) && Number(minimum) > 0 && Number(maximum) >= Number(minimum);
  if ((operations.includes("resize") || operations.includes("resizeWidth")) && !validRange(baseline.minWidth, baseline.maxWidth)) {
    errors.push(error("component_resize_bounds_missing", "Breitenziel braucht gueltige minWidth/maxWidth-Grenzen.", { ...context, dimension: "width" }));
  }
  if ((operations.includes("resize") || operations.includes("resizeHeight")) && !validRange(baseline.minHeight, baseline.maxHeight)) {
    errors.push(error("component_resize_bounds_missing", "Hoehenziel braucht gueltige minHeight/maxHeight-Grenzen.", { ...context, dimension: "height" }));
  }
}

function validateRequirements(element, component, slot, errors) {
  const operations = Array.isArray(element.allowedOps) ? element.allowedOps : [];
  const requirements = isObject(slot.requirements) ? slot.requirements : {};
  const context = { componentId: component.componentId, slotId: slot.slotId, elementId: text(element.id) };
  if (requirements.textResize === true && !operations.includes("textResize")) errors.push(error("component_required_text_resize_missing", "Textslot verlangt textResize, die Capability fehlt.", context));
  if (requirements.move === true && !operations.includes("move")) errors.push(error("component_required_move_missing", "Verschiebbarer Slot verlangt move, die Capability fehlt.", context));
}

function validateUiComponentContracts({ components, registryElements = null, supportedOperations = null } = {}) {
  const errors = [];
  const aggregate = aggregateUiComponentContracts(components);
  const componentIds = new Set();
  const elementIds = new Set();
  for (const component of aggregate.components) {
    if (!component?.componentId || !component.scopeId) {
      errors.push(error("component_identity_missing", "Komponente braucht componentId und scopeId.", { componentId: component?.componentId || "" }));
      continue;
    }
    if (componentIds.has(component.componentId)) errors.push(error("component_id_duplicate", "componentId ist doppelt deklariert.", { componentId: component.componentId }));
    componentIds.add(component.componentId);
    const slotsById = new Map();
    for (const slot of component.slots) {
      if (!isObject(slot) || !slot.slotId || slotsById.has(slot.slotId)) {
        errors.push(error("component_slot_duplicate", "Slot fehlt oder ist innerhalb der Komponente doppelt.", { componentId: component.componentId, slotId: slot?.slotId || "" }));
        continue;
      }
      slotsById.set(slot.slotId, slot);
      if (!UI_COMPONENT_REFERENCE_KINDS.includes(slot.referenceKind)) errors.push(error("component_reference_kind_invalid", "Slot braucht single- oder multi-Ref-Semantik.", { componentId: component.componentId, slotId: slot.slotId }));
      if (!UI_COMPONENT_PRESENCE_MODES.includes(slot.presence)) errors.push(error("component_presence_invalid", "Slot-Praesenz ist ungueltig.", { componentId: component.componentId, slotId: slot.slotId }));
      if (!isObject(slot.element)) {
        errors.push(error("component_slot_registry_target_missing", "Deklarierter Slot besitzt kein Registryziel.", { componentId: component.componentId, slotId: slot.slotId }));
        continue;
      }
      validateStableElementId(slot.element, component, slot, errors);
      const elementId = text(slot.element.id);
      if (elementIds.has(elementId)) errors.push(error("component_element_id_duplicate", "Element-ID ist komponentenuebergreifend doppelt.", { componentId: component.componentId, slotId: slot.slotId, elementId }));
      elementIds.add(elementId);
      if (!text(slot.element.refKey)) errors.push(error("component_slot_reference_missing", "Registryziel besitzt keinen expliziten refKey.", { componentId: component.componentId, slotId: slot.slotId, elementId }));
      if (!isObject(slot.element.baseline)) errors.push(error("component_baseline_missing", "Registryziel besitzt keine Baseline.", { componentId: component.componentId, slotId: slot.slotId, elementId }));
      const allowedOps = Array.isArray(slot.element.allowedOps) ? slot.element.allowedOps : [];
      if (Array.isArray(supportedOperations)) {
        for (const operation of allowedOps) {
          if (!supportedOperations.includes(operation)) errors.push(error("component_capability_unsupported", "Capability besitzt keinen Hostweg.", { componentId: component.componentId, slotId: slot.slotId, elementId, operation }));
        }
      }
      validateBounds(slot.element, component, slot, errors);
      validateRequirements(slot.element, component, slot, errors);
    }
    for (const slotId of component.requiredSlots) {
      const slot = slotsById.get(slotId);
      if (!slot || slot.required === false) errors.push(error("component_required_slot_missing", "Verpflichtender Komponentenslot fehlt.", { componentId: component.componentId, slotId }));
    }
  }
  const byElementId = new Map(aggregate.elements.map((element) => [element.id, element]));
  for (const element of aggregate.elements) {
    if (element.parentId != null && !byElementId.has(element.parentId)) errors.push(error("component_parent_missing", "Parent des Komponenten-Slots fehlt.", { componentId: element.componentId, slotId: element.slotId, elementId: element.id, parentId: element.parentId }));
  }
  if (Array.isArray(registryElements)) {
    const registryIds = new Set(registryElements.map((entry) => text(entry?.id)).filter(Boolean));
    for (const element of aggregate.elements) if (!registryIds.has(element.id)) errors.push(error("component_registry_target_missing", "Komponentenziel fehlt in der aggregierten Registry.", { componentId: element.componentId, slotId: element.slotId, elementId: element.id }));
    for (const registryId of registryIds) if (!byElementId.has(registryId)) errors.push(error("component_registry_target_outside_contract", "Registryziel gehoert zu keinem Komponentenvertrag.", { elementId: registryId }));
  }
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors), components: aggregate.components, elements: aggregate.elements });
}

function validateUiComponentReferenceBindings({ components, bindings, componentIds } = {}) {
  const contract = validateUiComponentContracts({ components });
  const errors = [...contract.errors];
  const selectedComponentIds = Array.isArray(componentIds)
    ? new Set(componentIds.map(text).filter(Boolean))
    : null;
  const bindingList = Array.isArray(bindings) ? bindings : [];
  const byKey = new Map(bindingList.map((binding) => [`${text(binding?.componentId)}\0${text(binding?.slotId)}`, binding]));
  const knownKeys = new Set();
  for (const component of contract.components) {
    if (selectedComponentIds && !selectedComponentIds.has(component.componentId)) continue;
    for (const slot of component.slots) {
      const key = `${component.componentId}\0${slot.slotId}`;
      knownKeys.add(key);
      const binding = byKey.get(key);
      const context = { componentId: component.componentId, slotId: slot.slotId, elementId: slot.element?.id || "" };
      if (!binding) {
        if (slot.required !== false) errors.push(error("component_slot_reference_missing", "Komponentenslot besitzt keine Ref-Bindung.", context));
        continue;
      }
      const targetCount = Number(binding.targetCount || 0);
      const mountedInstanceCount = Number(binding.mountedInstanceCount || 0);
      if (slot.referenceKind === "single" && targetCount !== 1) errors.push(error(targetCount > 1 ? "component_single_ref_duplicate" : "component_ref_unresolved", targetCount > 1 ? "Einzel-Ref loest mehrere Ziele auf." : "Einzel-Ref findet kein vorhandenes Ziel.", { ...context, targetCount }));
      if (slot.referenceKind === "multi" && mountedInstanceCount > 0 && targetCount < 1) errors.push(error("component_multi_ref_missing", "Multi-Ref findet trotz sichtbarer Instanzen kein Ziel.", { ...context, mountedInstanceCount, targetCount }));
      if (binding.referenceResolved !== true && !(slot.referenceKind === "multi" && mountedInstanceCount === 0)) errors.push(error("component_ref_unresolved", "Expliziter Ref-Resolver konnte das Ziel nicht aufloesen.", context));
      if (slot.requirements?.directSelection === true && targetCount > 0) {
        const targetIds = Array.isArray(binding.selectionTargetIds) ? binding.selectionTargetIds.map(text) : [];
        const childIndex = targetIds.indexOf(slot.element.id);
        const parentIndex = slot.element.parentId ? targetIds.indexOf(slot.element.parentId) : -1;
        if (childIndex < 0 || (parentIndex >= 0 && childIndex > parentIndex)) errors.push(error("component_child_selection_swallowed", "Sichtbares Kindziel wird bei direkter Auswahl vom Parent verschluckt.", { ...context, parentId: slot.element.parentId || null }));
      }
    }
  }
  for (const binding of bindingList) {
    if (selectedComponentIds && !selectedComponentIds.has(text(binding?.componentId))) continue;
    const key = `${text(binding?.componentId)}\0${text(binding?.slotId)}`;
    if (!knownKeys.has(key)) errors.push(error("component_ref_outside_contract", "Ref-Bindung gehoert zu keinem Komponentenslot.", { componentId: text(binding?.componentId), slotId: text(binding?.slotId), elementId: text(binding?.elementId) }));
  }
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors) });
}

function depthOf(elementsById, elementId) {
  let depth = 0;
  let current = elementsById.get(elementId);
  const seen = new Set();
  while (current?.parentId && !seen.has(current.parentId)) {
    seen.add(current.parentId);
    depth += 1;
    current = elementsById.get(current.parentId);
  }
  return depth;
}

function orderUiComponentSelectionTargetIds(elements, targetIds) {
  const byId = new Map((Array.isArray(elements) ? elements : []).map((element) => [text(element?.id), element]));
  return [...new Set((Array.isArray(targetIds) ? targetIds : []).map(text).filter((id) => byId.has(id)))]
    .sort((left, right) => depthOf(byId, right) - depthOf(byId, left));
}

export {
  UI_COMPONENT_REFERENCE_KINDS,
  UI_COMPONENT_PRESENCE_MODES,
  normalizeUiComponentContract,
  aggregateUiComponentContracts,
  validateUiComponentContracts,
  validateUiComponentReferenceBindings,
  orderUiComponentSelectionTargetIds,
};
