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
    public const string ProfileIncompatible = "electron_profile_incompatible";
    public const string ProfileCorrupt = "electron_profile_corrupt";
    public const string ProfileMigrationAvailable = "electron_profile_migration_available";
    public const string ProfileMigrationFailed = "electron_profile_migration_failed";
    public const string ProfileArchiveFailed = "electron_profile_archive_failed";
    public const string ProfileBaselineStarted = "electron_profile_baseline_started";
    public const string UiProfileRestoreFailed = "electron_ui_profile_restore_failed";
    public const string PdfProfileRestoreFailed = "electron_pdf_profile_restore_failed";
    public const string ProfileUserCancelled = "electron_profile_user_cancelled";
    public const string PdfNotAvailable = "electron_pdf_not_available";
    public const string RegistryRefreshFailed = "registry_refresh_failed";
    public const string RegistryVersionMissing = "registry_version_missing";
    public const string RegistryFingerprintMissing = "registry_fingerprint_missing";
    public const string RegistryFingerprintMismatch = "registry_fingerprint_mismatch";
    public const string RegistryIncomplete = "registry_incomplete";
    public const string RegistryIncompatible = "registry_incompatible";
    public const string RegistryChanged = "registry_changed";
    public const string RegistryScopeIncomplete = "registry_scope_incomplete";
    public const string RegistryScopeBlocked = "registry_scope_blocked";
    public const string RegistryExpectedElementMissing = "registry_expected_element_missing";
    public const string RegistryReferenceMissing = "registry_reference_missing";
    public const string RegistryParentInvalid = "registry_parent_invalid";
    public const string RegistryRoleMissing = "registry_role_missing";
    public const string RegistryBaselineMissing = "registry_baseline_missing";
    public const string RegistryProfileConflict = "registry_profile_conflict";
    public const string RegistryProfileMigrationRequired = "registry_profile_migration_required";
    public const string RegistrationRequired = "registration_required";
    public const string RegistrationFailed = "registration_failed";
    public const string RegistrationNotConfirmed = "registration_not_confirmed";
}

public sealed class ElectronEditorException(string code, string message, Exception? innerException = null)
    : Exception(message, innerException)
{
    public string Code { get; } = code;
}
