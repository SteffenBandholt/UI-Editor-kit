"use strict";

const crypto = require("node:crypto");
const { ELECTRON_EDITOR_ERROR_CODES, ElectronEditorError } = require("./electron-error-codes.cjs");

const LOCAL_TARGET_PROTOCOL_NAME = "ui-editor-kit.local-target";
const LOCAL_TARGET_PROTOCOL_VERSION = "2.0";
const LOCAL_TARGET_MAX_MESSAGE_BYTES = 1024 * 1024;
const LOCAL_TARGET_MESSAGE_TYPES = Object.freeze([
  "handshake", "handshakeAccepted", "request", "response", "event", "heartbeat", "heartbeatAck", "disconnect", "error",
]);

function newMessageId() {
  return crypto.randomUUID();
}

function createEnvelope({ messageType, sessionNonce, payload = {}, messageId = newMessageId(), replyTo = null }) {
  return {
    protocolName: LOCAL_TARGET_PROTOCOL_NAME,
    protocolVersion: LOCAL_TARGET_PROTOCOL_VERSION,
    messageId,
    messageType,
    sessionNonce,
    ...(replyTo ? { replyTo } : {}),
    payload,
  };
}

function validateEnvelope(envelope, expectedNonce) {
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) return { ok: false, code: ELECTRON_EDITOR_ERROR_CODES.MESSAGE_INVALID };
  if (envelope.protocolName !== LOCAL_TARGET_PROTOCOL_NAME || envelope.protocolVersion !== LOCAL_TARGET_PROTOCOL_VERSION) {
    return { ok: false, code: ELECTRON_EDITOR_ERROR_CODES.PROTOCOL_UNSUPPORTED };
  }
  if (typeof envelope.messageId !== "string" || envelope.messageId.length < 8 || !LOCAL_TARGET_MESSAGE_TYPES.includes(envelope.messageType)) {
    return { ok: false, code: ELECTRON_EDITOR_ERROR_CODES.MESSAGE_INVALID };
  }
  if (typeof envelope.sessionNonce !== "string" || envelope.sessionNonce.length < 32 || (expectedNonce && envelope.sessionNonce !== expectedNonce)) {
    return { ok: false, code: ELECTRON_EDITOR_ERROR_CODES.SESSION_INVALID };
  }
  if (!envelope.payload || typeof envelope.payload !== "object" || Array.isArray(envelope.payload)) {
    return { ok: false, code: ELECTRON_EDITOR_ERROR_CODES.MESSAGE_INVALID };
  }
  if (envelope.replyTo !== undefined && envelope.replyTo !== null && (typeof envelope.replyTo !== "string" || envelope.replyTo.length < 8)) {
    return { ok: false, code: ELECTRON_EDITOR_ERROR_CODES.MESSAGE_INVALID };
  }
  return { ok: true };
}

function encodeFrame(envelope) {
  const payload = Buffer.from(JSON.stringify(envelope), "utf8");
  if (payload.length > LOCAL_TARGET_MAX_MESSAGE_BYTES) {
    throw new ElectronEditorError(ELECTRON_EDITOR_ERROR_CODES.MESSAGE_TOO_LARGE, "Lokale Editornachricht ist zu gross.");
  }
  const header = Buffer.allocUnsafe(4);
  header.writeUInt32LE(payload.length, 0);
  return Buffer.concat([header, payload]);
}

function createFrameDecoder(onEnvelope, onError) {
  let buffer = Buffer.alloc(0);
  return (chunk) => {
    try {
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length >= 4) {
        const length = buffer.readUInt32LE(0);
        if (length === 0 || length > LOCAL_TARGET_MAX_MESSAGE_BYTES) {
          buffer = Buffer.alloc(0);
          throw new ElectronEditorError(ELECTRON_EDITOR_ERROR_CODES.MESSAGE_TOO_LARGE, "Ungueltige lokale Nachrichtengroesse.");
        }
        if (buffer.length < length + 4) return;
        const body = buffer.subarray(4, length + 4);
        buffer = buffer.subarray(length + 4);
        let envelope;
        try { envelope = JSON.parse(body.toString("utf8")); }
        catch { throw new ElectronEditorError(ELECTRON_EDITOR_ERROR_CODES.MESSAGE_INVALID, "Lokale Editornachricht ist kein gueltiges JSON."); }
        onEnvelope(envelope);
      }
    } catch (error) {
      onError(error);
    }
  };
}

function createSessionIdentifiers() {
  return Object.freeze({
    pipeName: `ui-editor-kit-m80-${process.pid}-${crypto.randomBytes(16).toString("hex")}`,
    sessionId: crypto.randomUUID(),
    sessionNonce: crypto.randomBytes(32).toString("base64url"),
  });
}

module.exports = Object.freeze({
  LOCAL_TARGET_PROTOCOL_NAME,
  LOCAL_TARGET_PROTOCOL_VERSION,
  LOCAL_TARGET_MAX_MESSAGE_BYTES,
  LOCAL_TARGET_MESSAGE_TYPES,
  createEnvelope,
  validateEnvelope,
  encodeFrame,
  createFrameDecoder,
  createSessionIdentifiers,
});
