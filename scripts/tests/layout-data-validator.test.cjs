#!/usr/bin/env node

const assert = require("assert/strict");
const { validateLayoutData } = require("../layout-data-validator.cjs");

function expectOk(result, label) {
  assert.equal(result.ok, true, `${label}: expected ok=true`);
  assert.deepEqual(result.errors, [], `${label}: expected no errors`);
}

function expectHasErrorCode(result, code, label) {
  assert.equal(result.ok, false, `${label}: expected ok=false`);
  assert.equal(
    result.errors.some((e) => e.code === code),
    true,
    `${label}: missing error code ${code}`
  );
}

function run() {
  // 1) gueltiges minimales Layoutdaten-Beispiel gemaess Modell
  const validMinimal = {
    version: 1,
    items: {
      "demo.header": {
        visible: true,
        x: 0,
        y: 0,
        width: 200,
        height: 40,
        order: 1,
      },
    },
  };
  expectOk(validateLayoutData(validMinimal), "valid minimal");

  // 2) ungueltige Grundstruktur
  expectHasErrorCode(validateLayoutData([]), "ROOT_NOT_OBJECT", "invalid root structure");

  // 3) fehlende Pflichtfelder gemaess Modell
  expectHasErrorCode(
    validateLayoutData({ scope: "demo.scope" }),
    "MISSING_REQUIRED_FIELD",
    "missing required fields"
  );

  // 4) falsche Datentypen gemaess Modell
  const invalidTypes = {
    version: "1",
    items: {
      "demo.header": {
        visible: "true",
        x: "0",
      },
    },
  };
  expectHasErrorCode(validateLayoutData(invalidTypes), "INVALID_TYPE", "invalid types");

  // 5) keine Fachdaten-Pflicht und keine fachlichen Begriffe
  const neutralSample = {
    version: 1,
    scope: "neutral.scope",
    items: {
      "demo.content": {
        visible: false,
        x: 10,
        y: 10,
        width: 320,
        height: 180,
        order: 2,
        layoutHint: "stacked",
      },
    },
  };
  expectOk(validateLayoutData(neutralSample), "no domain terms required");

  console.log("TESTS OK: layout-data-validator");
}

run();

