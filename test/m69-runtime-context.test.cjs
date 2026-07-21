"use strict";
const { assert, createRegistry, createHost, createStorage, context } = require("./m69-test-helpers.cjs");
const { createUiEditorRuntime, RUNTIME_ERROR_CODES, normalizeTargetContext } = require("../src/index.cjs");
let rt=createUiEditorRuntime({registry:createRegistry(),hostAdapter:createHost(),layoutStorage:createStorage(),targetContext:context});
assert.equal(rt.beginSession().ok,true); assert.equal(rt.getSessionStatus().changedCount,0);
assert.equal(createUiEditorRuntime({registry:createRegistry(),hostAdapter:createHost(),layoutStorage:createStorage(),targetContext:{...context,targetAppId:""}}).beginSession().code,RUNTIME_ERROR_CODES.INVALID_TARGET_CONTEXT);
assert.equal(normalizeTargetContext({...context,layoutProfileId:""}).layoutProfileId,"default");
assert.equal(rt.beginSession("other-scope").code,RUNTIME_ERROR_CODES.UNKNOWN_SCOPE);
const failingHost=createHost(); failingHost.fail.read="demo.card"; assert.equal(createUiEditorRuntime({registry:createRegistry(),hostAdapter:failingHost,layoutStorage:createStorage(),targetContext:context}).beginSession().code,RUNTIME_ERROR_CODES.HOST_READ_FAILED);

const listThrowRegistry={listElements(){throw new Error("list failed");},getElementById(){return null;}}; assert.equal(createUiEditorRuntime({registry:listThrowRegistry,hostAdapter:createHost(),layoutStorage:createStorage(),targetContext:context}).beginSession().code,RUNTIME_ERROR_CODES.REGISTRY_READ_FAILED);
const getThrowRegistry={listElements(){return createRegistry().listElements();},getElementById(){throw new Error("get failed");}}; rt=createUiEditorRuntime({registry:getThrowRegistry,hostAdapter:createHost(),layoutStorage:createStorage(),targetContext:context}); rt.beginSession(); assert.equal(rt.applyChange({elementId:"demo.card",operation:"move",payload:{x:1},changeId:"rg",createdAt:"n",source:"t"}).code,RUNTIME_ERROR_CODES.REGISTRY_READ_FAILED);
const s=createStorage(); rt=createUiEditorRuntime({registry:createRegistry(),hostAdapter:createHost(),layoutStorage:s,targetContext:context}); rt.beginSession(); rt.applyChange({elementId:"demo.card",operation:"move",payload:{x:1},changeId:"c",createdAt:"n",source:"t"}); assert.equal(rt.saveLayout().ok,true);
const other={...context,scopeId:"other-layout"}; assert.deepEqual(s.readResult(other).entries,[]);
console.log("m69 runtime context ok");
