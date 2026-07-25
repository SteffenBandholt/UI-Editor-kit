namespace ReferenceTargetApp.EditorIntegration.Process;

public sealed class EditorProcessException : Exception
{
    public EditorProcessException(string code, string message, Exception? innerException = null)
        : base(message, innerException) => Code = code;

    public string Code { get; }
}
