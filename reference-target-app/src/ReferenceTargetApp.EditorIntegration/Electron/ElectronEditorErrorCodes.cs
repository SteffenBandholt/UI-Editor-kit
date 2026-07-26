namespace ReferenceTargetApp.EditorIntegration.Electron;

public static class ElectronEditorErrorCodes
{
    public const string EditorNotInstalled = "electron_editor_not_installed";
    public const string EditorStartFailed = "electron_editor_start_failed";
    public const string EditorAlreadyRunning = "electron_editor_already_running";
    public const string HandshakeFailed = "electron_editor_handshake_failed";
    public const string ProtocolUnsupported = "electron_editor_protocol_unsupported";
    public const string PipeAccessDenied = "electron_editor_pipe_access_denied";
    public const string PipeTimeout = "electron_editor_pipe_timeout";
    public const string MessageInvalid = "electron_editor_message_invalid";
    public const string MessageTooLarge = "electron_editor_message_too_large";
    public const string SessionInvalid = "electron_editor_session_invalid";
    public const string RegistryInvalid = "electron_registry_invalid";
    public const string ElementNotFound = "electron_element_not_found";
    public const string OperationNotAllowed = "electron_operation_not_allowed";
    public const string OperationLocked = "electron_operation_locked";
    public const string ChangeApplyFailed = "electron_change_apply_failed";
    public const string ChangeReadbackFailed = "electron_change_readback_failed";
    public const string ChangeRollbackFailed = "electron_change_rollback_failed";
    public const string SelectionFailed = "electron_selection_failed";
    public const string HighlightFailed = "electron_highlight_failed";
    public const string ProfileLoadFailed = "electron_profile_load_failed";
    public const string ProfileSaveFailed = "electron_profile_save_failed";
    public const string RestoreFailed = "electron_restore_failed";
    public const string PdfNotAvailable = "electron_pdf_not_available";
}

public sealed class ElectronEditorException(string code, string message, Exception? innerException = null)
    : Exception(message, innerException)
{
    public string Code { get; } = code;
}
