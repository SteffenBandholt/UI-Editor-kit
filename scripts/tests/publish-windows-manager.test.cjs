'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {publishArguments,verifyRuntime,supportedSdk}=require('../publish-windows-manager.cjs');
const args=publishArguments('artifacts/test');
assert.ok(args.includes('-p:NuGetAudit=true'));assert.ok(args.includes('-p:NuGetAuditMode=all'));
assert.ok(!args.some(arg=>arg.startsWith('-p:RuntimeFrameworkVersion=')),'A global runtime override corrupts Windows SDK PackageDownload');
assert.equal(supportedSdk('10.0.100'),true);assert.equal(supportedSdk('10.0.402'),true);assert.equal(supportedSdk('10.0.100-preview'),false);assert.equal(supportedSdk('11.0.100'),false);
assert.throws(()=>publishArguments('out','linux-x64'));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kit-publish-guard-'));
try{
 const file=path.join(dir,'UiEditorManager.runtimeconfig.json');
 const write=version=>fs.writeFileSync(file,JSON.stringify({runtimeOptions:{includedFrameworks:['Microsoft.NETCore.App','Microsoft.WindowsDesktop.App'].map(name=>({name,version}))}}));
 write('10.0.0');assert.throws(()=>verifyRuntime(dir),/must be patched/);
 write('10.0.13');assert.equal(verifyRuntime(dir).length,2);
}finally{fs.rmSync(dir,{recursive:true,force:true});}
console.log('PUBLISH_MANAGER_GUARD_TEST_OK');
