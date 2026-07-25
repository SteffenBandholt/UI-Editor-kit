namespace ReferenceTargetApp.EditorIntegration.Protocol;

public static class EditorProtocol
{
    public const string Version = "1.0";
}

public static class EditorMessageTypes
{
    public const string Handshake = "handshake";
    public const string HandshakeAccepted = "handshakeAccepted";
    public const string Activate = "activate";
    public const string Activated = "activated";
    public const string Deactivate = "deactivate";
    public const string Deactivated = "deactivated";
    public const string StartSession = "startSession";
    public const string RequestRegistry = "requestRegistry";
    public const string Registry = "registry";
    public const string RequestLayoutState = "requestLayoutState";
    public const string LayoutState = "layoutState";
    public const string SessionStarted = "sessionStarted";
    public const string EndSession = "endSession";
    public const string SessionEnded = "sessionEnded";
    public const string Diagnostic = "diagnostic";
    public const string SubmitChangeRequest = "submitChangeRequest";
    public const string ChangeResult = "changeResult";
    public const string ChangeResultAccepted = "changeResultAccepted";
    public const string GetEditorUiState = "getEditorUiState";
    public const string EditorUiState = "editorUiState";
    public const string SelectEditorElement = "selectEditorElement";
    public const string SetEditorLayer = "setEditorLayer";
    public const string SetEditorMode = "setEditorMode";
    public const string SetEditorStep = "setEditorStep";
    public const string SelectEditorScope = "selectEditorScope";
    public const string RefreshEditorLayoutStates = "refreshEditorLayoutStates";
    public const string ActivateEditorDirection = "activateEditorDirection";
    public const string Shutdown = "shutdown";
    public const string ShutdownComplete = "shutdownComplete";
    public const string Error = "error";
    public const string Log = "log";
}
