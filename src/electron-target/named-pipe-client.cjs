"use strict";

const net = require("node:net");
const EventEmitter = require("node:events");
const {
  createEnvelope,
  validateEnvelope,
  encodeFrame,
  createFrameDecoder,
} = require("./local-target-protocol.cjs");
const { ELECTRON_EDITOR_ERROR_CODES, ElectronEditorError } = require("./electron-error-codes.cjs");

function windowsPipePath(pipeName) {
  if (typeof pipeName !== "string" || !/^ui-editor-kit-m80-[a-zA-Z0-9-]+$/.test(pipeName)) {
    throw new ElectronEditorError(ELECTRON_EDITOR_ERROR_CODES.MESSAGE_INVALID, "Pipe-Name ist ungueltig.");
  }
  return `\\\\.\\pipe\\${pipeName}`;
}

class NamedPipeTargetClient extends EventEmitter {
  constructor({ pipeName, sessionNonce, timeoutMs = 10000 }) {
    super();
    this.pipePath = windowsPipePath(pipeName);
    this.sessionNonce = sessionNonce;
    this.timeoutMs = timeoutMs;
    this.socket = null;
    this.pending = new Map();
    this.seenMessageIds = new Set();
    this.connected = false;
    this.handshaken = false;
  }

  async connect(handshakePayload) {
    if (this.socket) throw new ElectronEditorError(ELECTRON_EDITOR_ERROR_CODES.EDITOR_ALREADY_RUNNING, "Editorsitzung ist bereits verbunden.");
    const socket = net.createConnection(this.pipePath);
    this.socket = socket;
    socket.on("data", createFrameDecoder((message) => this.#receive(message), (error) => this.#fail(error)));
    socket.on("error", (error) => this.#fail(this.#mapSocketError(error)));
    socket.on("close", () => this.#disconnect("editor_disconnected"));
    await this.#waitForConnect(socket);
    this.connected = true;
    const response = await this.request("handshake", handshakePayload, "handshakeAccepted");
    this.handshaken = true;
    return response;
  }

  request(action, payload = {}, expectedAction = null) {
    if (!this.socket || !this.connected) return Promise.reject(new ElectronEditorError(ELECTRON_EDITOR_ERROR_CODES.HANDSHAKE_FAILED, "Keine lokale Editorverbindung."));
    const message = createEnvelope({ messageType: action === "handshake" ? "handshake" : "request", sessionNonce: this.sessionNonce, payload: { action, ...payload } });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(message.messageId);
        reject(new ElectronEditorError(ELECTRON_EDITOR_ERROR_CODES.PIPE_TIMEOUT, `Zeitueberschreitung bei ${action}.`));
      }, this.timeoutMs);
      this.pending.set(message.messageId, { resolve, reject, timer, expectedAction });
      this.socket.write(encodeFrame(message));
    });
  }

  sendEvent(action, payload = {}) {
    if (!this.socket || !this.connected || !this.handshaken) return false;
    this.socket.write(encodeFrame(createEnvelope({ messageType: "event", sessionNonce: this.sessionNonce, payload: { action, ...payload } })));
    return true;
  }

  respond(requestMessage, payload = {}, error = null) {
    if (!this.socket || !this.connected || !requestMessage || typeof requestMessage.messageId !== "string") return false;
    const responsePayload = error
      ? { code: error.code || ELECTRON_EDITOR_ERROR_CODES.MESSAGE_INVALID, message: error.message || "Ziel-App-Anfrage wurde abgewiesen." }
      : payload;
    this.socket.write(encodeFrame(createEnvelope({
      messageType: error ? "error" : "response",
      sessionNonce: this.sessionNonce,
      replyTo: requestMessage.messageId,
      payload: responsePayload,
    })));
    return true;
  }

  async close(reason = "target_shutdown") {
    if (!this.socket) return;
    try {
      if (this.connected) this.socket.write(encodeFrame(createEnvelope({ messageType: "disconnect", sessionNonce: this.sessionNonce, payload: { reason } })));
    } finally {
      this.socket.end();
      this.#disconnect(reason);
    }
  }

  #waitForConnect(socket) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new ElectronEditorError(ELECTRON_EDITOR_ERROR_CODES.PIPE_TIMEOUT, "Editor-Pipe ist nicht erreichbar.")), this.timeoutMs);
      socket.once("connect", () => { clearTimeout(timer); resolve(); });
      socket.once("error", (error) => { clearTimeout(timer); reject(this.#mapSocketError(error)); });
    });
  }

  #receive(message) {
    const validation = validateEnvelope(message, this.sessionNonce);
    if (!validation.ok) return this.#fail(new ElectronEditorError(validation.code, "Lokale Editornachricht wurde abgewiesen."));
    if (this.seenMessageIds.has(message.messageId)) return;
    this.seenMessageIds.add(message.messageId);
    if (this.seenMessageIds.size > 2048) this.seenMessageIds.delete(this.seenMessageIds.values().next().value);
    if (message.replyTo && this.pending.has(message.replyTo)) {
      const pending = this.pending.get(message.replyTo);
      this.pending.delete(message.replyTo);
      clearTimeout(pending.timer);
      if (message.messageType === "error") pending.reject(new ElectronEditorError(message.payload.code || ELECTRON_EDITOR_ERROR_CODES.MESSAGE_INVALID, message.payload.message || "Editorfehler."));
      else if (pending.expectedAction && message.payload.action !== pending.expectedAction) pending.reject(new ElectronEditorError(ELECTRON_EDITOR_ERROR_CODES.MESSAGE_INVALID, "Unerwartete Editorantwort."));
      else pending.resolve(message.payload);
      return;
    }
    if (message.messageType === "heartbeat") {
      this.socket?.write(encodeFrame(createEnvelope({ messageType: "heartbeatAck", sessionNonce: this.sessionNonce, replyTo: message.messageId, payload: { action: "heartbeatAck" } })));
      return;
    }
    this.emit("message", message);
  }

  #mapSocketError(error) {
    const code = error?.code === "EACCES" ? ELECTRON_EDITOR_ERROR_CODES.PIPE_ACCESS_DENIED : ELECTRON_EDITOR_ERROR_CODES.HANDSHAKE_FAILED;
    return error instanceof ElectronEditorError ? error : new ElectronEditorError(code, "Lokale Editorverbindung ist fehlgeschlagen.");
  }

  #fail(error) {
    this.emit("connectionError", error);
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(error); }
    this.pending.clear();
  }

  #disconnect(reason) {
    if (!this.socket && !this.connected) return;
    this.connected = false;
    this.handshaken = false;
    this.socket = null;
    this.#fail(new ElectronEditorError(ELECTRON_EDITOR_ERROR_CODES.HANDSHAKE_FAILED, "Lokale Editorverbindung wurde beendet."));
    this.emit("disconnect", { reason });
  }
}

module.exports = Object.freeze({ NamedPipeTargetClient, windowsPipePath });
