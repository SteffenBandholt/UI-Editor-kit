"use strict";
const { assert, createDoc, memoryStorage } = require("./m72-reference-test-helpers.cjs");
const { createReferenceApp, startReferenceApp, resolveBrowserStorage, REF_BINDINGS } = require("../examples/browser-reference/reference-app.cjs");

const doc = createDoc();
const app = createReferenceApp({ documentAdapter: doc, windowAdapter: { localStorage: memoryStorage(), addEventListener(){}, removeEventListener(){} }, root: doc.getElementById("reference-app") });
assert.equal(app.runtime.getSessionStatus().active, true);
assert.deepEqual(app.elementRefs.listIds().sort(), REF_BINDINGS.map((binding) => binding[0]).sort());
assert.ok(doc.getElementById("reference-panel").children.length > 0);
assert.equal(app.registry.getElementById("demo.card").minWidth, 160);
app.destroy();

const throwingWindow = { get localStorage() { throw new Error("blocked"); }, addEventListener(){}, removeEventListener(){} };
assert.deepEqual(resolveBrowserStorage(throwingWindow), { ok: false, storage: null, code: "STORAGE_UNAVAILABLE" });
const storageErrorDoc = createDoc();
const storageErrorApp = startReferenceApp({ documentAdapter: storageErrorDoc, windowAdapter: throwingWindow, root: storageErrorDoc.getElementById("reference-app") });
assert.equal(storageErrorApp.runtime.getPersistenceStatus().available, false);
assert.equal(storageErrorApp.storage.available, false);
assert.match(storageErrorDoc.getElementById("reference-errors").textContent, /STORAGE_UNAVAILABLE/);
storageErrorApp.runtime.applyChange({ elementId: "demo.card", operation: "move", payload: { x: 5 }, source: "test" });
assert.equal(storageErrorDoc.getElementById("reference-demo-card").style["--ui-editor-x"], "5px");
storageErrorApp.destroy();

const missingMountDoc = createDoc({ omitIds: ["reference-panel"] });
const missingMountApp = startReferenceApp({ documentAdapter: missingMountDoc, windowAdapter: { localStorage: memoryStorage() }, root: missingMountDoc.getElementById("reference-app") });
assert.equal(missingMountApp.ok, false);
assert.equal(missingMountApp.code, "PANEL_MOUNT_MISSING");
assert.match(missingMountDoc.getElementById("reference-app").innerHTML, /PANEL_MOUNT_MISSING/);
console.log("m72 reference app ok");
