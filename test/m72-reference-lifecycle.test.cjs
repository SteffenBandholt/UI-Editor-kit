"use strict";
const {assert,createDoc,memoryStorage}=require("./m72-reference-test-helpers.cjs");
const {createReferenceApp}=require("../examples/browser-reference/reference-app.cjs");
const doc=createDoc(); const cardBeforeTransform="rotate(1deg)"; const app=createReferenceApp({documentAdapter:doc,windowAdapter:{localStorage:memoryStorage(),addEventListener(){},removeEventListener(){}},root:doc.getElementById("reference-app")});
doc.getElementById("reference-demo-card").style.transform=cardBeforeTransform; app.runtime.applyChange({elementId:"demo.card",operation:"move",payload:{x:5},source:"test"}); assert.equal(app.runtime.resetElementToDefaults("demo.card").ok,true); assert.equal(doc.getElementById("reference-demo-card").style.transform,cardBeforeTransform);
app.destroy(); app.destroy(); assert.equal(app.elementRefs.listIds().length,0); assert.equal(app.bridge.updateOverlay().code,"BRIDGE_DESTROYED");
console.log("m72 reference lifecycle ok");
