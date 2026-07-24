"use strict";
const assert = require("node:assert/strict");
const { createElementRefRegistry, createBrowserHostAdapter, resolveOperationStep, createUiEditorPanelController, createUiEditorRuntime, RUNTIME_ERROR_CODES, normalizeLayoutEntry } = require("../src/index.cjs");
const { createStorage, context } = require("./m69-test-helpers.cjs");

function style(){ const props={}; return { setProperty(k,v){props[k]=String(v);}, getPropertyValue(k){return props[k]||"";}, removeProperty(k){delete props[k];}, get textIndent(){return this._textIndent||"";}, set textIndent(v){this._textIndent=String(v||"");}, get paddingTop(){return this._paddingTop||"";}, set paddingTop(v){this._paddingTop=String(v||"");}, get fontSize(){return this._fontSize||"";}, set fontSize(v){this._fontSize=String(v||"");}, get transform(){return this._transform||"";}, set transform(v){this._transform=String(v||"");}, get width(){return this._width||"";}, set width(v){this._width=String(v||"");}, get height(){return this._height||"";}, set height(v){this._height=String(v||"");} }; }
function element(rect){ return { style:style(), hidden:false, value:"abc", placeholder:"ph", getBoundingClientRect(){ const pad=Number(String(this.style.paddingTop||"").replace("px",""))||0; return { left:rect.left, top:rect.top, width:Number(String(this.style.width||"").replace("px",""))||rect.width, height:(Number(String(this.style.height||"").replace("px",""))||rect.height)+pad }; } }; }
function rectOf(el){ const r=el.getBoundingClientRect(); return {left:r.left,top:r.top,width:r.width,height:r.height}; }

assert.deepEqual(normalizeLayoutEntry({elementId:"n",text:{offsetX:1,offsetY:2,fontSize:13},textOffsetX:99,fontSize:99}), {elementId:"n",text:{offsetX:1,offsetY:2,fontSize:13}});
const refs=createElementRefRegistry(); const textRefs=createElementRefRegistry();
const outer=element({left:7,top:9,width:100,height:40}); const text=element({left:7,top:9,width:100,height:20});
outer.style.width="100px"; outer.style.height="40px"; outer.style.transform="scale(1)"; text.style.textIndent="8px"; text.style.paddingTop="2px"; text.style.fontSize="12px"; text.style.transform="rotate(1deg)";
refs.register("e", outer); textRefs.register("e", text);
const host=createBrowserHostAdapter({ elementRefs:refs, textRefs, computedStyleReader(el){ return { width:el.style.width, height:el.style.height, textIndent:el.style.textIndent, paddingTop:el.style.paddingTop, fontSize:el.style.fontSize }; } });
const before=rectOf(outer); const transform=outer.style.transform; const width=outer.style.width; const height=outer.style.height;
host.applyLayoutEntry("e", { elementId:"e", text:{offsetX:3} });
host.applyLayoutEntry("e", { elementId:"e", text:{offsetY:5} });
host.applyLayoutEntry("e", { elementId:"e", text:{fontSize:18} });
assert.deepEqual(rectOf(outer), before); assert.equal(outer.style.transform, transform); assert.equal(outer.style.width, width); assert.equal(outer.style.height, height); assert.equal(outer.value, "abc"); assert.equal(outer.placeholder, "ph"); assert.equal(text.style.textIndent, "11px"); assert.equal(text.style.transform, "rotate(1deg) translateY(5px)"); assert.equal(text.style.fontSize, "18px");
host.clearElementLayout("e"); assert.equal(text.style.textIndent,"8px"); assert.equal(text.style.paddingTop,"2px"); assert.equal(text.style.fontSize,"12px"); assert.equal(text.style.transform,"rotate(1deg)"); assert.deepEqual(rectOf(outer), before);
const noTextHost=createBrowserHostAdapter({ elementRefs:refs }); assert.equal(noTextHost.applyLayoutEntry("e", {elementId:"e", text:{offsetY:1}}).code, "HOST_APPLY_FAILED"); assert.equal(outer.style.paddingTop, "");

assert.equal(resolveOperationStep({registryElement:{steps:{move:5}},operation:"move",panelStepSize:99}),5);
assert.equal(resolveOperationStep({registryElement:{steps:{resize:4,resizeWidth:7}},operation:"resize",axis:"width",panelStepSize:99}),7);
assert.equal(resolveOperationStep({registryElement:{steps:{resize:4,resizeHeight:8}},operation:"resize",axis:"height",panelStepSize:99}),8);
assert.equal(resolveOperationStep({registryElement:{steps:{textMove:2,textMoveX:6,textMoveY:9,fontSize:3}},operation:"textMove",axis:"x",panelStepSize:99}),6);
assert.equal(resolveOperationStep({registryElement:{steps:{textMove:2,textMoveY:9,fontSize:3}},operation:"textMove",axis:"y",panelStepSize:99}),9);
assert.equal(resolveOperationStep({registryElement:{steps:{fontSize:3}},operation:"fontSize",panelStepSize:99}),3);
assert.equal(resolveOperationStep({registryElement:{steps:{move:-1}},operation:"move",panelStepSize:4}),4);

const registry={ getElementById(id){ return id==="p"?{id,name:"Panel",editable:true,allowedOps:["move","resize","textMove","fontSize"],lockedOps:[],minWidth:1,minHeight:1,steps:{move:5,resizeWidth:7,resizeHeight:8,textMoveX:6,textMoveY:9,fontSize:3}}:null; }, listElements(){return [this.getElementById("p")];} };
const mem={p:{elementId:"p",element:{x:0,y:0,width:20,height:20},text:{offsetX:1,offsetY:2,fontSize:10}}}; const calls=[]; const runtime={ inspectElement(id){return {ok:true,allowedOps:["move","resize","textMove","fontSize"],effectiveOps:["move","resize","textMove","fontSize"],currentEntry:{...mem[id]}};}, applyChange(req){calls.push(req); Object.assign(mem[req.elementId].element, req.payload.element||{}); Object.assign(mem[req.elementId].text, req.payload.text||{}); return {ok:true,value:mem[req.elementId]};}, getSessionStatus(){return {ok:true,active:true,changedCount:0,changedElementIds:[]};}, getPersistenceStatus(){return {available:true,persistent:true};}, discardElementChanges(){return {ok:true};} };
const controller=createUiEditorPanelController({runtime,registry,stepSize:99}); (async()=>{ controller.selectElement("p"); await controller.activateDirection("right"); assert.equal(mem.p.element.x,5); controller.setMode("width"); await controller.activateDirection("right"); assert.equal(mem.p.element.width,27); controller.setLayer("text"); controller.setMode("text-position"); await controller.activateDirection("right"); assert.deepEqual(calls.at(-1).payload, {text:{offsetX:7}}); await controller.activateDirection("up"); assert.deepEqual(calls.at(-1).payload, {text:{offsetY:-7}}); controller.setMode("text-size"); await controller.activateDirection("right"); assert.equal(mem.p.text.fontSize,13);

function createStepRuntime() {
  const state = { elementId:"step", element:{x:0,y:0,width:20,height:30}, text:{offsetX:0,offsetY:0,fontSize:10} };
  const host = {
    validateElementRef(){return {ok:true};},
    captureElementLayoutState(){return JSON.parse(JSON.stringify(state));},
    applyLayoutEntry(_id,entry){ if (entry.element) Object.assign(state.element, entry.element); if (entry.text) Object.assign(state.text, entry.text); return {ok:true}; },
    clearElementLayout(){return {ok:true};},
    restoreElementLayoutState(_id,snap){ state.element = JSON.parse(JSON.stringify(snap.element)); state.text = JSON.parse(JSON.stringify(snap.text)); return {ok:true};},
    getCurrentLayoutEntry(){return JSON.parse(JSON.stringify(state));},
    dump(){return JSON.parse(JSON.stringify(state));},
  };
  const registry = { getElementById(id){ return id === "step" ? { id, editable:true, allowedOps:["move","resize","textMove","fontSize"], lockedOps:[], minWidth:10, maxWidth:40, minHeight:20, maxHeight:50, minTextOffsetX:-12, maxTextOffsetX:12, minTextOffsetY:-18, maxTextOffsetY:18, minFontSize:8, maxFontSize:20, steps:{move:5,resize:4,resizeWidth:6,resizeHeight:8,textMove:2,textMoveX:3,textMoveY:6,fontSize:2} } : null;}, listElements(){return [this.getElementById("step")];} };
  const runtime = createUiEditorRuntime({registry,hostAdapter:host,layoutStorage:createStorage(),targetContext:context});
  assert.equal(runtime.beginSession().ok, true);
  return { runtime, host };
}

{
  const { runtime, host } = createStepRuntime();
  assert.equal(runtime.applyChange({elementId:"step",operation:"move",payload:{element:{x:5,y:5}},source:"test"}).ok, true);
  assert.equal(runtime.applyChange({elementId:"step",operation:"resize",payload:{element:{width:26}},source:"test"}).ok, true);
  assert.equal(runtime.applyChange({elementId:"step",operation:"resize",payload:{element:{height:38}},source:"test"}).ok, true);
  assert.equal(runtime.applyChange({elementId:"step",operation:"textMove",payload:{text:{offsetX:3}},source:"test"}).ok, true);
  assert.equal(runtime.applyChange({elementId:"step",operation:"textMove",payload:{text:{offsetY:6}},source:"test"}).ok, true);
  assert.equal(runtime.applyChange({elementId:"step",operation:"fontSize",payload:{text:{fontSize:12}},source:"test"}).ok, true);
  const before = host.dump();
  assert.equal(runtime.applyChange({elementId:"step",operation:"move",payload:{element:{x:7}},source:"test"}).code, RUNTIME_ERROR_CODES.VALUE_NOT_ALIGNED_TO_STEP);
  assert.deepEqual(host.dump(), before);
  assert.equal(runtime.applyChange({elementId:"step",operation:"resize",payload:{element:{width:27}},source:"test"}).code, RUNTIME_ERROR_CODES.VALUE_NOT_ALIGNED_TO_STEP);
  assert.equal(runtime.applyChange({elementId:"step",operation:"resize",payload:{element:{height:39}},source:"test"}).code, RUNTIME_ERROR_CODES.VALUE_NOT_ALIGNED_TO_STEP);
  assert.equal(runtime.applyChange({elementId:"step",operation:"textMove",payload:{text:{offsetX:4}},source:"test"}).code, RUNTIME_ERROR_CODES.VALUE_NOT_ALIGNED_TO_STEP);
  assert.equal(runtime.applyChange({elementId:"step",operation:"textMove",payload:{text:{offsetY:7}},source:"test"}).code, RUNTIME_ERROR_CODES.VALUE_NOT_ALIGNED_TO_STEP);
  assert.equal(runtime.applyChange({elementId:"step",operation:"fontSize",payload:{text:{fontSize:13}},source:"test"}).code, RUNTIME_ERROR_CODES.VALUE_NOT_ALIGNED_TO_STEP);
  assert.equal(runtime.applyChange({elementId:"step",operation:"resize",payload:{element:{width:50}},source:"test"}).code, RUNTIME_ERROR_CODES.VALUE_OUT_OF_LIMITS);
  assert.deepEqual(host.dump(), before);
}

const rtHost={ validateElementRef(){return {ok:true};}, captureElementLayoutState(){return null;}, applyLayoutEntry(id,entry){this.entry=entry; return {ok:true};}, clearElementLayout(){return {ok:true};}, restoreElementLayoutState(){return {ok:true};}, getCurrentLayoutEntry(){return this.entry||null;} };
const rtRegistry={ getElementById(id){return id==="r"?{id,editable:true,allowedOps:["move"],lockedOps:[]}:null;}, listElements(){return [this.getElementById("r")];} };
const rt=createUiEditorRuntime({registry:rtRegistry,hostAdapter:rtHost,layoutStorage:createStorage(),targetContext:context}); rt.beginSession(); assert.equal(rt.applyChange({elementId:"r",operation:"textMove",payload:{text:{offsetX:1}},source:"test"}).code,RUNTIME_ERROR_CODES.OPERATION_NOT_ALLOWED);
console.log("m72 corrections ok"); })().catch((error)=>{ console.error(error); process.exit(1); });
