'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {verifyAssets, verifyAudit} = require('../check-nuget-security.cjs');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-nuget-security-'));
try {
  const file = path.join(dir, 'project.assets.json');
  const write = version => fs.writeFileSync(file, JSON.stringify({targets: {'net10.0-windows': {'PDFsharp/6.2.4': {}, ['System.Security.Cryptography.Pkcs/' + version]: {}}}}));
  write('8.0.1'); assert.throws(() => verifyAssets([file]), /unexpected PKCS version/);
  write('10.0.13'); assert.equal(verifyAssets([file]).resolvedVersion, '10.0.13');
  const pruned = {targets: {'net10.0-windows': {'PDFsharp/6.2.4': {}}}, project: {frameworks: {'net10.0-windows': {targetAlias: 'net10.0-windows', packagesToPrune: {'System.Security.Cryptography.Pkcs': '(,10.0.32767]'}, frameworkReferences: {'Microsoft.WindowsDesktop.App.WPF': {}}}}}};
  // Keep one actual package graph: the PdfRendering boundary must still resolve
  // the explicit security patch even when WPF consumers use the framework.
  const prunedFile = path.join(dir, 'wpf.assets.json');
  fs.writeFileSync(prunedFile, JSON.stringify(pruned));
  assert.throws(() => verifyAssets([file, prunedFile]), /requires patched/);
  assert.equal(verifyAssets([file, prunedFile], {sdkVersion: '10.0.402'}).patchedFrameworkGraphs, 1);
  pruned.project.frameworks['net10.0-windows'].downloadDependencies = [{name: 'Microsoft.WindowsDesktop.App.Ref', version: '[10.0.13, 10.0.13]'}];
  fs.writeFileSync(prunedFile, JSON.stringify(pruned));
  assert.equal(verifyAssets([file, prunedFile], {sdkVersion: '10.0.100'}).patchedFrameworkGraphs, 1);
  pruned.project.frameworks['net10.0-windows'].downloadDependencies.push({name: 'Microsoft.Windows.SDK.NET.Ref', version: '[10.0.13, 10.0.13]'});
  fs.writeFileSync(prunedFile, JSON.stringify(pruned));
  assert.throws(() => verifyAssets([file, prunedFile], {sdkVersion: '10.0.100'}), /Windows SDK version was replaced/);
  pruned.project.frameworks['net10.0-windows'].downloadDependencies = [{name: 'Microsoft.Windows.SDK.NET.Ref', version: '[10.0.19041.57, 10.0.19041.57]'}, {name: 'Microsoft.Windows.SDK.NET.Ref', version: '[10.0.19041.58, 10.0.19041.58]'}];
  fs.writeFileSync(prunedFile, JSON.stringify(pruned));
  assert.throws(() => verifyAssets([file, prunedFile], {sdkVersion: '10.0.100'}), /conflicting PackageDownload/);
  pruned.project.frameworks['net10.0-windows'].downloadDependencies = [{name: 'Microsoft.WindowsDesktop.App.Ref', version: '[10.0.0, 10.0.0]'}];
  fs.writeFileSync(prunedFile, JSON.stringify(pruned));
  assert.throws(() => verifyAssets([file, prunedFile], {sdkVersion: '10.0.402'}), /unpatched WindowsDesktop/);
  fs.writeFileSync(file, '{invalid'); assert.throws(() => verifyAssets([file]));
  const report = {version: 1, parameters: '--vulnerable --include-transitive', sources: ['https://api.nuget.org/v3/index.json'], projects: [{path: 'consumer.csproj', frameworks: [{framework: 'net10.0-windows', transitivePackages: [{id: 'System.Security.Cryptography.Pkcs', resolvedVersion: '8.0.1', vulnerabilities: [{severity: 'High'}]}]}]}]};
  assert.throws(() => verifyAudit(report), /vulnerable package/);
  report.projects[0].frameworks[0].transitivePackages = [];
  assert.equal(verifyAudit(report).vulnerablePackages, 0);
  assert.throws(() => verifyAudit({...report, parameters: '--include-transitive'}), /complete transitive/);
  assert.throws(() => verifyAudit({...report, problems: [{level: 'error', text: 'audit unavailable'}]}), /audit reported errors/);
  console.log('NUGET_SECURITY_GUARD_TEST_OK');
} finally {fs.rmSync(dir, {recursive: true, force: true});}
