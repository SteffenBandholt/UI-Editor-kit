#!/usr/bin/env node

/*
 * UI-Editor-Kit Vertragscheck
 *
 * Startpunkt fuer eine spaetere generische Pruefung.
 * Der Check soll in Ziel-Apps pruefen, ob editorfaehige UI-Elemente
 * die Pflichtattribute aus docs/UI_EDITOR_VERTRAG.md tragen.
 */

const REQUIRED_ATTRIBUTES = [
  "data-ui-inspector-id",
  "data-ui-editor-kind",
  "data-ui-editor-label",
  "data-ui-editor-parent",
  "data-ui-editor-editable",
];

const OPTIONAL_ATTRIBUTES = ["data-ui-editor-ops"];
const ALLOWED_KINDS = ["frame", "field", "single"];
const ALLOWED_OPS = ["move", "resize", "hide", "layout"];

function getContractSummary() {
  return {
    requiredAttributes: REQUIRED_ATTRIBUTES.slice(),
    optionalAttributes: OPTIONAL_ATTRIBUTES.slice(),
    allowedKinds: ALLOWED_KINDS.slice(),
    allowedOps: ALLOWED_OPS.slice(),
  };
}

if (require.main === module) {
  console.log(JSON.stringify(getContractSummary(), null, 2));
}

module.exports = {
  REQUIRED_ATTRIBUTES,
  OPTIONAL_ATTRIBUTES,
  ALLOWED_KINDS,
  ALLOWED_OPS,
  getContractSummary,
};
