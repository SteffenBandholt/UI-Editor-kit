'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {loadTargetStartupLayout}=require('../../src/index.cjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'kit-save-transaction-'));
const file=path.join(root,'standard.layout-profile.json'),journal=file+'.save-transaction.json';
const load=()=>loadTargetStartupLayout({profileRoot:root,applicationId:'app',activeScopes:[],registryScopes:[]});
try{
 const previous=Buffer.from('{"schemaVersion":2,"applicationId":"app","profileId":"standard","savedAt":"2026-10-18T00:00:00Z","scopes":[]}');
 fs.writeFileSync(file,'interrupted candidate');
 fs.writeFileSync(journal,JSON.stringify({schemaVersion:1,previousProfileBase64:previous.toString('base64'),ownerProcessId:process.pid}));
 assert.equal(load().code,'storage_recovery_failed','A second startup must not roll back a live Save');
 assert.equal(fs.readFileSync(file,'utf8'),'interrupted candidate');

 fs.writeFileSync(journal,JSON.stringify({schemaVersion:1,previousProfileBase64:previous.toString('base64')}));
 assert.equal(load().ok,true);assert.deepEqual(fs.readFileSync(file),previous);assert.equal(fs.existsSync(journal),false);
 fs.writeFileSync(journal,JSON.stringify({schemaVersion:1}));
 assert.equal(load().state,'missing');assert.equal(fs.existsSync(file),false);
 fs.writeFileSync(file,previous);fs.writeFileSync(journal,'broken');
 assert.equal(load().code,'storage_recovery_failed');assert.deepEqual(fs.readFileSync(file),previous);assert.equal(fs.readFileSync(journal,'utf8'),'broken');
 const vm=fs.readFileSync(path.join(__dirname,'../../reference-target-app/src/ReferenceTargetApp.Wpf/UI/ViewModels/EditorWindowViewModel.cs'),'utf8');
 assert.equal(vm.includes('AutoSaveCommittedChangeAsync'),false);
 assert.equal((vm.match(/layoutSession\.SaveAsync\(/g)||[]).length,1,'Only explicit Save may persist');
 console.log('EXPLICIT_LAYOUT_SESSION_OK: restart rollback, first-save rollback, corrupt journal fail-closed, single explicit save path');
}finally{fs.rmSync(root,{recursive:true,force:true});}
