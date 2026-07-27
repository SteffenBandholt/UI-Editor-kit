"use strict";
const registry = require("./registry.cjs");
function check() { if (registry.registryStatus !== "development" || registry.activeScopes.length !== 0) throw new Error("Das Startergeruest darf keine fertige Registry vortaeuschen."); return true; }
module.exports = Object.freeze({ check });
