#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { createEditorRuntimeLauncher } = require("../../src/core/editor-runtime-launcher.cjs");
const { createNeutralMinimalRegistry } = require("../../src/core/neutral-minimal-host.cjs");
const { createTestHostAdapter } = require("../../src/core/test-host-adapter.cjs");
const { createTargetAppAdapterManifest } = require("../../src/core/target-app-adapter-manifest.cjs");

function createManifest(values) {
  return createTargetAppAdapterManifest({
    targetAppId: "neutral-target",
    adapterName: "neutral-adapter",
    adapterVersion: "1.0.0",
    uiScope: "workspace",
    layoutScope: "workspace.layout",
    layoutProfileId: "neutral-layout",
    supportedElementTypes: ["root", "area"],
    supportedRoles: ["layout"],
    supportedOperations: ["inspect", "move", "resize"],
    lockedOperations: ["hide", "reset"],
    persistenceMode: "memory-only",
    executionMode: "dry-run",
    riskClass: "low",
    rollbackStrategy: "neutral-rollback",
    testStrategy: "neutral-runtime-test",
    ...values,
  });
}

function createHostAdapter(values) {
  const adapter = createTestHostAdapter({
    registry: createNeutralMinimalRegistry(),
    layoutState: { neutral: true },
  });
  adapter.adapterManifest = createManifest();
  return Object.assign(adapter, values || {});
}

function run() {
  assert.equal(typeof createEditorRuntimeLauncher, "function");

  const okStatus = createEditorRuntimeLauncher(createHostAdapter());
  assert.deepEqual(okStatus, {
    ok: true,
    targetAppId: "neutral-target",
    adapterName: "neutral-adapter",
    uiScope: "workspace",
    layoutScope: "workspace.layout",
    registryElementCount: 4,
    selectedElementId: null,
    availableOperations: [],
    blocked: false,
    errors: [],
  });

  assert.equal(createEditorRuntimeLauncher(null).blocked, "missing_host_adapter");
  assert.equal(createEditorRuntimeLauncher(null).errors[0].code, "missing_host_adapter");

  const invalidAdapterStatus = createEditorRuntimeLauncher({ getRegistry() {} });
  assert.equal(invalidAdapterStatus.ok, false);
  assert.equal(invalidAdapterStatus.blocked, "invalid_host_adapter");

  const invalidRegistryStatus = createEditorRuntimeLauncher(createHostAdapter({ getRegistry: () => ({}) }));
  assert.equal(invalidRegistryStatus.ok, false);
  assert.equal(invalidRegistryStatus.blocked, "invalid_registry");

  const invalidManifestStatus = createEditorRuntimeLauncher(createHostAdapter({
    adapterManifest: { ...createManifest(), database: "blocked" },
  }));
  assert.equal(invalidManifestStatus.ok, false);
  assert.equal(invalidManifestStatus.blocked, "invalid_manifest");
  assert.equal(invalidManifestStatus.errors[0].details.some((error) => error.code === "forbidden_field"), true);

  const runtimeHostAdapter = createHostAdapter();
  const runtimeStatus = createEditorRuntimeLauncher(runtimeHostAdapter);
  assert.equal(runtimeStatus.registryElementCount, 4);
  assert.equal(runtimeStatus.selectedElementId, null);
  assert.deepEqual(runtimeStatus.availableOperations, []);
  assert.equal(runtimeHostAdapter.listSubmittedChangeRequests().length, 0);

  let submitted = false;
  createEditorRuntimeLauncher(createHostAdapter({
    submitChangeRequest() {
      submitted = true;
      return { ok: false, accepted: false, code: "target_rejected_change" };
    },
  }));
  assert.equal(submitted, false);

  const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), "ui-editor-runtime-target-"));
  const targetFile = path.join(targetDir, "target-app-file.txt");
  fs.writeFileSync(targetFile, "before", "utf8");
  createEditorRuntimeLauncher(createHostAdapter());
  assert.equal(fs.readFileSync(targetFile, "utf8"), "before");

  const source = fs.readFileSync(path.join(__dirname, "../../src/core/editor-runtime-launcher.cjs"), "utf8");
  ["querySelector", "document.", "window.", "autoDetect", "autoRegister"].forEach((term) => {
    assert.equal(source.includes(term), false, `Runtime darf ${term} nicht verwenden.`);
  });

  console.log("TESTS OK: editor-runtime-launcher");
}

run();
