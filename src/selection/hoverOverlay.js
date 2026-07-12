"use strict";
const { createSelectionOverlayBase } = require("./overlayBase.js");
function createHoverOverlay(options) { return createSelectionOverlayBase(Object.assign({ role: "hover", borderColor: "#2563eb", backgroundColor: "rgba(37, 99, 235, 0.10)", labelPrefix: "" }, options || {})); }
module.exports = { createHoverOverlay };
