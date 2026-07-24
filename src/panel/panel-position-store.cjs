"use strict";

const PANEL_POSITION_VERSION = 1;

function validPosition(value) {
  return value && Number.isFinite(value.x) && Number.isFinite(value.y);
}

function createPanelPositionStore(options) {
  const cfg = options || {};
  const storage = cfg.storage;
  const namespace = cfg.namespace || "ui-editor-panel-position";
  const targetAppId = cfg.targetAppId || "default";
  const key = `${namespace}::${targetAppId}`;

  return Object.freeze({
    key,
    read() {
      if (!storage || typeof storage.getItem !== "function") return { ok: false, code: "PANEL_POSITION_STORAGE_UNAVAILABLE" };
      try {
        const raw = storage.getItem(key);
        if (raw == null) return { ok: true, value: null };
        const parsed = JSON.parse(raw);
        if (parsed.version !== PANEL_POSITION_VERSION || !validPosition(parsed.position)) return { ok: false, code: "INVALID_PANEL_POSITION" };
        return { ok: true, value: { x: parsed.position.x, y: parsed.position.y } };
      } catch (error) {
        return { ok: false, code: "PANEL_POSITION_READ_FAILED", reason: error.message };
      }
    },
    write(position) {
      if (!validPosition(position)) return { ok: false, code: "INVALID_PANEL_POSITION" };
      if (!storage || typeof storage.setItem !== "function") return { ok: false, code: "PANEL_POSITION_STORAGE_UNAVAILABLE" };
      try {
        storage.setItem(key, JSON.stringify({ version: PANEL_POSITION_VERSION, position: { x: position.x, y: position.y } }));
        return { ok: true };
      } catch (error) {
        return { ok: false, code: "PANEL_POSITION_WRITE_FAILED", reason: error.message };
      }
    },
  });
}

module.exports = { createPanelPositionStore, validPosition };
