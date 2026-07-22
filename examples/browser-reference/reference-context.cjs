"use strict";

const REFERENCE_PROFILES = Object.freeze(["default", "compact"]);

function createReferenceTargetContext(profileId) {
  const layoutProfileId = REFERENCE_PROFILES.includes(profileId) ? profileId : "default";
  return Object.freeze({
    targetAppId: "ui-editor-reference",
    moduleId: "browser-demo",
    scopeId: "main",
    layoutProfileId,
  });
}

module.exports = { REFERENCE_PROFILES, createReferenceTargetContext };
