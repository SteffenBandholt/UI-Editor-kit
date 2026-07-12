#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const { createHoverOverlay, createSelectedOverlay } = require("../../src/index.cjs");
function el(tag){ return { tag, nodeType:1, style:{}, children:[], parentNode:null, textContent:"", setAttribute(k,v){this[k]=v;}, appendChild(c){c.parentNode=this;this.children.push(c);}, removeChild(c){this.children=this.children.filter(x=>x!==c);c.parentNode=null;}, contains(t){return t===this||this.children.includes(t);}, getBoundingClientRect(){return this.rect||{left:1,top:2,width:30,height:40};} }; }
function doc(){ const d={ body:el('body'), createElement:el }; return d; }
const document = doc(); const target = el('target'); target.ownerDocument=document; target.rect={left:10,top:20,width:100,height:50}; const before=JSON.stringify(target.style);
const hover=createHoverOverlay({showLabel:true}); hover.show({ref:target,target:{elementId:'a',label:'Alpha'},document}); hover.show({ref:target,target:{elementId:'a',label:'Alpha'},document});
assert.equal(document.body.children.length,1); assert.equal(hover.getElement().style.pointerEvents,'none'); assert.equal(hover.getElement().style.position,'fixed'); assert.equal(hover.getElement().style.left,'10px'); assert.equal(JSON.stringify(target.style),before); target.rect.left=15; hover.update(); assert.equal(hover.getElement().style.left,'15px'); hover.clear(); assert.equal(hover.isVisible(),false); hover.destroy(); assert.equal(document.body.children.length,0);
const selected=createSelectedOverlay({showLabel:true}); selected.show({ref:target,target:{elementId:'b',label:'Beta'},document}); assert.match(selected.getElement().children[0].textContent,/Selected: Beta · b/); selected.destroy();
console.log('m58 selection overlay tests passed');
