'use strict';
// Checks actual restored graphs, not just PackageReference text. NuGet auditing
// remains enabled; vulnerability-report mode fails even when dotnet list exits 0.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const PACKAGE = 'System.Security.Cryptography.Pkcs';
const VERSION = '10.0.13';
function verifyAssets(files) {
  let consumers = 0;
  for (const file of files) {
    const assets = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const log of assets.logs || []) assert.notEqual(log.level, 'Error', `${file}: ${log.code} ${log.message}`);
    for (const [target, packages] of Object.entries(assets.targets || {})) {
      const keys = Object.keys(packages);
      const pkcs = keys.filter(key => key.toLowerCase().startsWith(PACKAGE.toLowerCase() + '/'));
      if (keys.some(key => /^PDFsharp\//i.test(key))) assert.equal(pkcs.length, 1, `${file}/${target}: missing PKCS resolution`);
      for (const key of pkcs) {
        assert.equal(key, `${PACKAGE}/${VERSION}`, `${file}/${target}: unexpected PKCS version`);
        consumers++;
      }
    }
  }
  assert.ok(consumers > 0, 'No restored PKCS consumers found; run dotnet restore first.');
  return {assetFiles: files.length, targetGraphsWithPkcs: consumers, package: PACKAGE, resolvedVersion: VERSION};
}
function verifyAudit(report) {
  assert.equal(report.version, 1, 'Unsupported dotnet package report version');
  assert.ok(report.parameters?.includes('--vulnerable') && report.parameters?.includes('--include-transitive'), 'A complete transitive vulnerability audit is required');
  assert.ok(report.sources?.length, 'No vulnerability audit source recorded');
  assert.ok(!(report.problems || []).some(problem => problem.level === 'error'), 'NuGet audit reported errors');
  assert.ok(report.projects?.length, 'No projects in NuGet vulnerability report');
  for (const project of report.projects) for (const framework of project.frameworks || []) {
    for (const item of [...(framework.topLevelPackages || []), ...(framework.transitivePackages || [])]) {
      assert.equal((item.vulnerabilities || []).length, 0, `${project.path}: vulnerable package ${item.id}/${item.resolvedVersion}`);
    }
  }
  return {auditedProjects: report.projects.length, vulnerablePackages: 0};
}
function assetsIn(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    if (['bin', 'node_modules', '.git'].includes(entry.name)) return [];
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? assetsIn(file) : entry.name === 'project.assets.json' ? [file] : [];
  });
}
module.exports = {verifyAssets, verifyAudit};
if (require.main === module) {
  try {
    const index = process.argv.indexOf('--vulnerability-report');
    const result = index >= 0
      ? verifyAudit(JSON.parse(fs.readFileSync(process.argv[index + 1], 'utf8').replace(/^\uFEFF/, '')))
      : verifyAssets(['reference-target-app', 'windows-manager'].flatMap(dir => assetsIn(path.join(root, dir))));
    console.log('NUGET_SECURITY_OK ' + JSON.stringify(result));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
