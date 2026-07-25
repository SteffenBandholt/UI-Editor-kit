namespace ReferenceTargetApp.EditorIntegration.HostAdapter;

public static class HostAdapterErrorCodes
{
    public const string InvalidChangeRequest = "invalid_change_request";
    public const string UnknownElement = "unknown_element";
    public const string WrongScope = "wrong_scope";
    public const string OperationNotAllowed = "operation_not_allowed";
    public const string InvalidPayload = "invalid_payload";
    public const string ForbiddenField = "forbidden_field";
    public const string ElementReferenceMissing = "element_ref_missing";
    public const string UiThreadUnavailable = "ui_thread_unavailable";
    public const string TargetRejectedChange = "target_rejected_change";
    public const string RollbackFailed = "rollback_failed";
}
