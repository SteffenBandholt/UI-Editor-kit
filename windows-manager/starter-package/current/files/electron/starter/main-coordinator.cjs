"use strict";
// Mit dem vorhandenen ui-editor-kit ElectronTargetContract und NamedPipeTargetClient verbinden.
module.exports = Object.freeze({ transport: "named-pipe", network: false, refreshEvents: Object.freeze(["registryChanged", "registryStatusChanged", "scopeAdded", "scopeChanged", "scopeRemoved"]) });
