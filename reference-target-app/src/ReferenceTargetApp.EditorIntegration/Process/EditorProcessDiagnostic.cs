namespace ReferenceTargetApp.EditorIntegration.Process;

public sealed record EditorProcessDiagnostic(DateTimeOffset Timestamp, string Source, string Code, string Message);
