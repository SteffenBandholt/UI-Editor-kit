#!/usr/bin/env node
"use strict";

const readline = require("node:readline");
const packageJson = require("../../package.json");
const { PROTOCOL_VERSION, MESSAGE_TYPES, createEditorProcessProtocol } = require("./editor-process-protocol.cjs");

let fallbackNumber = 1;
function fallbackError(code, message) {
  return {
    protocolVersion: PROTOCOL_VERSION,
    messageId: `node-invalid-${fallbackNumber++}`,
    messageType: MESSAGE_TYPES.ERROR,
    timestamp: new Date().toISOString(),
    payload: { code, message },
  };
}

function write(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

const protocol = createEditorProcessProtocol({ productVersion: packageJson.version });
const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity, terminal: false });

input.on("line", (line) => {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    write(fallbackError("invalid_json", "Eingabezeile enthaelt kein gueltiges JSON."));
    return;
  }

  const outcome = protocol.handle(message);
  outcome.messages.forEach(write);
  if (outcome.shouldExit) {
    input.close();
    process.stdin.destroy();
    process.stdout.end();
  }
});

input.on("close", () => {
  process.exitCode = 0;
});

process.on("uncaughtException", (error) => {
  process.stderr.write(`editor-process fatal: ${error.message}\n`);
  process.exitCode = 1;
});
