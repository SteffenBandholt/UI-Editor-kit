using System.IO;

namespace ReferenceTargetApp.EditorIntegration.Process;

public static class EditorProcessPathResolver
{
    private static readonly string ScriptRelativePath = Path.Combine("src", "process", "editor-process-entry.cjs");

    public static EditorProcessOptions ResolveDefault()
    {
        foreach (var start in new[] { AppContext.BaseDirectory, Environment.CurrentDirectory })
        {
            var directory = new DirectoryInfo(Path.GetFullPath(start));
            for (var level = 0; directory is not null && level < 12; level++, directory = directory.Parent)
            {
                var script = Path.Combine(directory.FullName, ScriptRelativePath);
                var package = Path.Combine(directory.FullName, "package.json");
                if (File.Exists(script) && File.Exists(package))
                    return EditorProcessOptions.FromRepositoryRoot(directory.FullName);
            }
        }

        throw new EditorProcessException("script_not_found", "Lokaler Editor-Prozess-Einstiegspunkt wurde nicht gefunden.");
    }
}
