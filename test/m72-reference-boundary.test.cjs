"use strict";
const fs=require("fs"),path=require("path"),assert=require("node:assert/strict");
const root=path.resolve(__dirname,"..");
const productive=["examples/browser-reference/reference-app.cjs","examples/browser-reference/reference-registry.cjs","examples/browser-reference/reference-context.cjs","examples/browser-reference/index.html","examples/browser-reference/reference-app.css","scripts/reference/build-browser-reference.cjs","scripts/reference/start-browser-reference.cjs"];
const forbidden=[/querySelectorAll\s*\(/,/CDN/i,/Restarbeiten/i,/Protokoll/i,/Rechnung/i,/session\.maps?/i,/bbm/i];
for(const rel of productive){const text=fs.readFileSync(path.join(root,rel),"utf8"); for(const re of forbidden) assert.equal(re.test(text),false,`${rel} contains ${re}`);}
const pkg=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8")); assert.ok(pkg.scripts["reference:build"]); assert.ok(pkg.scripts["reference:browser"]);
require("child_process").execFileSync(process.execPath,["scripts/reference/build-browser-reference.cjs"],{cwd:root,stdio:"pipe"});
const bundle=fs.readFileSync(path.join(root,"examples/browser-reference/reference-app.bundle.js"),"utf8"); assert.equal(/(^|[^_])require\s*\(/.test(bundle),false); assert.ok(fs.existsSync(path.join(root,"examples/browser-reference/index.html")));
console.log("m72 reference boundary ok");
