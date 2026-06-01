#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const CONTRACT_PATH = path.join(REPO_ROOT, "src/core/host-adapter-contract.cjs");

function loadContractModule() {
  delete require.cache[CONTRACT_PATH];
  return require(CONTRACT_PATH);
}

function readContractSource() {
  return fs.readFileSync(CONTRACT_PATH, "utf8");
}

function assertNoForbiddenFragments(text, label) {
  const forbiddenFragments = [
    "document.",
    "window.",
    "querySelector",
    "createElement",
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

function run() {
  const {
    getHostAdapterRequiredMethods,
    validateHostAdapterContract,
  } = loadContractModule();

  assert.deepEqual(getHostAdapterRequiredMethods(), [
    "getRegistry",
    "getCurrentLayoutState",
    "submitChangeRequest",
  ]);

  const requiredMethods = getHostAdapterRequiredMethods();
  requiredMethods.push("mutated");
  assert.equal(getHostAdapterRequiredMethods().includes("mutated"), false);

  const validAdapter = {
    getRegistry() {
      throw new Error("darf nicht ausgefuehrt werden");
    },
    getCurrentLayoutState() {
      throw new Error("darf nicht ausgefuehrt werden");
    },
    submitChangeRequest() {
      throw new Error("darf nicht ausgefuehrt werden");
    },
    optionalHelper: true,
  };
  assert.deepEqual(validateHostAdapterContract(validAdapter), { ok: true, errors: [] });

  assert.deepEqual(validateHostAdapterContract(), {
    ok: false,
    errors: [
      {
        code: "invalid_host_adapter",
        message: "Host-Adapter muss ein Objekt sein.",
      },
    ],
  });

  assert.deepEqual(validateHostAdapterContract([]), {
    ok: false,
    errors: [
      {
        code: "invalid_host_adapter",
        message: "Host-Adapter muss ein Objekt sein.",
      },
    ],
  });

  const missingRegistry = validateHostAdapterContract({
    getCurrentLayoutState() {},
    submitChangeRequest() {},
  });
  assert.equal(missingRegistry.ok, false);
  assert.deepEqual(missingRegistry.errors, [
    {
      code: "missing_host_adapter_method",
      method: "getRegistry",
      message: "Host-Adapter muss getRegistry() bereitstellen.",
    },
  ]);

  const missingLayoutState = validateHostAdapterContract({
    getRegistry() {},
    submitChangeRequest() {},
  });
  assert.equal(missingLayoutState.ok, false);
  assert.equal(missingLayoutState.errors[0].method, "getCurrentLayoutState");
  assert.equal(missingLayoutState.errors[0].code, "missing_host_adapter_method");

  const missingSubmit = validateHostAdapterContract({
    getRegistry() {},
    getCurrentLayoutState() {},
  });
  assert.equal(missingSubmit.ok, false);
  assert.equal(missingSubmit.errors[0].method, "submitChangeRequest");
  assert.equal(missingSubmit.errors[0].code, "missing_host_adapter_method");

  let executed = false;
  const guardedAdapter = {
    getRegistry() {
      executed = true;
    },
    getCurrentLayoutState() {
      executed = true;
    },
    submitChangeRequest() {
      executed = true;
    },
  };
  validateHostAdapterContract(guardedAdapter);
  assert.equal(executed, false);

  const adapterBeforeValidation = {
    getRegistry() {},
    getCurrentLayoutState() {},
    submitChangeRequest() {},
  };
  const keysBeforeValidation = Object.keys(adapterBeforeValidation);
  validateHostAdapterContract(adapterBeforeValidation);
  assert.deepEqual(Object.keys(adapterBeforeValidation), keysBeforeValidation);
  assert.equal(Object.prototype.hasOwnProperty.call(adapterBeforeValidation, "errors"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(adapterBeforeValidation, "ok"), false);

  const source = readContractSource();
  assertNoForbiddenFragments(source, "host-adapter-contract");
  assertNoForbiddenDomainTerms(source, "host-adapter-contract");

  console.log("TESTS OK: host-adapter-contract");
}

run();
