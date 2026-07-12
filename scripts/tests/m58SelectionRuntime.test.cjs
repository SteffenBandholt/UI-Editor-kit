#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createSelectionController, resolveSelectionTarget } = require("../../src/index.cjs");
function emitter(){ const m=new Map(); return { addEventListener(t,f,o){ const k=t+':'+o; m.set(k,(m.get(k)||[]).concat(f));}, removeEventListener(t,f,o){ const k=t+':'+o; m.set(k,(m.get(k)||[]).filter(x=>x!==f));}, count(){return [...m.values()].reduce((a,b)=>a+b.length,0)}, fire(t,e={},o){ for(const [k,fs] of m) if(k.startsWith(t+':')) fs.slice().forEach(f=>f(Object.assign({type:t,target:this},e))); } }; }
function elem(id, rect, parent){ const e=Object.assign(emitter(),{ id,nodeType:1,style:{},children:[],parentNode:parent||null,ownerDocument:null,rect:rect||{left:0,top:0,width:10,height:10},contains(t){return t===this||this.children.includes(t);},getBoundingClientRect(){return this.rect;},appendChild(c){c.parentNode=this;this.children.push(c);},removeChild(c){this.children=this.children.filter(x=>x!==c);c.parentNode=null;},setAttribute(k,v){this[k]=v;}}); if(parent) parent.children.push(e); return e; }
function doc(){ const body=elem('body'); const d=Object.assign(emitter(),{body,defaultView:emitter(),createElement(tag){const x=elem(tag); x.ownerDocument=d; return x;}}); body.ownerDocument=d; return d; }
function host(root, refs){ let selected=null; const calls=[]; return { listSelectableTargets(){return [{elementId:'a',label:'A'},{elementId:'b',label:'B',parentId:'a'},{elementId:'c',selectable:false},{elementId:'missing'}]}, getElementRef:id=>refs[id]||null, getSelectedElementId:()=>selected, selectElement:id=>{calls.push(id); selected=id;}, getInteractionRoot:()=>root, isExcludedTarget:t=>t&&t.id==='excluded', onSelection:s=>calls.push('sel:'+s.elementId), calls, setSelected:id=>{selected=id} }; }
(async()=>{
 const document=doc(), root=elem('root'), a=elem('a',{left:0,top:0,width:100,height:100}), b=elem('b',{left:5,top:5,width:20,height:20},a), c=elem('c'); [root,a,b,c].forEach(x=>x.ownerDocument=document); const refs={a,b,c}; const h=host(root,refs);
 assert.equal(root.count(),0); const controller=createSelectionController({host:h,document,window:document.defaultView}); assert.equal(root.count(),0);
 controller.start(); const count=root.count(); controller.start(); assert.equal(root.count(),count); assert.equal(controller.isActive(),true);
 root.fire('pointermove',{target:b}); assert.equal(controller.getState().hoveredElementId,'b');
 root.fire('pointermove',{target:{id:'excluded',nodeType:1,contains(){return false},getBoundingClientRect(){return {}}}}); assert.equal(controller.getState().hoveredElementId,null);
 root.fire('pointermove',{target:b}); root.fire('click',{target:b,preventDefault(){this.prevented=true},stopPropagation(){this.stopped=true},stopImmediatePropagation(){this.immediate=true}}); await new Promise(r=>setTimeout(r,0)); assert.deepEqual(h.calls.slice(0,2),['b','sel:b']); assert.equal(controller.isActive(),true); assert.equal(controller.getState().selectedElementId,'b'); assert.equal(controller.getState().hoveredElementId,null);
 h.setSelected('a'); controller.syncWithSelection(); assert.equal(controller.getState().selectedElementId,'a'); root.fire('keydown',{key:'Escape'}); assert.equal(controller.isActive(),false); assert.equal(root.count(),0);
 controller.start(); controller.stop(); controller.stop(); assert.equal(root.count(),0); controller.destroy(); controller.destroy(); controller.start(); assert.equal(root.count(),0);
 const match=resolveSelectionTarget({eventTarget:b,targets:[{elementId:'a'},{elementId:'b',parentId:'a'},{elementId:'c',selectable:false},{elementId:'missing'}],getElementRef:id=>refs[id]||null}); assert.equal(match.elementId,'b');
 const source=fs.readFileSync(path.join(__dirname,'../../src/selection/targetResolver.js'),'utf8')+fs.readFileSync(path.join(__dirname,'../../src/selection/selectionController.js'),'utf8'); [/querySelector/,/getElementById/,/getElementsBy/,/closest/,/matches/,/MutationObserver/,/elementFromPoint/,/elementsFromPoint/,/LayoutStore/,/electron|ipc/i].forEach(re=>assert.equal(re.test(source),false,String(re)));
 console.log('m58 selection runtime tests passed');
})();
