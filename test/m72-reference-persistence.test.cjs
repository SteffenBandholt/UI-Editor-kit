"use strict";
const {assert,createDoc,memoryStorage}=require("./m72-reference-test-helpers.cjs");
const {createReferenceApp}=require("../examples/browser-reference/reference-app.cjs");
const storage=memoryStorage(); let doc=createDoc(); let app=createReferenceApp({documentAdapter:doc,windowAdapter:{localStorage:storage,addEventListener(){},removeEventListener(){}},root:doc.getElementById("reference-app")});
app.selectionHost.select("demo.card"); app.runtime.applyChange({elementId:"demo.card",operation:"move",payload:{x:25},source:"test"}); assert.equal(app.runtime.saveLayout().ok,true); app.destroy();
doc=createDoc(); app=createReferenceApp({documentAdapter:doc,windowAdapter:{localStorage:storage,addEventListener(){},removeEventListener(){}},root:doc.getElementById("reference-app")}); assert.equal(doc.getElementById("reference-demo-card").style["--ui-editor-x"],"25px");
const compact=app.storage.getKey({...app.targetContext,layoutProfileId:"compact"}); assert.equal(storage.getItem(compact),null);
app.destroy(); doc=createDoc(); app=createReferenceApp({documentAdapter:doc,windowAdapter:{localStorage:null,addEventListener(){},removeEventListener(){}},root:doc.getElementById("reference-app")}); assert.equal(app.runtime.getPersistenceStatus().available,false); app.destroy();
console.log("m72 reference persistence ok");
