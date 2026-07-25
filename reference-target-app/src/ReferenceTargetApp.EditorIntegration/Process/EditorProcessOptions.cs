using System.IO;

namespace ReferenceTargetApp.EditorIntegration.Process;

public sealed record EditorProcessTimeouts(
    TimeSpan ProcessStart,
    TimeSpan Handshake,
    TimeSpan Activation,
    TimeSpan SessionStart,
    TimeSpan SessionEnd,
    TimeSpan Deactivation,
    TimeSpan Shutdown)
{
    public static EditorProcessTimeouts Default { get; } = new(
        TimeSpan.FromSeconds(5),
        TimeSpan.FromSeconds(5),
        TimeSpan.FromSeconds(5),
        TimeSpan.FromSeconds(5),
        TimeSpan.FromSeconds(5),
        TimeSpan.FromSeconds(5),
        TimeSpan.FromSeconds(3));
}

public sealed record EditorProcessOptions(
    string NodeExecutable,
    string ScriptPath,
    string WorkingDirectory,
    EditorProcessTimeouts Timeouts)
{
    public static EditorProcessOptions FromRepositoryRoot(
        string repositoryRoot,
        string nodeExecutable = "node",
        EditorProcessTimeouts? timeouts = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(repositoryRoot);
        var root = Path.GetFullPath(repositoryRoot);
        return new EditorProcessOptions(
            nodeExecutable,
            Path.Combine(root, "src", "process", "editor-process-entry.cjs"),
            root,
            timeouts ?? EditorProcessTimeouts.Default);
    }
}
