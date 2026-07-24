"use strict";
const assert = require("node:assert/strict");
const { createElementRefRegistry, createBrowserHostAdapter, resolveOperationStep, createUiEditorPanelController, createUiEditorRuntime, RUNTIME_ERROR_CODES } = require("../src/index.cjs");
const { createStorage, context } = require("./m69-test-helpers.cjs");

function style(){ const props={}; return { setProperty(k,v){props[k]=String(v);}, getPropertyValue(k){return props[k]||"";}, removeProperty(k){delete props[k];}, get textIndent(){return this._textIndent||"";}, set textIndent(v){this._textIndent=String(v||"");}, get paddingTop(){return this._paddingTop||"";}, set paddingTop(v){this._paddingTop=String(v||"");}, get fontSize(){return this._fontSize||"";}, set fontSize(v){this._fontSize=String(v||"");}, get transform(){return this._transform||"";}, set transform(v){this._transform=String(v||"");}, get width(){return this._width||"";}, set width(v){this._width=String(v||"");}, get height(){return this._height||"";}, set height(v){this._height=String(v||"");} }; }
function element(rect){ return { style:style(), hidden:false, value:"abc", placeholder:"ph", getBoundingClientRect(){ const pad=Number(String(this.style.paddingTop||"").replace("px",""))||0; return { left:rect.left, top:rect.top, width:Number(String(this.style.width||"").replace("px",""))||rect.width, height:(Number(String(this.style.height||"").replace("px",""))||rect.height)+pad }; } }; }
function rectOf(el){ const r=el.getBoundingClientRect(); return {left:r.left,top:r.top,width:r.width,height:r.height}; }

const refs=createElementRefRegistry(); const textRefs=createElementRefRegistry();
const outer=element({left:7,top:9,width:100,height:40}); const text=element({left:7,top:9,width:100,height:20});
outer.style.width="100px"; outer.style.height="40px"; outer.style.transform="scale(1)"; text.style.textIndent="8px"; text.style.paddingTop="2px"; text.style.fontSize="12px";
refs.register("e", outer); textRefs.register("e", text);
const host=createBrowserHostAdapter({ elementRefs:refs, textRefs, computedStyleReader(el){ return { width:el.style.width, height:el.style.height, textIndent:el.style.textIndent, paddingTop:el.style.paddingTop, fontSize:el.style.fontSize }; } });
const before=rectOf(outer); const value=outer.value; const placeholder=outer.placeholder; const transform=outer.style.transform; const width=outer.style.width; const height=outer.style.height;
host.applyLayoutEntry("e", { elementId:"e", textOffsetX:3 });
host.applyLayoutEntry("e", { elementId:"e", textOffsetY:5 });
host.applyLayoutEntry("e", { elementId:"e", fontSize:18 });
assert.deepEqual(rectOf(outer), before); assert.equal(outer.style.transform, transform); assert.equal(outer.style.width, width); assert.equal(outer.style.height, height); assert.equal(outer.value, value); assert.equal(outer.placeholder, placeholder); assert.equal(text.style.textIndent, "11px"); assert.equal(text.style.transform, "translateY(5px)"); assert.equal(text.style.fontSize, "18px");
host.clearElementLayout("e"); assert.equal(text.style.textIndent,"8px"); assert.equal(text.style.paddingTop,"2px"); assert.equal(text.style.fontSize,"12px"); assert.equal(text.style.transform,""); assert.deepEqual(rectOf(outer), before);

assert.equal(resolveOperationStep({registryElement:{steps:{move:5}},operation:"move",panelStepSize:99}),5);
assert.equal(resolveOperationStep({registryElement:{steps:{resize:4,resizeWidth:7}},operation:"resize",axis:"width",panelStepSize:99}),7);
assert.equal(resolveOperationStep({registryElement:{steps:{resize:4,resizeHeight:8}},operation:"resize",axis:"height",panelStepSize:99}),8);
assert.equal(resolveOperationStep({registryElement:{steps:{textMove:2,textMoveX:6,textMoveY:9,fontSize:3}},operation:"textMove",axis:"x",panelStepSize:99}),6);
assert.equal(resolveOperationStep({registryElement:{steps:{textMove:2,textMoveY:9,fontSize:3}},operation:"textMove",axis:"y",panelStepSize:99}),9);
assert.equal(resolveOperationStep({registryElement:{steps:{fontSize:3}},operation:"fontSize",panelStepSize:99}),3);

const registry={ getElementById(id){ return id==="p"?{id,name:"Panel",editable:true,allowedOps:["move","resize"],lockedOps:[],minWidth:1,minHeight:1,steps:{move:5,resizeWidth:7,resizeHeight:8}}:null; }, listElements(){return [this.getElementById("p")];} };
const mem={p:{elementId:"p",x:0,y:0,width:20,height:20}}; const runtime={ inspectElement(id){return {ok:true,allowedOps:["move","resize"],effectiveOps:["move","resize"],currentEntry:{...mem[id]}};}, applyChange(req){Object.assign(mem[req.elementId],req.payload); return {ok:true,value:mem[req.elementId]};}, getSessionStatus(){return {ok:true,active:true,changedCount:0,changedElementIds:[]};}, getPersistenceStatus(){return {available:true,persistent:true};}, discardElementChanges(){return {ok:true};} };
const controller=createUiEditorPanelController({runtime,registry,stepSize:99}); (async()=>{ controller.selectElement("p"); await controller.activateDirection("right"); assert.equal(mem.p.x,5); controller.setMode("width"); await controller.activateDirection("right"); assert.equal(mem.p.width,27); controller.setMode("height"); await controller.activateDirection("down"); assert.equal(mem.p.height,28);

const rtHost={ validateElementRef(){return {ok:true};}, captureElementLayoutState(){return null;}, applyLayoutEntry(id,entry){this.entry=entry; return {ok:true};}, clearElementLayout(){return {ok:true};}, restoreElementLayoutState(){return {ok:true};}, getCurrentLayoutEntry(){return this.entry||null;} };
const rtRegistry={ getElementById(id){return id==="r"?{id,editable:true,allowedOps:["move"],lockedOps:[]}:null;}, listElements(){return [this.getElementById("r")];} };
const rt=createUiEditorRuntime({registry:rtRegistry,hostAdapter:rtHost,layoutStorage:createStorage(),targetContext:context}); rt.beginSession(); assert.equal(rt.applyChange({elementId:"r",operation:"textMove",payload:{textOffsetX:1},source:"test"}).code,RUNTIME_ERROR_CODES.OPERATION_NOT_ALLOWED);
console.log("m72 corrections ok"); })().catch((error)=>{ console.error(error); process.exit(1); });
