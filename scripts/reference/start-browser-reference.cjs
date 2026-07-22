"use strict";
const http=require("http"),fs=require("fs"),path=require("path");
const root=path.resolve(__dirname,"../.."); const dir=path.join(root,"examples/browser-reference"); const port=Number(process.env.PORT)||4172;
const types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8"};
const server=http.createServer((req,res)=>{const url=req.url==="/"?"/examples/browser-reference/index.html":req.url; const rel=url.replace(/^\/examples\/browser-reference\//,""); const file=path.normalize(path.join(dir,rel)); if(!file.startsWith(dir)){res.writeHead(403);res.end("forbidden");return;} fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);res.end("not found");return;} res.writeHead(200,{"content-type":types[path.extname(file)]||"application/octet-stream"});res.end(data);});});
server.listen(port,()=>{console.log(`Lokale URL: http://localhost:${port}/examples/browser-reference/index.html`);console.log("Beispielpfad: examples/browser-reference/");console.log("Stoppen mit Ctrl+C.");});
