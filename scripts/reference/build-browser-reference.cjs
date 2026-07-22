"use strict";
const fs = require("fs"); const path = require("path");
const root = path.resolve(__dirname, "../.."); const entry = path.join(root, "examples/browser-reference/reference-app.cjs");
const modules = new Map(); let nextId = 0;
function resolveReq(from, req){ if(req === "../../src/index.cjs") return path.join(root,"src/index.cjs"); if(req.startsWith(".")) return path.resolve(path.dirname(from), req); throw new Error(`external require not supported: ${req}`); }
function add(file){ file = require.resolve(file); if(modules.has(file)) return modules.get(file).id; const id = nextId++; const rec={id,file,code:"",deps:{}}; modules.set(file,rec); let code=fs.readFileSync(file,"utf8"); code=code.replace(/require\((['"])(.*?)\1\)/g,(m,q,req)=>{ const dep=resolveReq(file,req); const depId=add(dep); rec.deps[req]=depId; return `__require(${depId})`; }); rec.code=code; return id; }
const entryId=add(entry);
const body=Array.from(modules.values()).map(m=>`${JSON.stringify(m.id)}:function(module,exports,__require){\n${m.code}\n}`).join(",\n");
const out=`/* GENERATED FILE - do not edit manually. Build with npm run reference:build. */\n(function(){const __modules={${body}};const __cache={};function __require(id){if(__cache[id])return __cache[id].exports;const module={exports:{}};__cache[id]=module;__modules[id](module,module.exports,__require);return module.exports;}const app=__require(${entryId});if(typeof window!=="undefined")window.createReferenceApp=app.createReferenceApp;})();\n`;
fs.writeFileSync(path.join(root,"examples/browser-reference/reference-app.bundle.js"),out);
console.log("Browser-Referenzbundle erzeugt: examples/browser-reference/reference-app.bundle.js");
