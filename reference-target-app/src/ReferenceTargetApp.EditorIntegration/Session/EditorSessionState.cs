namespace ReferenceTargetApp.EditorIntegration.Session;

public enum EditorSessionState
{
    Inactive,
    Activating,
    Active,
    StartingSession,
    SessionActive,
    EndingSession,
    Deactivating,
    Faulted
}

public sealed record EditorSessionResult(
    bool Success,
    string Code,
    string Message,
    EditorSessionState State,
    string? SessionId = null)
{
    public static EditorSessionResult Ok(string code, string message, EditorSessionState state, string? sessionId = null) =>
        new(true, code, message, state, sessionId);

    public static EditorSessionResult Fail(string code, string message, EditorSessionState state, string? sessionId = null) =>
        new(false, code, message, state, sessionId);
}
