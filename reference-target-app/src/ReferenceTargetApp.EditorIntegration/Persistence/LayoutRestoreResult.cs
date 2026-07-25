namespace ReferenceTargetApp.EditorIntegration.Persistence;

public sealed record LayoutApplyFailure(
    string ElementId,
    string Operation,
    string Code,
    string Message);

public sealed record LayoutRestoreResult(
    bool Success,
    string Code,
    string Message,
    int AppliedChangeCount,
    bool RollbackSucceeded,
    IReadOnlyList<LayoutApplyFailure> Failures)
{
    public static LayoutRestoreResult NotApplied(string code, string message) =>
        new(false, code, message, 0, true, []);
}
