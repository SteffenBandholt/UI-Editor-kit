using ReferenceTargetApp.EditorIntegration.Geometry;

namespace ReferenceTargetApp.EditorIntegration.HostAdapter;

public sealed record ChangeResult(
    bool Success,
    string ChangeId,
    string ElementId,
    string Operation,
    string? ErrorCode,
    string Message,
    ElementLayoutState? PreviousState,
    ElementLayoutState? NewState,
    bool RollbackSucceeded,
    GeometryRiskAssessment? GeometryRisk = null,
    IReadOnlyList<ElementLayoutState>? AffectedStates = null)
{
    internal static ChangeResult Rejected(ChangeRequest? request, string errorCode, string message) => new(
        false,
        request?.ChangeId ?? string.Empty,
        request?.ElementId ?? string.Empty,
        request?.Operation ?? string.Empty,
        errorCode,
        message,
        null,
        null,
        true);
}
