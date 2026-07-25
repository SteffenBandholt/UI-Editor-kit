"use strict";
const readline = require("node:readline");
process.stderr.write("controlled stderr diagnostic\n");
const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
input.on("line", (line) => {
  const request = JSON.parse(line);
  process.stdout.write("not-json\n");
  process.stdout.write(`${JSON.stringify({
    protocolVersion: "1.0",
    messageId: "fixture-response",
    messageType: "handshakeAccepted",
    timestamp: new Date().toISOString(),
    replyTo: request.messageId,
    payload: {},
  })}\n`);
});
