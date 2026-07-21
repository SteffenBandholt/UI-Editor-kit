"use strict";
const fs=require("fs"); const path=require("path"); const { assert, createRegistry, createHost, createStorage, context } = require("./m69-test-helpers.cjs");
const { createUiEditorRuntime } = require("../src/index.cjs");
const files=fs.readdirSync(path.join(__dirname,"../src/runtime")).filter(f=>f.endsWith(".cjs")); const forbidden=["BBM","Restarbeiten","Protokoll","querySelector","querySelectorAll","localStorage","document.","window."];
for(const f of files){ const text=fs.readFileSync(path.join(__dirname,"../src/runtime",f),"utf8"); for(const term of forbidden) assert.equal(text.includes(term),false,`${f} contains ${term}`); }
const host=createHost(); const storage=createStorage(); const rt=createUiEditorRuntime({registry:createRegistry(),hostAdapter:host,layoutStorage:storage,targetContext:context}); rt.beginSession(); rt.applyChange({elementId:"demo.card",operation:"move",payload:{x:4},changeId:"c",createdAt:"n",source:"t"}); const base=rt.getSessionStatus().baselineVersion; const calls=storage.calls.length; host.replaceRefs(); assert.equal(rt.reapplyCurrentLayoutState().ok,true); assert.equal(host.dump()["demo.card"].x,4); assert.equal(storage.calls.length,calls); assert.equal(rt.getSessionStatus().baselineVersion,base);
console.log("m69 runtime boundary ok");
