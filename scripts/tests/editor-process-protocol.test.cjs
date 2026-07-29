#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const path = require("node:path");
const readline = require("node:readline");
const { PROTOCOL_VERSION, MESSAGE_TYPES, createEditorProcessProtocol } = require("../../src/process/editor-process-protocol.cjs");

let hostNumber = 1;
function message(messageType, payload, sessionId, protocolVersion) {
  return {
    protocolVersion: protocolVersion || PROTOCOL_VERSION,
    messageId: `host-${hostNumber++}`,
    messageType,
    timestamp: "2026-07-25T12:00:00.000Z",
    ...(sessionId ? { sessionId } : {}),
    payload: payload || {},
  };
}

const elements = [
  { id: "ui.order-header", name: "Auftragskopf", type: "root", role: "layout", parentId: null, order: 0, visible: true, editable: false, allowedOps: [], lockedOps: [] },
  { id: "ui.order-header.order-number", name: "Auftragsnummer", type: "field", role: "content", parentId: "ui.order-header", order: 1, visible: true, editable: true, allowedOps: ["move", "resizeWidth", "resizeHeight", "textMove", "textResize"], lockedOps: [] },
];
const layoutState = {
  schemaVersion: 1,
  targetAppId: "reference-target-app",
  uiScope: "ui.order-header",
  layoutScope: "ui.order-header",
  layoutProfileId: "runtime",
  version: 1,
  source: "default",
  elements: {
    "ui.order-header": { element: { x: 0, y: 0, width: 800, height: 300 } },
    "ui.order-header.order-number": { element: { x: 0, y: 0, width: 200, height: 30 }, text: { offsetX: 4, offsetY: 2, fontSize: 14 } },
  },
};
const changeRequest = {
  changeId: "change-1",
  elementId: "ui.order-header.order-number",
  operation: "resizeWidth",
  payload: { width: 224 },
  createdAt: "2026-07-25T12:00:00.000Z",
  source: "m73.4-test",
  scope: "ui.order-header",
};

function one(protocol, request) {
  const outcome = protocol.handle(request);
  assert.equal(outcome.messages.length, 1);
  return { response: outcome.messages[0], shouldExit: outcome.shouldExit };
}

function runProtocolContractTests() {
  const protocol = createEditorProcessProtocol({ productVersion: "0.2.0", now: () => "2026-07-25T12:00:01.000Z" });
  let result = one(protocol, message(MESSAGE_TYPES.HANDSHAKE));
  assert.equal(result.response.messageType, MESSAGE_TYPES.HANDSHAKE_ACCEPTED);
  assert.equal(result.response.payload.protocolVersion, PROTOCOL_VERSION);

  result = one(protocol, message(MESSAGE_TYPES.ACTIVATE));
  assert.equal(result.response.messageType, MESSAGE_TYPES.ACTIVATED);
  assert.equal(result.response.payload.alreadyActive, false);
  result = one(protocol, message(MESSAGE_TYPES.ACTIVATE));
  assert.equal(result.response.payload.alreadyActive, true);

  const sessionId = "session-1";
  result = one(protocol, message(MESSAGE_TYPES.START_SESSION, {}, sessionId));
  assert.equal(result.response.messageType, MESSAGE_TYPES.REQUEST_REGISTRY);
  result = one(protocol, message(MESSAGE_TYPES.START_SESSION, {}, "session-2"));
  assert.equal(result.response.payload.code, "session_already_active");
  result = one(protocol, message(MESSAGE_TYPES.REGISTRY, { elements }, sessionId));
  assert.equal(result.response.messageType, MESSAGE_TYPES.REQUEST_LAYOUT_STATE);
  result = one(protocol, message(MESSAGE_TYPES.LAYOUT_STATE, { layoutState }, sessionId));
  assert.equal(result.response.messageType, MESSAGE_TYPES.SESSION_STARTED);
  assert.equal(result.response.payload.elementCount, 2);

  result = one(protocol, message(MESSAGE_TYPES.DIAGNOSTIC, { changeRequest }, "wrong"));
  assert.equal(result.response.payload.code, "wrong_session");
  result = one(protocol, message(MESSAGE_TYPES.DIAGNOSTIC, { changeRequest }, sessionId));
  assert.equal(result.response.messageType, MESSAGE_TYPES.SUBMIT_CHANGE_REQUEST);
  assert.deepEqual(result.response.payload.changeRequest, changeRequest);

  const changeResult = {
    success: true,
    changeId: "change-1",
    elementId: "ui.order-header.order-number",
    operation: "resizeWidth",
    errorCode: null,
    message: "angewandt",
    previousState: null,
    newState: { elementId: "ui.order-header.order-number", scopeId: "ui.order-header", x: 0, y: 0, width: 224, height: 30, textOffsetX: 4, textOffsetY: 2, fontSize: 14 },
    rollbackSucceeded: true,
  };
  result = one(protocol, message(MESSAGE_TYPES.CHANGE_RESULT, { changeResult }, sessionId));
  assert.equal(result.response.messageType, MESSAGE_TYPES.CHANGE_RESULT_ACCEPTED);
  result = one(protocol, message(MESSAGE_TYPES.END_SESSION, {}, sessionId));
  assert.equal(result.response.messageType, MESSAGE_TYPES.SESSION_ENDED);
  result = one(protocol, message(MESSAGE_TYPES.DEACTIVATE));
  assert.equal(result.response.messageType, MESSAGE_TYPES.DEACTIVATED);
  result = one(protocol, message(MESSAGE_TYPES.SHUTDOWN));
  assert.equal(result.response.messageType, MESSAGE_TYPES.SHUTDOWN_COMPLETE);
  assert.equal(result.shouldExit, true);

  result = one(createEditorProcessProtocol(), message(MESSAGE_TYPES.HANDSHAKE, {}, null, "9.9"));
  assert.equal(result.response.payload.code, "incompatible_protocol_version");
  result = one(createEditorProcessProtocol(), message("unknown"));
  assert.equal(result.response.payload.code, "unknown_message_type");
}

function runEditorUiProtocolTests() {
  const protocol = createEditorProcessProtocol({ now: () => "2026-07-25T12:00:01.000Z" });
  const sessionId = "ui-session";
  one(protocol, message(MESSAGE_TYPES.ACTIVATE));
  one(protocol, message(MESSAGE_TYPES.START_SESSION, {}, sessionId));
  one(protocol, message(MESSAGE_TYPES.REGISTRY, { elements }, sessionId));
  one(protocol, message(MESSAGE_TYPES.LAYOUT_STATE, { layoutState }, sessionId));

  let result = one(protocol, message(MESSAGE_TYPES.GET_EDITOR_UI_STATE, {}, sessionId));
  assert.equal(result.response.messageType, MESSAGE_TYPES.EDITOR_UI_STATE);
  assert.equal(result.response.payload.editorUiState.tree.nodes.length, 2);
  assert.equal(result.response.payload.editorUiState.details.elementId, "ui.order-header.order-number");
  assert.equal(result.response.payload.editorUiState.panel.stepSize, 1);
  assert.equal(Object.prototype.hasOwnProperty.call(result.response.payload.editorUiState.panel, "actions"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.response.payload.editorUiState.panel.dpad, "center"), false);

  result = one(protocol, message(MESSAGE_TYPES.SELECT_EDITOR_ELEMENT, { elementId: "ui.order-header" }, sessionId));
  assert.equal(result.response.payload.editorUiState.panel.layers.find((layer) => layer.id === "text").enabled, false);
  assert.ok(result.response.payload.editorUiState.panel.modes.every((mode) => mode.enabled === false));
  result = one(protocol, message(MESSAGE_TYPES.SELECT_EDITOR_ELEMENT, { elementId: "ui.order-header.order-number" }, sessionId));
  assert.equal(result.response.payload.editorUiState.details.elementId, "ui.order-header.order-number");

  result = one(protocol, message(MESSAGE_TYPES.SET_EDITOR_STEP, { stepSize: 2 }, sessionId));
  assert.equal(result.response.payload.editorUiState.panel.stepSize, 2);
  result = one(protocol, message(MESSAGE_TYPES.SET_EDITOR_STEP, { stepSize: 0 }, sessionId));
  assert.equal(result.response.payload.editorUiState.panel.stepSize, 2);
  assert.equal(result.response.payload.editorUiState.panel.status.code, "INVALID_STEP_SIZE");

  function prepare(mode, direction, expectedOperation, assertPayload) {
    one(protocol, message(MESSAGE_TYPES.SET_EDITOR_MODE, { mode }, sessionId));
    const prepared = one(protocol, message(MESSAGE_TYPES.ACTIVATE_EDITOR_DIRECTION, { direction }, sessionId));
    assert.equal(prepared.response.messageType, MESSAGE_TYPES.SUBMIT_CHANGE_REQUEST);
    assert.equal(prepared.response.payload.changeRequest.operation, expectedOperation);
    assertPayload(prepared.response.payload.changeRequest.payload);
    const parallel = one(protocol, message(MESSAGE_TYPES.ACTIVATE_EDITOR_DIRECTION, { direction }, sessionId));
    assert.equal(parallel.response.payload.code, "change_in_progress");
    return prepared.response.payload.changeRequest;
  }

  function accept(request, state, affectedStates = []) {
    const accepted = one(protocol, message(MESSAGE_TYPES.CHANGE_RESULT, { changeResult: {
      success: true, changeId: request.changeId, elementId: request.elementId, operation: request.operation,
      errorCode: null, message: "angewandt", previousState: null, newState: {
        elementId: request.elementId, scopeId: "ui.order-header", ...state,
      }, affectedStates, rollbackSucceeded: true,
    } }, sessionId));
    assert.equal(accepted.response.messageType, MESSAGE_TYPES.CHANGE_RESULT_ACCEPTED);
  }

  let request = prepare("move", "right", "move", (payload) => assert.equal(payload.x, 2));
  const tableMetrics = { tableId: "table", columnId: "description", viewportWidth: 760, tableWidth: 984, overflow: 224, overflowColumnIds: ["description"] };
  accept(request, { x: 2, y: 0, width: 200, height: 30, textOffsetX: 4, textOffsetY: 2, fontSize: 14, table: tableMetrics }, [
    { elementId: "ui.order-header", scopeId: "ui.order-header", x: 0, y: 0, width: 800, height: 300, visible: true, table: { tableId: "table", viewportWidth: 760, tableWidth: 984, overflow: 224 } },
  ]);
  result = one(protocol, message(MESSAGE_TYPES.GET_EDITOR_UI_STATE, {}, sessionId));
  assert.deepEqual(result.response.payload.editorUiState.details.currentLayout.table, tableMetrics);
  result = one(protocol, message(MESSAGE_TYPES.SELECT_EDITOR_ELEMENT, { elementId: "ui.order-header" }, sessionId));
  assert.equal(result.response.payload.editorUiState.details.currentLayout.table.viewportWidth, 760);
  one(protocol, message(MESSAGE_TYPES.SELECT_EDITOR_ELEMENT, { elementId: "ui.order-header.order-number" }, sessionId));
  request = prepare("width", "left", "resizeWidth", (payload) => assert.deepEqual(payload, { width: 198 }));
  accept(request, { x: 2, y: 0, width: 198, height: 30, textOffsetX: 4, textOffsetY: 2, fontSize: 14 });
  request = prepare("height", "down", "resizeHeight", (payload) => assert.deepEqual(payload, { height: 32 }));
  accept(request, { x: 2, y: 0, width: 198, height: 32, textOffsetX: 4, textOffsetY: 2, fontSize: 14 });

  one(protocol, message(MESSAGE_TYPES.SET_EDITOR_LAYER, { layer: "text" }, sessionId));
  request = prepare("text-position", "up", "textMove", (payload) => assert.deepEqual(payload, { text: { offsetY: 0 } }));
  accept(request, { x: 2, y: 0, width: 198, height: 32, textOffsetX: 4, textOffsetY: 0, fontSize: 14 });
  request = prepare("text-size", "right", "textResize", (payload) => assert.deepEqual(payload, { text: { fontSize: 16 } }));
  accept(request, { x: 2, y: 0, width: 198, height: 32, textOffsetX: 4, textOffsetY: 0, fontSize: 16 });

  result = one(protocol, message(MESSAGE_TYPES.ACTIVATE_EDITOR_DIRECTION, { direction: "up" }, sessionId));
  assert.equal(result.response.payload.code, "OPERATION_NOT_ALLOWED");
  result = one(protocol, message(MESSAGE_TYPES.GET_EDITOR_UI_STATE, {}, sessionId));
  assert.equal(result.response.payload.editorUiState.details.currentLayout.text.fontSize, 16);
}

function runMultiScopeEditorUiProtocolTests() {
  const protocol = createEditorProcessProtocol({ now: () => "2026-07-25T12:00:01.000Z" });
  const sessionId = "multi-scope-session";
  const orderElements = elements.map((element) => ({ ...element, layoutArea: "ui.order-header" }));
  const customerElements = [
    { id: "ui.customer-details", name: "Kundendaten", type: "root", role: "layout", parentId: null, order: 0, visible: true, editable: false, allowedOps: [], lockedOps: [], layoutArea: "ui.customer-details" },
    { id: "ui.customer-details.company", name: "Unternehmen", type: "field", role: "content", parentId: "ui.customer-details", order: 1, visible: true, editable: true, allowedOps: ["move", "resizeWidth", "resizeHeight", "textMove", "textResize"], lockedOps: [], layoutArea: "ui.customer-details" },
  ];
  const customerState = {
    ...layoutState,
    uiScope: "ui.customer-details",
    layoutScope: "ui.customer-details",
    elements: {
      "ui.customer-details": { element: { x: 0, y: 0, width: 700, height: 280 } },
      "ui.customer-details.company": { element: { x: 0, y: 0, width: 240, height: 30 }, text: { offsetX: 4, offsetY: 2, fontSize: 14 } },
    },
  };

  one(protocol, message(MESSAGE_TYPES.ACTIVATE));
  one(protocol, message(MESSAGE_TYPES.START_SESSION, {}, sessionId));
  one(protocol, message(MESSAGE_TYPES.REGISTRY, { elements: [...orderElements, ...customerElements] }, sessionId));
  let result = one(protocol, message(MESSAGE_TYPES.LAYOUT_STATE, {
    activeScopeId: "ui.order-header",
    scopeStates: [
      { scopeId: "ui.order-header", layoutState },
      { scopeId: "ui.customer-details", layoutState: customerState },
    ],
  }, sessionId));
  assert.equal(result.response.messageType, MESSAGE_TYPES.SESSION_STARTED);
  assert.deepEqual(result.response.payload.scopes.sort(), ["ui.customer-details", "ui.order-header"]);
  assert.equal(result.response.payload.activeScopeId, "ui.order-header");

  result = one(protocol, message(MESSAGE_TYPES.SELECT_EDITOR_SCOPE, { scopeId: "ui.customer-details" }, sessionId));
  assert.equal(result.response.messageType, MESSAGE_TYPES.EDITOR_UI_STATE);
  assert.equal(result.response.payload.editorUiState.scopeId, "ui.customer-details");
  assert.equal(result.response.payload.editorUiState.tree.nodes.length, 2);
  assert.equal(protocol.getState().activeSessionId, sessionId, "Scopewechsel darf keine neue Session starten.");
  result = one(protocol, message(MESSAGE_TYPES.ACTIVATE_EDITOR_DIRECTION, { direction: "right" }, sessionId));
  assert.equal(result.response.messageType, MESSAGE_TYPES.SUBMIT_CHANGE_REQUEST);
  assert.equal(result.response.payload.changeRequest.scope, "ui.customer-details");
  assert.equal(result.response.payload.changeRequest.elementId, "ui.customer-details.company");
  one(protocol, message(MESSAGE_TYPES.CHANGE_RESULT, { changeResult: {
    success: true,
    changeId: result.response.payload.changeRequest.changeId,
    elementId: "ui.customer-details.company",
    operation: "move",
    errorCode: null,
    message: "angewandt",
    previousState: null,
    newState: { elementId: "ui.customer-details.company", scopeId: "ui.customer-details", x: 1, y: 0, width: 240, height: 30, textOffsetX: 4, textOffsetY: 2, fontSize: 14 },
    rollbackSucceeded: true,
  } }, sessionId));

  const refreshedCustomer = { ...customerState, elements: { ...customerState.elements,
    "ui.customer-details.company": { element: { x: 9, y: 0, width: 240, height: 30 }, text: { offsetX: 4, offsetY: 2, fontSize: 14 } },
  } };
  result = one(protocol, message(MESSAGE_TYPES.REFRESH_EDITOR_LAYOUT_STATES, { scopeStates: [
    { scopeId: "ui.order-header", layoutState },
    { scopeId: "ui.customer-details", layoutState: refreshedCustomer },
  ] }, sessionId));
  assert.equal(result.response.payload.editorUiState.details.currentLayout.element.x, 9);
  assert.equal(protocol.getState().activeSessionId, sessionId);

  const invalidProtocol = createEditorProcessProtocol({ now: () => "2026-07-25T12:00:01.000Z" });
  const invalidSessionId = "invalid-second-scope";
  const invalidCustomerElements = customerElements.map((element) => element.id === "ui.customer-details.company"
    ? { ...element, allowedOps: ["dance"] }
    : element);
  one(invalidProtocol, message(MESSAGE_TYPES.ACTIVATE));
  one(invalidProtocol, message(MESSAGE_TYPES.START_SESSION, {}, invalidSessionId));
  result = one(invalidProtocol, message(MESSAGE_TYPES.REGISTRY, { elements: [...orderElements, ...invalidCustomerElements] }, invalidSessionId));
  assert.equal(result.response.messageType, MESSAGE_TYPES.REQUEST_LAYOUT_STATE, "Erster Scope bleibt valide");
  result = one(invalidProtocol, message(MESSAGE_TYPES.LAYOUT_STATE, {
    activeScopeId: "ui.order-header",
    scopeStates: [
      { scopeId: "ui.order-header", layoutState },
      { scopeId: "ui.customer-details", layoutState: customerState },
    ],
  }, invalidSessionId));
  assert.equal(result.response.messageType, MESSAGE_TYPES.ERROR);
  assert.equal(result.response.payload.code, "invalid_registry");
  assert.ok(result.response.payload.errors.some((error) => error.elementId === "ui.customer-details.company"));
}

async function runEntrypointTest() {
  const entry = path.join(__dirname, "../../src/process/editor-process-entry.cjs");
  const proc = childProcess.spawn(process.execPath, [entry], { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
  const lines = readline.createInterface({ input: proc.stdout, crlfDelay: Infinity });
  const queue = [];
  const waiters = [];
  lines.on("line", (line) => {
    const waiter = waiters.shift();
    if (waiter) waiter(JSON.parse(line));
    else queue.push(JSON.parse(line));
  });
  function nextLine() {
    if (queue.length) return Promise.resolve(queue.shift());
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timeout auf Prozessantwort.")), 3000);
      waiters.push((value) => { clearTimeout(timer); resolve(value); });
    });
  }
  function send(value) { proc.stdin.write(`${typeof value === "string" ? value : JSON.stringify(value)}\n`); }

  send("kein-json");
  assert.equal((await nextLine()).payload.code, "invalid_json");
  const handshake = message(MESSAGE_TYPES.HANDSHAKE);
  send(handshake);
  const accepted = await nextLine();
  assert.equal(accepted.messageType, MESSAGE_TYPES.HANDSHAKE_ACCEPTED);
  assert.equal(accepted.replyTo, handshake.messageId);
  const shutdown = message(MESSAGE_TYPES.SHUTDOWN);
  send(shutdown);
  assert.equal((await nextLine()).messageType, MESSAGE_TYPES.SHUTDOWN_COMPLETE);
  const exitCode = await new Promise((resolve) => proc.once("exit", resolve));
  assert.equal(exitCode, 0);
}

(async () => {
  runProtocolContractTests();
  runEditorUiProtocolTests();
  runMultiScopeEditorUiProtocolTests();
  await runEntrypointTest();
  console.log("TESTS OK: editor-process-protocol");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
