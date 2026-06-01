"use strict";

const { getForbiddenChangeRequestFields } = require("./change-request-model.cjs");

function cloneNeutralValue(value, forbiddenFields) {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneNeutralValue(entry, forbiddenFields));
  }

  if (value && typeof value === "object") {
    const clone = {};
    Object.keys(value).forEach((key) => {
      if (forbiddenFields.includes(key)) {
        return;
      }

      clone[key] = cloneNeutralValue(value[key], forbiddenFields);
    });
    return clone;
  }

  return value;
}

function createTestHostAdapter(options) {
  const safeOptions = options && typeof options === "object" && !Array.isArray(options) ? options : {};
  const registry = Object.prototype.hasOwnProperty.call(safeOptions, "registry") ? safeOptions.registry : null;
  const initialLayoutState = Object.prototype.hasOwnProperty.call(safeOptions, "layoutState")
    ? safeOptions.layoutState
    : {};
  const forbiddenFields = getForbiddenChangeRequestFields();
  const layoutState = cloneNeutralValue(initialLayoutState, forbiddenFields);
  let submittedChangeRequests = [];

  return {
    getRegistry() {
      return registry;
    },

    getCurrentLayoutState() {
      return cloneNeutralValue(layoutState, forbiddenFields);
    },

    submitChangeRequest(changeRequest) {
      submittedChangeRequests.push(cloneNeutralValue(changeRequest, forbiddenFields));

      return {
        ok: true,
        accepted: true,
        executed: false,
      };
    },

    listSubmittedChangeRequests() {
      return cloneNeutralValue(submittedChangeRequests, forbiddenFields);
    },

    clearSubmittedChangeRequests() {
      submittedChangeRequests = [];
    },
  };
}

module.exports = {
  createTestHostAdapter,
};
