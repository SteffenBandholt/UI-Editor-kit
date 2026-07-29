namespace ReferenceTargetApp.EditorIntegration.Registry;

public enum UiRegistryValidationErrorCode
{
    EmptyElementId,
    EmptyScopeId,
    EmptyDisplayName,
    DuplicateElementId,
    MissingNativeReference,
    InvalidElementKind,
    InvalidCapability,
    InvalidSpacingTarget,
    ScopeHasParent,
    ScopeIdMismatch,
    ParentRequired,
    UnknownParent,
    SelfParent,
    UnknownScope,
    ScopeMismatch,
    ParentCycle
}

public sealed record UiRegistryValidationError(
    UiRegistryValidationErrorCode Code,
    string? ElementId,
    string Message);
