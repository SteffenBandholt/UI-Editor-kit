using ReferenceTargetApp.EditorIntegration.HostAdapter;

namespace ReferenceTargetApp.EditorIntegration.Session;

public sealed record EditorProcessDiagnosticRun(
    bool Success,
    string Code,
    string Message,
    int? ProcessId,
    string? SessionId,
    EditorSessionResult Activation,
    EditorSessionResult? SessionStart,
    ChangeResult? ChangeResult,
    EditorSessionResult? SessionEnd,
    EditorSessionResult? Deactivation);
