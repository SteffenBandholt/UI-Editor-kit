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
  await runEntrypointTest();
  console.log("TESTS OK: editor-process-protocol");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
