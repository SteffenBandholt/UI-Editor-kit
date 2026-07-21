"use strict"; const assert=require("node:assert/strict");
function style(){const s={}; s.setProperty=(k,v)=>{s[k]=String(v)}; s.getPropertyValue=k=>s[k]||""; s.removeProperty=k=>{delete s[k]}; return s;}
function el(rect={left:10,top:20,width:100,height:50}){return {style:style(),hidden:false,children:[],attrs:{},className:"",parentNode:null,ownerDocument:{createElement:(t)=>el({left:0,top:0,width:0,height:0})},appendChild(c){this.children.push(c); c.parentNode=this; return c;},remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(x=>x!==this);},setAttribute(k,v){this.attrs[k]=v},getBoundingClientRect(){if(this.throwRect)throw new Error("rect boom"); return rect;}};}
function registry(){const map=new Map([["a",{id:"a",name:"A",editable:true,allowedOps:["move","resize","hide","show"],lockedOps:[]}]]); return {getElementById:id=>map.get(id)||null,listElements:()=>Array.from(map.values())};}
module.exports={assert,el,registry};
