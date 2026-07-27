"use strict";
// Ausschliesslich feste UI-Editor-Nachrichten exponieren; keine generische IPC-API.
module.exports = Object.freeze({ allowedActions: Object.freeze(["openEditor", "closeEditor", "getStatus", "respond", "targetEvent"]) });
