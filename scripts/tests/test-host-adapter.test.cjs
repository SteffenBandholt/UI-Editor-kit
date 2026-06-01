#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const TEST_ADAPTER_PATH = path.join(REPO_ROOT, "src/core/test-host-adapter.cjs");
const CONTRACT_PATH = path.join(REPO_ROOT, "src/core/host-adapter-contract.cjs");

function loadModules() {
  delete require.cache[TEST_ADAPTER_PATH];
  delete require.cache[CONTRACT_PATH];
  return {
    ...require(TEST_ADAPTER_PATH),
    ...require(CONTRACT_PATH),
  };
}

function readTestAdapterSource() {
  return fs.readFileSync(TEST_ADAPTER_PATH, "utf8");
}

function assertNoForbiddenFragments(text, label) {
  const forbiddenFragments = [
    "document.",
    "window.",
    "querySelector",
    "createElement",
    "fetch(",
    "http://",
    "https://",
    "node:fs",
    "node:net",
    "node:http",
    "node:https",
    "sqlite",
    ["H", "TML"].join(""),
    ["D", "OM"].join(""),
    ["Browser"].join(""),
    ["Mini", "-Inspector"].join(""),
    ["Host", "-App", "-Demo"].join(""),
    ["Layout", "diagnose"].join(""),
    ["data", "-ui"].join(""),
    ["D", "emo"].join(""),
  ];

  forbiddenFragments.forEach((fragment) => {
    assert.equal(text.includes(fragment), false, `${label} enthaelt verbotenen Fragmenttext: ${fragment}`);
  });
}

function assertNoForbiddenDomainTerms(text, label) {
  const forbiddenTerms = [
    ["B", "BM"].join(""),
    ["Proto", "koll"].join(""),
    ["Rest", "arbeiten"].join(""),
    ["T", "OP"].join(""),
    ["Bau", "vorhaben"].join(""),
  ];

  forbiddenTerms.forEach((term) => {
    assert.equal(text.includes(term), false, `${label} enthaelt verbotenen Begriff: ${term}`);
  });
}

function makeChangeRequest(overrides) {
  return {
    changeId: "change-001",
    elementId: "workspace.main.area",
    operation: "move",
    payload: {
      layout: {
        x: 1,
        y: 2,
      },
    },
    createdAt: "2026-06-01T00:00:00.000Z",
    source: "test-host-adapter-test",
    ...(overrides || {}),
  };
}

function run() {
  const {
    createTestHostAdapter,
    validateHostAdapterContract,
  } = loadModules();

  const adapter = createTestHostAdapter();
  assert.equal(typeof adapter.getRegistry, "function");
  assert.equal(typeof adapter.getCurrentLayoutState, "function");
  assert.equal(typeof adapter.submitChangeRequest, "function");

  assert.deepEqual(validateHostAdapterContract(adapter), { ok: true, errors: [] });

  const registry = { id: "registry-001" };
  const registryAdapter = createTestHostAdapter({ registry });
  assert.equal(registryAdapter.getRegistry(), registry);

  const layoutState = {
    elements: {
      "workspace.main.area": {
        width: 320,
      },
    },
  };
  const layoutAdapter = createTestHostAdapter({ layoutState });
  const firstLayoutState = layoutAdapter.getCurrentLayoutState();
  assert.deepEqual(firstLayoutState, layoutState);
  assert.notEqual(firstLayoutState, layoutState);
  assert.notEqual(firstLayoutState.elements, layoutState.elements);

  firstLayoutState.elements["workspace.main.area"].width = 999;
  assert.equal(layoutAdapter.getCurrentLayoutState().elements["workspace.main.area"].width, 320);

  const submittedRequest = makeChangeRequest();
  const result = layoutAdapter.submitChangeRequest(submittedRequest);
  assert.equal(result.ok, true);
  assert.equal(result.accepted, true);
  assert.equal(result.executed, false);
  assert.deepEqual(layoutAdapter.listSubmittedChangeRequests(), [submittedRequest]);

  assert.equal(layoutAdapter.getCurrentLayoutState().elements["workspace.main.area"].width, 320);

  const listedRequests = layoutAdapter.listSubmittedChangeRequests();
  assert.deepEqual(listedRequests, [submittedRequest]);
  assert.notEqual(listedRequests[0], submittedRequest);
  assert.notEqual(listedRequests[0].payload, submittedRequest.payload);

  submittedRequest.payload.layout.x = 777;
  assert.equal(layoutAdapter.listSubmittedChangeRequests()[0].payload.layout.x, 1);

  listedRequests[0].payload.layout.y = 888;
  assert.equal(layoutAdapter.listSubmittedChangeRequests()[0].payload.layout.y, 2);

  layoutAdapter.clearSubmittedChangeRequests();
  assert.deepEqual(layoutAdapter.listSubmittedChangeRequests(), []);

  const requestWithForbiddenFields = makeChangeRequest({
    payload: {
      width: 100,
      database: "not-stored",
      nested: {
        recordId: "not-stored",
        height: 200,
      },
    },
    tableName: "not-stored",
  });
  layoutAdapter.submitChangeRequest(requestWithForbiddenFields);
  assert.deepEqual(layoutAdapter.listSubmittedChangeRequests(), [
    makeChangeRequest({
      payload: {
        width: 100,
        nested: {
          height: 200,
        },
      },
    }),
  ]);

  let externalCallCount = 0;
  const noExternalAdapter = createTestHostAdapter({
    layoutState: {
      value: 1,
    },
    connect() {
      externalCallCount += 1;
    },
  });
  noExternalAdapter.submitChangeRequest(makeChangeRequest());
  assert.equal(externalCallCount, 0);

  const source = readTestAdapterSource();
  assertNoForbiddenFragments(source, "test-host-adapter");
  assertNoForbiddenDomainTerms(source, "test-host-adapter");

  console.log("TESTS OK: test-host-adapter");
}

run();
