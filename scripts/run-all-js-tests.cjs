const {spawnSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||path.join(root,'artifacts/js-tests'));fs.mkdirSync(out,{recursive:true});
const pkg=require(path.join(root,'package.json')),results=[];
for(const cmd of (pkg.scripts.pretest+' && '+pkg.scripts.test).split(' && ')){
 const args=cmd.trim().split(/\s+/);if(args.shift()!=='node')throw Error('Unsupported command '+cmd);
 const r=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',timeout:180000,maxBuffer:8*1024*1024});
 results.push({command:cmd,exitCode:r.status,error:r.error?.message});fs.writeFileSync(path.join(out,path.basename(args[0])+'.log'),(r.stdout||'')+(r.stderr||''));
}
fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(results,null,2));console.log(JSON.stringify({total:results.length,passed:results.filter(x=>x.exitCode===0).length,failed:results.filter(x=>x.exitCode!==0)},null,2));process.exitCode=results.some(x=>x.exitCode!==0)?1:0;
