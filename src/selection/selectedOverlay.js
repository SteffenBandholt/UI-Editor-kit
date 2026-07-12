"use strict";
const { createSelectionOverlayBase } = require("./overlayBase.js");
function createSelectedOverlay(options) { return createSelectionOverlayBase(Object.assign({ role: "selected", borderColor: "#f97316", backgroundColor: "rgba(249, 115, 22, 0.12)", labelPrefix: "Selected" }, options || {})); }
module.exports = { createSelectedOverlay };
