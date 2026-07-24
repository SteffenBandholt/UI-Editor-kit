"use strict";
const assert = require("node:assert/strict");
const { normalizeLayoutEntry } = require("../src/index.cjs");
assert.deepEqual(normalizeLayoutEntry({ elementId: "customer.name", element: { x: 0, y: 0, width: 280, height: 40, visible: true }, text: { offsetX: 12, offsetY: 0, fontSize: 16 }, textOffsetX: 999 }), { elementId: "customer.name", element: { x: 0, y: 0, width: 280, height: 40, visible: true }, text: { offsetX: 12, offsetY: 0, fontSize: 16 } });
console.log("m72 editor model text ok");
