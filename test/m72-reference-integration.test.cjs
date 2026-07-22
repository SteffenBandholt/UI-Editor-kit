"use strict";
const {assert,createDoc,memoryStorage}=require("./m72-reference-test-helpers.cjs");
const {createReferenceApp}=require("../examples/browser-reference/reference-app.cjs");
(async()=>{
const doc=createDoc(); const app=createReferenceApp({documentAdapter:doc,windowAdapter:{localStorage:memoryStorage(),addEventListener(){},removeEventListener(){}},root:doc.getElementById("reference-app")});
doc.getElementById("reference-demo-card").dispatch("click");
assert.equal(app.selectionHost.getSelection().selectedElementId,"demo.card");
assert.equal(app.overlayHost.getState().visible,true);
app.controller.setMode("move"); await app.controller.activateDirection("right");
assert.equal(doc.getElementById("reference-demo-card").style["--ui-editor-x"],"5px");
app.controller.setMode("width"); await app.controller.activateDirection("right");
assert.equal(doc.getElementById("reference-demo-card").style["--ui-editor-width"],"265px");
app.destroy(); console.log("m72 reference integration ok");
})();
