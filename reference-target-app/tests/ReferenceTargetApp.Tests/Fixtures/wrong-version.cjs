"use strict";
const readline = require("node:readline");
const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
input.on("line", (line) => {
  const request = JSON.parse(line);
  process.stdout.write(`${JSON.stringify({
    protocolVersion: "9.9",
    messageId: "wrong-version-response",
    messageType: "handshakeAccepted",
    timestamp: new Date().toISOString(),
    replyTo: request.messageId,
    payload: {},
  })}\n`);
});
