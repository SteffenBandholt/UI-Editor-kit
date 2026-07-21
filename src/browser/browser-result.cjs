"use strict";
const BROWSER_ERROR_CODES=Object.freeze({INVALID_ELEMENT_ID:"INVALID_ELEMENT_ID",INVALID_ELEMENT_REF:"INVALID_ELEMENT_REF",ELEMENT_REF_ALREADY_REGISTERED:"ELEMENT_REF_ALREADY_REGISTERED",ELEMENT_REF_MISSING:"ELEMENT_REF_MISSING",HOST_READ_FAILED:"HOST_READ_FAILED",HOST_APPLY_FAILED:"HOST_APPLY_FAILED",HOST_CAPTURE_FAILED:"HOST_CAPTURE_FAILED",HOST_CLEAR_FAILED:"HOST_CLEAR_FAILED",CURRENT_VALUE_UNAVAILABLE:"CURRENT_VALUE_UNAVAILABLE",OVERLAY_MOUNT_MISSING:"OVERLAY_MOUNT_MISSING",OVERLAY_MEASURE_FAILED:"OVERLAY_MEASURE_FAILED",STORAGE_UNAVAILABLE:"STORAGE_UNAVAILABLE",STORAGE_READ_FAILED:"STORAGE_READ_FAILED",STORAGE_WRITE_FAILED:"STORAGE_WRITE_FAILED",STORAGE_CLEAR_FAILED:"STORAGE_CLEAR_FAILED",STORAGE_PARSE_FAILED:"STORAGE_PARSE_FAILED",STORAGE_SCHEMA_UNSUPPORTED:"STORAGE_SCHEMA_UNSUPPORTED",BRIDGE_DESTROYED:"BRIDGE_DESTROYED",UNKNOWN_ELEMENT:"UNKNOWN_ELEMENT"});
function ok(value,extra){return {ok:true,...(value!==undefined?{value}:{}),...(extra||{})};}
function blocked(code,reason,extra){return {ok:false,blocked:true,code,messageKey:code,...(reason?{reason}:{}),...(extra||{})};}
function isValidElementId(id){return typeof id==="string"&&id.trim().length>0;}
function isElementRef(ref){return !!ref&&typeof ref==="object"&&typeof ref.style==="object"&&(typeof ref.getBoundingClientRect==="function"||typeof ref.hidden==="boolean"||"hidden" in ref);}
function safeCall(fn,code){try{return ok(fn());}catch(error){return blocked(code,error.message||code,{errorName:error.name});}}
module.exports={BROWSER_ERROR_CODES,ok,blocked,isValidElementId,isElementRef,safeCall};
