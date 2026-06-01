"use strict";

const HOST_ADAPTER_REQUIRED_METHODS = [
  "getRegistry",
  "getCurrentLayoutState",
  "submitChangeRequest",
];

function getHostAdapterRequiredMethods() {
  return HOST_ADAPTER_REQUIRED_METHODS.slice();
}

function createResult(errors) {
  return {
    ok: errors.length === 0,
    errors,
  };
}

function validateHostAdapterContract(adapter) {
  const errors = [];

  if (!adapter || typeof adapter !== "object" || Array.isArray(adapter)) {
    errors.push({
      code: "invalid_host_adapter",
      message: "Host-Adapter muss ein Objekt sein.",
    });
    return createResult(errors);
  }

  HOST_ADAPTER_REQUIRED_METHODS.forEach((methodName) => {
    if (typeof adapter[methodName] !== "function") {
      errors.push({
        code: "missing_host_adapter_method",
        method: methodName,
        message: `Host-Adapter muss ${methodName}() bereitstellen.`,
      });
    }
  });

  return createResult(errors);
}

module.exports = {
  getHostAdapterRequiredMethods,
  validateHostAdapterContract,
};
