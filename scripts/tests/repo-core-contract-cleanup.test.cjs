#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");

const MUST_EXIST = [
  "docs/EDITOR_BAUPLAN.md",
  "docs/UI_ELEMENT_KATALOG.md",
  "docs/UI_BAU_UND_PRUEFREGELN.md",
  "docs/ZIEL_APP_ANBINDUNG.md",
  "docs/ZIEL_APP_AUSWAHL.md",
  "docs/ZIEL_APP_ADAPTER_REGELN.md",
  "docs/ZIEL_APP_FREIGABE_DOSSIER.md",
  "docs/UI_EDITOR_VERTRAG.md",
  "docs/UI_PDF_ENTWURFSENTSCHEIDUNG.md",
  "codex/AGENTS_UI_EDITOR_BLOCK.md",
  "codex/CODEX_BOOTSTRAP_ZIEL_APP.md",
  "docs/NEUTRAL_THEME_TOKENS.md",
  "styles/neutral-theme-tokens.css",
  "scripts/ui-editor-contract-check.cjs",
  "scripts/install-ui-editor-to-target.cjs",
  "src/core/target-contract.cjs",
  "scripts/tests/target-contract.test.cjs",
  "src/core/editor-ui-details-view-model.cjs",
  "scripts/tests/editor-ui-details-view-model.test.cjs",
  "src/core/editor-ui-change-draft-view-model.cjs",
  "scripts/tests/editor-ui-change-draft-view-model.test.cjs",
  "src/core/target-app-bootstrap.cjs",
  "scripts/tests/target-app-bootstrap.test.cjs",
  "src/core/target-app-test-host-flow.cjs",
  "scripts/tests/target-app-test-host-flow.test.cjs",
  "src/core/neutral-minimal-host.cjs",
  "scripts/tests/neutral-minimal-host.test.cjs",
  "scripts/fixtures/neutral-target-app/neutralTargetApp.cjs",
  "scripts/tests/neutral-target-app.test.cjs",
  "src/core/target-app-adapter-path.cjs",
  "scripts/tests/target-app-adapter-path.test.cjs",
  "docs/M46_OFFIZIELLER_ADAPTER_INSTALLER_PFAD.md",
  "src/core/target-app-adapter-manifest.cjs",
  "scripts/tests/target-app-adapter-manifest.test.cjs",
  "src/core/target-app-adapter-manifest-check.cjs",
  "scripts/tests/target-app-adapter-manifest-check.test.cjs",
  "src/core/target-app-adapter-release-gate.cjs",
  "scripts/tests/target-app-adapter-release-gate.test.cjs",
  "src/core/target-app-adapter-plan.cjs",
  "scripts/tests/target-app-adapter-plan.test.cjs",
  "src/core/target-app-adapter-plan-safety-check.cjs",
  "scripts/tests/target-app-adapter-plan-safety-check.test.cjs",
  "src/core/target-app-installer-plan.cjs",
  "scripts/tests/target-app-installer-plan.test.cjs",
  "src/core/target-app-installer-execution.cjs",
  "scripts/tests/target-app-installer-execution.test.cjs",
  "src/core/target-app-installer-uninstall.cjs",
  "scripts/tests/target-app-installer-uninstall.test.cjs",
  "scripts/tests/target-app-registry-contract.test.cjs",
  "scripts/tests/install-ui-editor-to-target-cli.test.cjs",
  "scripts/start-installer-app.cjs",
  "src/installer-app/index.html",
  "src/installer-app/installer-app.js",
  "src/installer-app/installer-app.css",
  "scripts/tests/installer-app-start.test.cjs",
  "src/core/layout-state-contract.cjs",
  "src/core/layout-state-store.cjs",
  "src/core/layout-state-model.cjs",
  "scripts/tests/layout-state-model.test.cjs",
  "scripts/tests/layout-state-store.test.cjs",
  "docs/M45_LAYOUT_STATE_STORAGE_VERSIONING.md",
  "docs/M47_NEUE_ZIEL_APP_MINIMAL_ANBINDUNG.md",
  "scripts/fixtures/minimal-target-app/README.md",
  "scripts/fixtures/minimal-target-app/minimal-target-app.cjs",
  "scripts/tests/minimal-target-app-example.test.cjs",
  "src/index.cjs",
  "scripts/tests/public-core-api.test.cjs",
  "docs/M48_PUBLIC_CORE_API_EXPORTS.md",
  "docs/releases/v0.2.0.md",
  "docs/M50_RELEASE_TAG_CHECKLIST.md",
  "scripts/check-release-readiness.cjs",
  "scripts/tests/release-readiness.test.cjs",
];

const MUST_NOT_EXIST = [
  "browser/mini-inspector-host-adapter.js",
  "demo/mini-inspector/index.html",
  "demo/mini-inspector/mini-inspector-demo.js",
  "demo/mini-inspector/mini-inspector-demo.css",
  "examples/beispiel-ui/README.md",
  "examples/beispiel-ui/beispiel.html",
  "examples/host-app-basic/index.html",
  "examples/host-app-basic/host-app-basic.js",
  "examples/host-app-basic/host-app-basic.css",
  "examples/mini-inspector/index.html",
  "examples/mini-inspector/README.md",
  "docs/APP_INTEGRATION_MODELL.md",
  "docs/EINBAU_IN_NEUE_APP.md",
  "docs/HOST_APP_ADOPTION_GUIDE.md",
  "docs/HOST_APP_INTEGRATION.md",
  "docs/KIT_UEBERNAHME_CHECKLISTE.md",
  "docs/LAYOUTDATEN_API.md",
  "docs/LAYOUTDATEN_KERN_REFERENZ.md",
  "docs/LAYOUTDATEN_MODELL.md",
  "docs/MINI_INSPECTOR_REFERENZ.md",
  "docs/MINI_INSPECTOR_STATUS.md",
  "docs/REFERENCE_STATUS.md",
  "docs/UEBERNAHME_TROCKENLAUF.md",
  "scripts/mini-inspector-demo-host.cjs",
  "scripts/mini-inspector-browser-demo-info.cjs",
  "scripts/host-app-basic-info.cjs",
  "scripts/layout-data-api.cjs",
  "scripts/layout-data-diagnostics-cli.cjs",
  "scripts/mini-inspector-layout-read.cjs",
  "scripts/layout-data-diagnostics.cjs",
  "scripts/layout-data-extractor.cjs",
  "scripts/layout-data-validator.cjs",
  "scripts/tests/mini-inspector-browser-demo.test.cjs",
  "scripts/tests/mini-inspector-demo-host.test.cjs",
  "scripts/tests/mini-inspector-layout-read.test.cjs",
  "scripts/tests/host-app-basic-example.test.cjs",
  "scripts/tests/host-app-integration-contract.test.cjs",
  "scripts/tests/host-app-adoption-guide.test.cjs",
  "scripts/tests/reference-status.test.cjs",
  "scripts/tests/layout-data-api.test.cjs",
  "scripts/tests/layout-data-diagnostics.test.cjs",
  "scripts/tests/layout-data-diagnostics-cli.test.cjs",
  "scripts/tests/layout-data-extractor.test.cjs",
  "scripts/tests/layout-data-validator.test.cjs",
];

const FORBIDDEN_TERMS = ["Protokoll", "TOP", "Bauvorhaben", "Restarbeiten", "BBM", "Pferdeverwaltung"];

function read(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

function assertNoTerms(text, terms, label) {
  terms.forEach((term) => {
    assert.equal(text.includes(term), false, `${label} enthaelt verbotenen Begriff: ${term}`);
  });
}

function assertIncludes(text, fragment, label) {
  assert.equal(text.includes(fragment), true, `${label} enthaelt nicht: ${fragment}`);
}

function run() {
  MUST_EXIST.forEach((relativePath) => {
    assert.equal(fs.existsSync(path.join(REPO_ROOT, relativePath)), true, `Datei fehlt: ${relativePath}`);
  });

  MUST_NOT_EXIST.forEach((relativePath) => {
    assert.equal(fs.existsSync(path.join(REPO_ROOT, relativePath)), false, `Datei existiert noch: ${relativePath}`);
  });

  const packageJson = JSON.parse(read("package.json"));
  assert.equal(packageJson.main, "src/index.cjs");
  assert.deepEqual(packageJson.exports, { ".": { require: "./src/index.cjs" } });
  assert.deepEqual(Object.keys(packageJson.scripts), ["start", "install:target", "release:check", "test"]);
  assert.equal(packageJson.scripts.start, "node scripts/start-installer-app.cjs");
  assert.equal(packageJson.scripts["install:target"], "node scripts/install-ui-editor-to-target.cjs");
  assert.equal(packageJson.scripts["release:check"], "node scripts/check-release-readiness.cjs");
  assert.equal(
    packageJson.scripts.test,
    "node scripts/ui-editor-contract-check.cjs --self-test && node scripts/tests/ui-element-model.test.cjs && node scripts/tests/ui-element-registry.test.cjs && node scripts/tests/ui-element-validator.test.cjs && node scripts/tests/editor-core.test.cjs && node scripts/tests/editor-runtime-launcher.test.cjs && node scripts/tests/editor-scope-selection-status-view-models.test.cjs && node scripts/tests/change-request-model.test.cjs && node scripts/tests/change-request-validator.test.cjs && node scripts/tests/host-adapter-contract.test.cjs && node scripts/tests/m57SelectionContract.test.cjs && node scripts/tests/test-host-adapter.test.cjs && node scripts/tests/layout-state-model.test.cjs && node scripts/tests/layout-state-store.test.cjs && node scripts/tests/editor-ui-tree-view-model.test.cjs && node scripts/tests/editor-ui-state.test.cjs && node scripts/tests/target-selection.test.cjs && node scripts/tests/target-contract.test.cjs && node scripts/tests/editor-ui-details-view-model.test.cjs && node scripts/tests/editor-ui-change-draft-view-model.test.cjs && node scripts/tests/target-app-bootstrap.test.cjs && node scripts/tests/target-app-test-host-flow.test.cjs && node scripts/tests/neutral-minimal-host.test.cjs && node scripts/tests/neutral-target-app.test.cjs && node scripts/tests/target-app-adapter-path.test.cjs && node scripts/tests/minimal-target-app-example.test.cjs && node scripts/tests/public-core-api.test.cjs && node scripts/tests/target-app-adapter-manifest.test.cjs && node scripts/tests/target-app-adapter-manifest-check.test.cjs && node scripts/tests/target-app-adapter-release-gate.test.cjs && node scripts/tests/target-app-adapter-plan.test.cjs && node scripts/tests/target-app-adapter-plan-safety-check.test.cjs && node scripts/tests/target-app-installer-plan.test.cjs && node scripts/tests/target-app-installer-execution.test.cjs && node scripts/tests/target-app-installer-uninstall.test.cjs && node scripts/tests/target-app-registry-contract.test.cjs && node scripts/tests/install-ui-editor-to-target-cli.test.cjs && node scripts/tests/repo-core-contract-cleanup.test.cjs && node scripts/tests/installer-app-start.test.cjs && node scripts/tests/release-readiness.test.cjs"
  );

  const readme = read("README.md");
  assertNoTerms(readme, FORBIDDEN_TERMS, "README");
  assertIncludes(readme, "Offizieller Ziel-App-Regelpaket-Bootstrap", "README");
  assertIncludes(readme, "CLI-Regelpaket-Installation", "README");
  assertIncludes(readme, "Browser-Installer existiert weiterhin, ist aber nicht mehr der empfohlene Standardweg", "README");
  assertIncludes(readme, "node scripts/install-ui-editor-to-target.cjs", "README");
  assertIncludes(readme, "keine bestehende UI analysieren", "README");
  assertIncludes(readme, "keine bestehende UI scannen", "README");
  assertIncludes(readme, "keine bestehende UI migrieren", "README");
  assertIncludes(readme, "keine automatische UI-Elementliste erzeugen", "README");
  assertNoTerms(read("docs/UI_EDITOR_VERTRAG.md"), FORBIDDEN_TERMS, "UI_EDITOR_VERTRAG");
  assertNoTerms(read("docs/NEUTRAL_THEME_TOKENS.md"), ["Browser-Demo", "browser demo", "mini-inspector"], "NEUTRAL_THEME_TOKENS");

  console.log("TESTS OK: repo-core-contract-cleanup");
}

run();
