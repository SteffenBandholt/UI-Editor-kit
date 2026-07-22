"use strict";
const PANEL_LAYERS = Object.freeze({ ELEMENT: "element", TEXT: "text" });
const PANEL_MODES = Object.freeze({ MOVE: "move", WIDTH: "width", HEIGHT: "height", TEXT_POSITION: "text-position", TEXT_SIZE: "text-size" });
const PANEL_DIRECTIONS = Object.freeze({ UP: "up", DOWN: "down", LEFT: "left", RIGHT: "right", CENTER: "center" });
const PANEL_INTENTS = Object.freeze({
  SELECT_ELEMENT: "select-element", CLEAR_SELECTION: "clear-selection", SET_MODE: "set-mode", SET_STEP_SIZE: "set-step-size",
  SET_LAYER: "set-layer", CLOSE: "close-editor",
  DPAD_UP: "dpad-up", DPAD_DOWN: "dpad-down", DPAD_LEFT: "dpad-left", DPAD_RIGHT: "dpad-right", DPAD_CENTER: "dpad-center",
  SAVE: "save-layout", LOAD: "load-layout", DISCARD_ALL: "discard-all-session-changes",
  REQUEST_RESET_ELEMENT: "request-reset-element-defaults", CONFIRM_RESET_ELEMENT: "confirm-reset-element-defaults", CANCEL_RESET_ELEMENT: "cancel-reset-element-defaults",
  REQUEST_RESET_LAYOUT: "request-reset-layout-defaults", CONFIRM_RESET_LAYOUT: "confirm-reset-layout-defaults", CANCEL_RESET_LAYOUT: "cancel-reset-layout-defaults",
});
module.exports = { PANEL_LAYERS, PANEL_MODES, PANEL_DIRECTIONS, PANEL_INTENTS };
