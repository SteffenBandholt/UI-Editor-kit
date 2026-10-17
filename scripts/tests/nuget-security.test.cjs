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
  fs.writeFileSync(file, '{invalid'); assert.throws(() => verifyAssets([file]));
  const report = {version: 1, parameters: '--vulnerable --include-transitive', sources: ['https://api.nuget.org/v3/index.json'], projects: [{path: 'consumer.csproj', frameworks: [{framework: 'net10.0-windows', transitivePackages: [{id: 'System.Security.Cryptography.Pkcs', resolvedVersion: '8.0.1', vulnerabilities: [{severity: 'High'}]}]}]}]};
  assert.throws(() => verifyAudit(report), /vulnerable package/);
  report.projects[0].frameworks[0].transitivePackages = [];
  assert.equal(verifyAudit(report).vulnerablePackages, 0);
  assert.throws(() => verifyAudit({...report, parameters: '--include-transitive'}), /complete transitive/);
  assert.throws(() => verifyAudit({...report, problems: [{level: 'error', text: 'audit unavailable'}]}), /audit reported errors/);
  console.log('NUGET_SECURITY_GUARD_TEST_OK');
} finally {fs.rmSync(dir, {recursive: true, force: true});}
