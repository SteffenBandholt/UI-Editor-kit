"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  createTextResizePayload,
  normalizeTextResizeIntent,
  verifyTextResizeReadback,
} = require("../../src/index.cjs");

let failures = 0;
function run(name, test) {
  try { test(); console.log(`PASS M82.7.2 UI-Editor-kit: ${name}`); }
  catch (error) { failures += 1; console.error(`FAIL M82.7.2 UI-Editor-kit: ${name}`); console.error(error); }
}

run("DIP-Payload enthaelt Zielwert und erwarteten Host-Istwert", () => {
  assert.deepEqual(createTextResizePayload(15.5, 14), {
    text: { fontSize: 15.5, unit: "dip", expectedCurrentFontSize: 14 },
  });
});

run("Host-Konfliktpruefung lehnt einen veralteten Ausgangswert ab", () => {
  const result = normalizeTextResizeIntent(createTextResizePayload(16, 14), {
    minimumFontSize: 8, maximumFontSize: 40, currentFontSize: 15,
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "text_resize_expected_value_conflict");
});

run("ein gewuenschter Wert allein ist noch kein Erfolg", () => {
  const result = verifyTextResizeReadback({ requestedFontSize: 16, previousFontSize: 14 });
  assert.equal(result.ok, false);
  assert.equal(result.code, "text_resize_readback_missing");
});

run("unveraenderter Host-Istwert ist kein Erfolg", () => {
  const result = verifyTextResizeReadback({ requestedFontSize: 14, previousFontSize: 14, appliedFontSize: 14 });
  assert.equal(result.ok, false);
  assert.equal(result.code, "text_resize_no_effect");
});

run("abweichender Host-Istwert ist kein Erfolg", () => {
  const result = verifyTextResizeReadback({ requestedFontSize: 16, previousFontSize: 14, appliedFontSize: 14 });
  assert.equal(result.ok, false);
  assert.equal(result.code, "text_resize_readback_mismatch");
});

run("Rundungstoleranz akzeptiert einen real geaenderten Host-Istwert", () => {
  const result = verifyTextResizeReadback({ requestedFontSize: 15.333, previousFontSize: 14, appliedFontSize: 15.34 });
  assert.equal(result.ok, true);
  assert.equal(result.readback.changed, true);
  assert.equal(result.readback.matchesRequested, true);
});

run("Schriftsteuerung bleibt capability-gesteuert und sendet den Istwert", () => {
  const controller = fs.readFileSync(path.join(process.cwd(), "src/panel/ui-editor-panel-controller.cjs"), "utf8");
  assert.match(controller, /effectiveOps\.includes\("textResize"\)/);
  assert.match(controller, /createTextResizePayload\(fontSize, current\)/);
});

run("gemeinsamer Core enthaelt keine BBM-Element-IDs", () => {
  const roots = ["src/core", "src/panel"];
  const source = roots.flatMap((root) => fs.readdirSync(path.join(process.cwd(), root))
    .filter((file) => file.endsWith(".cjs"))
    .map((file) => fs.readFileSync(path.join(process.cwd(), root, file), "utf8"))).join("\n");
  assert.doesNotMatch(source, /restarbeiten\.|protokoll\./);
});

if (failures) process.exitCode = 1;
