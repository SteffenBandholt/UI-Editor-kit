#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createMinimalTargetAppExample } = require("../../scripts/fixtures/minimal-target-app/minimal-target-app.cjs");

const REPO_ROOT = path.resolve(__dirname, "../..");
const checkedFiles = [
  "docs/M47_NEUE_ZIEL_APP_MINIMAL_ANBINDUNG.md",
  "scripts/fixtures/minimal-target-app/README.md",
  "scripts/fixtures/minimal-target-app/minimal-target-app.cjs",
];
const forbiddenPatterns = [
  /BBM/i,
  /Restarbeiten/i,
  /Protokoll/i,
  /TOPS/i,
  /database|\bDB\b|sql/i,
  /PDF|Druck|Mail|Audio/i,
  /querySelector|getElementById\(|MutationObserver|dom\s*scan/i,
  /auto.*detect|auto.*register|automatische\s+Registry-Befuellung/i,
];

function read(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

{
  const example = createMinimalTargetAppExample({ uiScope: "scope.alpha" });
  assert.equal(example.ok, true);
  assert.equal(example.targetAppInfo.targetAppId, "neutral-target-app");
  assert.equal(example.adapterManifest.uiScope, "scope.alpha");
  assert.equal(example.adapterManifest.layoutScope, "layout.alpha");
  assert.equal(example.runtime.ok, true);
  assert.equal(example.runtime.status, "ok");
  assert.equal(example.runtime.capabilities.includes("runtime-launcher"), true);
  assert.equal(example.runtime.capabilities.includes("layout-state-store"), true);
  assert.equal(example.viewModels.runtimeStatus.ok, true);
  assert.equal(example.viewModels.scope.uiScope, "scope.alpha");
  assert.equal(example.viewModels.selection.ok, true);
  assert.equal(example.viewModels.layoutControls.controls.save.available, true);
  assert.equal(example.viewModels.layoutControls.controls.load.available, true);
  assert.equal(example.viewModels.layoutControls.controls.reset.available, true);
  assert.equal(example.layoutResults.save.status, "layout_state_saved");
  assert.equal(example.layoutResults.load.status, "layout_state_loaded");
  assert.equal(example.layoutResults.reset.status, "layout_state_reset");
}

{
  const example = createMinimalTargetAppExample({ uiScope: "scope.beta" });
  assert.equal(example.ok, true);
  assert.equal(example.adapterManifest.uiScope, "scope.beta");
  assert.equal(example.adapterManifest.layoutScope, "layout.beta");
  assert.equal(example.viewModels.scope.layoutScope, "layout.beta");
}

{
  const exampleSource = read("scripts/fixtures/minimal-target-app/minimal-target-app.cjs");
  assert.equal(exampleSource.includes("createTargetAppAdapterRuntime"), true);
  assert.equal(exampleSource.includes("target-app-adapter-path.cjs"), true);
  assert.equal(exampleSource.includes("createMemoryLayoutStateStore"), true);
  assert.equal(exampleSource.includes("neutralTargetApp.cjs"), true);
}

checkedFiles.forEach((file) => {
  const content = read(file);
  forbiddenPatterns.forEach((pattern) => assert.equal(pattern.test(content), false, `${file} matched ${pattern}`));
});

console.log("minimal-target-app-example tests passed");
