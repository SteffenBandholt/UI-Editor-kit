"use strict";

const { createUiElementRegistry } = require("../core/ui-element-registry.cjs");
const { createEditorCore } = require("../core/editor-core.cjs");
const { validateChangeRequest } = require("../core/change-request-validator.cjs");
const { validateLayoutState } = require("../core/layout-state-contract.cjs");
const { createSessionState } = require("../runtime/session-state.cjs");
const { createEditorUiSession } = require("./editor-ui-session.cjs");

const PROTOCOL_VERSION = "1.0";
const MESSAGE_TYPES = Object.freeze({
  HANDSHAKE: "handshake",
  HANDSHAKE_ACCEPTED: "handshakeAccepted",
  ACTIVATE: "activate",
  ACTIVATED: "activated",
  DEACTIVATE: "deactivate",
  DEACTIVATED: "deactivated",
  START_SESSION: "startSession",
  REQUEST_REGISTRY: "requestRegistry",
  REGISTRY: "registry",
  REQUEST_LAYOUT_STATE: "requestLayoutState",
  LAYOUT_STATE: "layoutState",
  SESSION_STARTED: "sessionStarted",
  END_SESSION: "endSession",
  SESSION_ENDED: "sessionEnded",
  DIAGNOSTIC: "diagnostic",
  SUBMIT_CHANGE_REQUEST: "submitChangeRequest",
  CHANGE_RESULT: "changeResult",
  CHANGE_RESULT_ACCEPTED: "changeResultAccepted",
  GET_EDITOR_UI_STATE: "getEditorUiState",
  EDITOR_UI_STATE: "editorUiState",
  SELECT_EDITOR_ELEMENT: "selectEditorElement",
  SET_EDITOR_LAYER: "setEditorLayer",
  SET_EDITOR_MODE: "setEditorMode",
  SET_EDITOR_STEP: "setEditorStep",
  SELECT_EDITOR_SCOPE: "selectEditorScope",
  REFRESH_EDITOR_LAYOUT_STATES: "refreshEditorLayoutStates",
  ACTIVATE_EDITOR_DIRECTION: "activateEditorDirection",
  SHUTDOWN: "shutdown",
  SHUTDOWN_COMPLETE: "shutdownComplete",
  ERROR: "error",
  LOG: "log",
});

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function createEditorProcessProtocol(options) {
  const cfg = options || {};
  const now = typeof cfg.now === "function" ? cfg.now : () => new Date().toISOString();
  const productVersion = typeof cfg.productVersion === "string" ? cfg.productVersion : "unknown";
  let nextMessageNumber = 1;
  let activated = false;
  let pendingSessionId = null;
  let activeSessionId = null;
  let editorCore = null;
  let registry = null;
  let sessionState = null;
  let editorUiSession = null;
  let pendingChange = null;
  let registryElementsByScope = new Map();
  let scopeSessions = new Map();
  let activeScopeId = null;

  function response(messageType, payload, request, sessionId) {
    return {
      protocolVersion: PROTOCOL_VERSION,
      messageId: `node-${nextMessageNumber++}`,
      messageType,
      timestamp: now(),
      ...(sessionId ? { sessionId } : {}),
      ...(request && request.messageId ? { replyTo: request.messageId } : {}),
      payload: payload || {},
    };
  }

  function error(request, code, message, details) {
    return response(MESSAGE_TYPES.ERROR, { code, message, ...(details || {}) }, request, request && request.sessionId);
  }

  function validateEnvelope(message) {
    if (!isObject(message)) return { code: "invalid_message", message: "Nachricht muss ein Objekt sein." };
    if (message.protocolVersion !== PROTOCOL_VERSION) {
      return { code: "incompatible_protocol_version", message: `Protokollversion ${String(message.protocolVersion)} wird nicht unterstuetzt.` };
    }
    for (const field of ["messageId", "messageType", "timestamp"]) {
      if (typeof message[field] !== "string" || message[field].trim() === "") {
        return { code: "invalid_message", message: `Pflichtfeld fehlt oder ist ungueltig: ${field}.` };
      }
    }
    if (!isObject(message.payload)) return { code: "invalid_message", message: "payload muss ein Objekt sein." };
    return null;
  }

  function requireActivated(request) {
    return activated ? null : error(request, "not_activated", "Editor-Prozess ist nicht aktiviert.");
  }

  function requireSession(request) {
    if (!activeSessionId) return error(request, "session_not_active", "Keine Editor-Session ist aktiv.");
    if (request.sessionId !== activeSessionId) return error(request, "wrong_session", "Nachricht gehoert nicht zur aktiven Session.");
    return null;
  }

  function buildCore(elements) {
    const builtRegistry = createUiElementRegistry();
    elements.forEach((element) => builtRegistry.registerElement(element));
    return { registry: builtRegistry, editorCore: createEditorCore(builtRegistry) };
  }

  function layoutEntries(layoutState) {
    return Object.entries(layoutState.elements || {}).map(([elementId, values]) => ({ elementId, ...values }));
  }

  function resetSession() {
    pendingSessionId = null;
    activeSessionId = null;
    editorCore = null;
    registry = null;
    sessionState = null;
    if (editorUiSession) editorUiSession.destroy();
    editorUiSession = null;
    pendingChange = null;
    registryElementsByScope = new Map();
    scopeSessions.forEach((entry) => entry.editorUiSession.destroy());
    scopeSessions = new Map();
    activeScopeId = null;
  }

  function activateScope(scopeId) {
    const entry = scopeSessions.get(scopeId);
    if (!entry) return false;
    activeScopeId = scopeId;
    editorCore = entry.editorCore;
    registry = entry.registry;
    sessionState = entry.sessionState;
    editorUiSession = entry.editorUiSession;
    return true;
  }

  function createScopeSession(scopeId, layoutState) {
    const validation = validateLayoutState(layoutState);
    if (!validation.ok) return { validation };
    const elements = registryElementsByScope.get(scopeId) || [];
    const built = buildCore(elements);
    const scopedSessionState = createSessionState();
    scopedSessionState.begin(layoutEntries(layoutState));
    return {
      entry: {
        editorCore: built.editorCore,
        registry: built.registry,
        sessionState: scopedSessionState,
        editorUiSession: createEditorUiSession({ editorCore: built.editorCore, registry: built.registry, sessionState: scopedSessionState, scopeId }),
      },
    };
  }

  function handle(message) {
    const envelopeError = validateEnvelope(message);
    if (envelopeError) return { messages: [error(message, envelopeError.code, envelopeError.message)], shouldExit: false };

    switch (message.messageType) {
      case MESSAGE_TYPES.HANDSHAKE:
        return { messages: [response(MESSAGE_TYPES.HANDSHAKE_ACCEPTED, { productVersion, protocolVersion: PROTOCOL_VERSION }, message)], shouldExit: false };

      case MESSAGE_TYPES.ACTIVATE: {
        const alreadyActive = activated;
        activated = true;
        return { messages: [response(MESSAGE_TYPES.ACTIVATED, { alreadyActive }, message)], shouldExit: false };
      }

      case MESSAGE_TYPES.START_SESSION: {
        const blocked = requireActivated(message);
        if (blocked) return { messages: [blocked], shouldExit: false };
        if (activeSessionId || pendingSessionId) {
          return { messages: [error(message, "session_already_active", "Es kann nur eine Editor-Session gleichzeitig bestehen.")], shouldExit: false };
        }
        if (typeof message.sessionId !== "string" || message.sessionId.trim() === "") {
          return { messages: [error(message, "invalid_session", "startSession benoetigt eine sessionId.")], shouldExit: false };
        }
        pendingSessionId = message.sessionId;
        return { messages: [response(MESSAGE_TYPES.REQUEST_REGISTRY, {}, message, pendingSessionId)], shouldExit: false };
      }

      case MESSAGE_TYPES.REGISTRY: {
        if (!pendingSessionId || message.sessionId !== pendingSessionId) {
          return { messages: [error(message, "wrong_session", "Registry gehoert nicht zur angeforderten Session.")], shouldExit: false };
        }
        try {
          if (!Array.isArray(message.payload.elements)) throw new TypeError("registry.elements muss ein Array sein.");
          registryElementsByScope = new Map();
          message.payload.elements.forEach((element) => {
            const scopeId = typeof element.layoutArea === "string" && element.layoutArea ? element.layoutArea : "__single__";
            if (!registryElementsByScope.has(scopeId)) registryElementsByScope.set(scopeId, []);
            registryElementsByScope.get(scopeId).push(element);
          });
          const built = buildCore(registryElementsByScope.values().next().value || message.payload.elements);
          registry = built.registry;
          editorCore = built.editorCore;
          return { messages: [response(MESSAGE_TYPES.REQUEST_LAYOUT_STATE, { elementCount: editorCore.size() }, message, pendingSessionId)], shouldExit: false };
        } catch (exception) {
          editorCore = null;
          return { messages: [error(message, "invalid_registry", exception.message, exception.validationResult || {})], shouldExit: false };
        }
      }

      case MESSAGE_TYPES.LAYOUT_STATE: {
        if (!pendingSessionId || message.sessionId !== pendingSessionId || !editorCore) {
          return { messages: [error(message, "wrong_session", "LayoutState gehoert nicht zu einer vorbereiteten Session.")], shouldExit: false };
        }
        const scopeStates = Array.isArray(message.payload.scopeStates) ? message.payload.scopeStates : null;
        if (scopeStates && scopeStates.length > 0) {
          scopeSessions.forEach((entry) => entry.editorUiSession.destroy());
          scopeSessions = new Map();
          for (const scoped of scopeStates) {
            if (!isObject(scoped) || typeof scoped.scopeId !== "string" || !isObject(scoped.layoutState)) {
              return { messages: [error(message, "invalid_layout_state", "scopeStates ist ungueltig.")], shouldExit: false };
            }
            const created = createScopeSession(scoped.scopeId, scoped.layoutState);
            if (created.validation) return { messages: [error(message, "invalid_layout_state", "LayoutState ist ungueltig.", { errors: created.validation.errors })], shouldExit: false };
            scopeSessions.set(scoped.scopeId, created.entry);
          }
          const requestedScope = typeof message.payload.activeScopeId === "string" ? message.payload.activeScopeId : scopeStates[0].scopeId;
          if (!activateScope(requestedScope)) return { messages: [error(message, "unknown_scope", "Aktiver Scope ist nicht vorhanden.")], shouldExit: false };
          activeSessionId = pendingSessionId;
          pendingSessionId = null;
          return { messages: [response(MESSAGE_TYPES.SESSION_STARTED, { status: sessionState.status(), elementCount: Array.from(scopeSessions.values()).reduce((sum, item) => sum + item.editorCore.size(), 0), scopes: Array.from(scopeSessions.keys()), activeScopeId }, message, activeSessionId)], shouldExit: false };
        }
        const layoutState = message.payload.layoutState;
        const validation = validateLayoutState(layoutState);
        if (!validation.ok) {
          return { messages: [error(message, "invalid_layout_state", "LayoutState ist ungueltig.", { errors: validation.errors })], shouldExit: false };
        }
        sessionState = createSessionState();
        const status = sessionState.begin(layoutEntries(layoutState));
        editorUiSession = createEditorUiSession({ editorCore, registry, sessionState, scopeId: layoutState.uiScope });
        scopeSessions.set(layoutState.uiScope, { editorCore, registry, sessionState, editorUiSession });
        activeScopeId = layoutState.uiScope;
        activeSessionId = pendingSessionId;
        pendingSessionId = null;
        return { messages: [response(MESSAGE_TYPES.SESSION_STARTED, { status, elementCount: editorCore.size() }, message, activeSessionId)], shouldExit: false };
      }

      case MESSAGE_TYPES.DIAGNOSTIC: {
        const blocked = requireSession(message);
        if (blocked) return { messages: [blocked], shouldExit: false };
        if (pendingChange) return { messages: [error(message, "change_in_progress", "Ein Aenderungsauftrag wird bereits verarbeitet.")], shouldExit: false };
        const changeRequest = message.payload.changeRequest;
        const validation = validateChangeRequest(changeRequest, editorCore);
        if (!validation.ok) {
          return { messages: [error(message, "invalid_change_request", "Aenderungsauftrag ist ungueltig.", { errors: validation.errors })], shouldExit: false };
        }
        pendingChange = { changeId: changeRequest.changeId };
        return { messages: [response(MESSAGE_TYPES.SUBMIT_CHANGE_REQUEST, { changeRequest }, message, activeSessionId)], shouldExit: false };
      }

      case MESSAGE_TYPES.GET_EDITOR_UI_STATE: {
        const blocked = requireSession(message);
        if (blocked) return { messages: [blocked], shouldExit: false };
        if (!editorUiSession) return { messages: [error(message, "editor_ui_unavailable", "Editor-UI ist nicht initialisiert.")], shouldExit: false };
        return { messages: [response(MESSAGE_TYPES.EDITOR_UI_STATE, { editorUiState: editorUiSession.snapshot() }, message, activeSessionId)], shouldExit: false };
      }

      case MESSAGE_TYPES.SELECT_EDITOR_ELEMENT:
      case MESSAGE_TYPES.SET_EDITOR_LAYER:
      case MESSAGE_TYPES.SET_EDITOR_MODE:
      case MESSAGE_TYPES.SET_EDITOR_STEP: {
        const blocked = requireSession(message);
        if (blocked) return { messages: [blocked], shouldExit: false };
        if (!editorUiSession) return { messages: [error(message, "editor_ui_unavailable", "Editor-UI ist nicht initialisiert.")], shouldExit: false };
        let state;
        if (message.messageType === MESSAGE_TYPES.SELECT_EDITOR_ELEMENT) state = editorUiSession.selectElement(message.payload.elementId);
        else if (message.messageType === MESSAGE_TYPES.SET_EDITOR_LAYER) state = editorUiSession.setLayer(message.payload.layer);
        else if (message.messageType === MESSAGE_TYPES.SET_EDITOR_MODE) state = editorUiSession.setMode(message.payload.mode);
        else state = editorUiSession.setStepSize(message.payload.stepSize);
        return { messages: [response(MESSAGE_TYPES.EDITOR_UI_STATE, { editorUiState: state }, message, activeSessionId)], shouldExit: false };
      }

      case MESSAGE_TYPES.SELECT_EDITOR_SCOPE: {
        const blocked = requireSession(message);
        if (blocked) return { messages: [blocked], shouldExit: false };
        if (pendingChange) return { messages: [error(message, "change_in_progress", "Scope kann waehrend einer Aenderung nicht gewechselt werden.")], shouldExit: false };
        if (!activateScope(message.payload.scopeId)) return { messages: [error(message, "unknown_scope", "Scope ist nicht registriert.")], shouldExit: false };
        return { messages: [response(MESSAGE_TYPES.EDITOR_UI_STATE, { editorUiState: editorUiSession.snapshot() }, message, activeSessionId)], shouldExit: false };
      }

      case MESSAGE_TYPES.REFRESH_EDITOR_LAYOUT_STATES: {
        const blocked = requireSession(message);
        if (blocked) return { messages: [blocked], shouldExit: false };
        if (pendingChange) return { messages: [error(message, "change_in_progress", "Layout kann waehrend einer Aenderung nicht aktualisiert werden.")], shouldExit: false };
        if (!Array.isArray(message.payload.scopeStates)) return { messages: [error(message, "invalid_layout_state", "scopeStates fehlt.")], shouldExit: false };
        const previousScope = activeScopeId;
        for (const scoped of message.payload.scopeStates) {
          const previous = scopeSessions.get(scoped.scopeId);
          const created = createScopeSession(scoped.scopeId, scoped.layoutState);
          if (created.validation) return { messages: [error(message, "invalid_layout_state", "LayoutState ist ungueltig.", { errors: created.validation.errors })], shouldExit: false };
          if (previous) previous.editorUiSession.destroy();
          scopeSessions.set(scoped.scopeId, created.entry);
        }
        if (!activateScope(previousScope) && !activateScope(message.payload.scopeStates[0] && message.payload.scopeStates[0].scopeId))
          return { messages: [error(message, "unknown_scope", "Aktiver Scope fehlt.")], shouldExit: false };
        return { messages: [response(MESSAGE_TYPES.EDITOR_UI_STATE, { editorUiState: editorUiSession.snapshot() }, message, activeSessionId)], shouldExit: false };
      }

      case MESSAGE_TYPES.ACTIVATE_EDITOR_DIRECTION: {
        const blocked = requireSession(message);
        if (blocked) return { messages: [blocked], shouldExit: false };
        if (pendingChange) return { messages: [error(message, "change_in_progress", "Ein Aenderungsauftrag wird bereits verarbeitet.")], shouldExit: false };
        if (!editorUiSession) return { messages: [error(message, "editor_ui_unavailable", "Editor-UI ist nicht initialisiert.")], shouldExit: false };
        const prepared = editorUiSession.prepareDirection(message.payload.direction);
        if (!prepared.ok) return { messages: [error(message, prepared.code || "invalid_editor_intent", prepared.reason || "Editoraktion ist ungueltig.")], shouldExit: false };
        const validation = validateChangeRequest(prepared.changeRequest, editorCore);
        if (!validation.ok) return { messages: [error(message, "invalid_change_request", "Aenderungsauftrag ist ungueltig.", { errors: validation.errors })], shouldExit: false };
        pendingChange = { changeId: prepared.changeRequest.changeId };
        return { messages: [response(MESSAGE_TYPES.SUBMIT_CHANGE_REQUEST, { changeRequest: prepared.changeRequest }, message, activeSessionId)], shouldExit: false };
      }

      case MESSAGE_TYPES.CHANGE_RESULT: {
        const blocked = requireSession(message);
        if (blocked) return { messages: [blocked], shouldExit: false };
        const result = message.payload.changeResult;
        if (!pendingChange || !isObject(result) || result.changeId !== pendingChange.changeId) {
          return { messages: [error(message, "unexpected_change_result", "ChangeResult passt zu keinem offenen Auftrag.")], shouldExit: false };
        }
        if (result.success === true && isObject(result.newState) && sessionState) {
          const state = result.newState;
          sessionState.setEntry({
            elementId: state.elementId,
            element: { x: state.x, y: state.y, width: state.width, height: state.height },
            ...(state.fontSize === null && state.textOffsetX === null && state.textOffsetY === null ? {} : {
              text: {
                ...(state.textOffsetX === null ? {} : { offsetX: state.textOffsetX }),
                ...(state.textOffsetY === null ? {} : { offsetY: state.textOffsetY }),
                ...(state.fontSize === null ? {} : { fontSize: state.fontSize }),
              },
            }),
          });
        }
        if (editorUiSession) editorUiSession.acceptChangeResult(result);
        pendingChange = null;
        return { messages: [response(MESSAGE_TYPES.CHANGE_RESULT_ACCEPTED, { accepted: true, status: sessionState && sessionState.status() }, message, activeSessionId)], shouldExit: false };
      }

      case MESSAGE_TYPES.END_SESSION: {
        const blocked = requireSession(message);
        if (blocked) return { messages: [blocked], shouldExit: false };
        if (pendingChange) return { messages: [error(message, "change_in_progress", "Session kann waehrend eines laufenden Auftrags nicht beendet werden.")], shouldExit: false };
        const endedSessionId = activeSessionId;
        const status = sessionState.end();
        resetSession();
        return { messages: [response(MESSAGE_TYPES.SESSION_ENDED, { status }, message, endedSessionId)], shouldExit: false };
      }

      case MESSAGE_TYPES.DEACTIVATE: {
        if (activeSessionId || pendingSessionId) {
          return { messages: [error(message, "session_active", "Aktive oder vorbereitete Session muss zuerst beendet werden.")], shouldExit: false };
        }
        const alreadyInactive = !activated;
        activated = false;
        return { messages: [response(MESSAGE_TYPES.DEACTIVATED, { alreadyInactive }, message)], shouldExit: false };
      }

      case MESSAGE_TYPES.SHUTDOWN:
        resetSession();
        activated = false;
        return { messages: [response(MESSAGE_TYPES.SHUTDOWN_COMPLETE, { stopped: true }, message)], shouldExit: true };

      default:
        return { messages: [error(message, "unknown_message_type", `Nachrichtentyp ist unbekannt: ${message.messageType}.`)], shouldExit: false };
    }
  }

  return { handle, getState: () => ({ activated, pendingSessionId, activeSessionId, pendingChange: pendingChange && { ...pendingChange } }) };
}

module.exports = { PROTOCOL_VERSION, MESSAGE_TYPES, createEditorProcessProtocol };
