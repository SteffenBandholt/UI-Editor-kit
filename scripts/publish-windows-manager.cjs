'use strict';
// The single publish path used by Windows CI and consuming applications.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const RUNTIME='10.0.13';
function supportedSdk(version){return /^10\.0\.(\d+)$/.test(version.trim())&&Number(version.trim().split('.')[2])>=100;}
function publishArguments(output,rid='win-x64'){
 assert.ok(['win-x64','win-arm64'].includes(rid),'Unsupported Windows runtime');
 return ['publish',path.join(root,'windows-manager/src/UiEditorKit.Manager.Wpf/UiEditorKit.Manager.Wpf.csproj'),'-c','Release','-r',rid,'--self-contained','true','-o',path.resolve(output),'-p:NuGetAudit=true','-p:NuGetAuditMode=all'];
}
function verifyRuntime(output){
 const frameworks=JSON.parse(fs.readFileSync(path.join(output,'UiEditorManager.runtimeconfig.json'),'utf8')).runtimeOptions?.includedFrameworks;
 for(const name of ['Microsoft.NETCore.App','Microsoft.WindowsDesktop.App'])assert.ok(frameworks?.some(item=>item.name===name&&item.version===RUNTIME),'Published runtime must be patched: '+name);
 return frameworks;
}
module.exports={supportedSdk,publishArguments,verifyRuntime,RUNTIME};
if(require.main===module){
 try{
 const value=(name,fallback)=>{const i=process.argv.indexOf(name);return i<0?fallback:process.argv[i+1];};
 const dotnet=value('--dotnet','dotnet'),output=path.resolve(value('--output',path.join(root,'artifacts/manager')));
 const sdk=spawnSync(dotnet,['--version'],{cwd:root,encoding:'utf8'});
 assert.equal(sdk.status,0,'Cannot determine .NET SDK');assert.ok(supportedSdk(sdk.stdout),'Stable .NET 10 SDK >= 10.0.100 required');
 console.log('PUBLISH_SDK '+sdk.stdout.trim());
 const result=spawnSync(dotnet,publishArguments(output,value('--rid','win-x64')),{cwd:root,stdio:'inherit'});
 assert.equal(result.status,0,'Native manager publish failed');
 const {verifyAssets,assetsIn}=require('./check-nuget-security.cjs');
 const graph=verifyAssets(['reference-target-app','windows-manager'].flatMap(dir=>assetsIn(path.join(root,dir))),{sdkVersion:sdk.stdout.trim()});
 const frameworks=verifyRuntime(output);
 fs.writeFileSync(path.join(output,'publish-verification.json'),JSON.stringify({sdkVersion:sdk.stdout.trim(),runtimeFrameworks:frameworks,graph,nugetAudit:true,nugetAuditMode:'all'},null,2));
 console.log('WINDOWS_MANAGER_PUBLISH_VERIFIED '+JSON.stringify({sdk:sdk.stdout.trim(),runtime:RUNTIME}));
 }catch(error){console.error(error.message);process.exitCode=1;}
}
