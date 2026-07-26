using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using UiEditorKit.Manager.Domain;

namespace UiEditorKit.Manager.Core;

public static partial class TargetContractValidator
{
    public const int SchemaVersion = 1;
    public const string ContractVersion = "1.0";
    public const string ManifestFileName = "ui-editor-target.json";
    private static readonly HashSet<string> ProjectTypes = new(StringComparer.Ordinal) { "wpf-net10" };
    private static readonly HashSet<string> IntegrationModes = new(StringComparer.Ordinal) { "prepared-native-editor" };

    public static IReadOnlyList<string> Validate(TargetAppManifest? manifest)
    {
        var errors = new List<string>();
        if (manifest is null) return ["Manifest fehlt."];
        if (manifest.SchemaVersion != SchemaVersion) errors.Add("schemaVersion wird nicht unterstützt.");
        if (!ApplicationIdPattern().IsMatch(manifest.ApplicationId ?? string.Empty)) errors.Add("applicationId ist ungültig.");
        if (string.IsNullOrWhiteSpace(manifest.DisplayName)) errors.Add("displayName fehlt.");
        if (!ProjectTypes.Contains(manifest.ProjectType)) errors.Add("projectType ist für M78 nicht freigegeben.");
        if (!IntegrationModes.Contains(manifest.IntegrationMode)) errors.Add("integrationMode verlangt M79 oder ist unbekannt.");
        if (manifest.SupportedEditorContractVersion != ContractVersion) errors.Add("Editorvertragsversion wird nicht unterstützt.");
        foreach (var path in Paths(manifest)) if (!ManagerPathRules.IsSafeRelativePath(path)) errors.Add("Unsicherer relativer Pfad: " + path);
        if (manifest.ExpectedFiles is null || !manifest.ExpectedFiles.Contains(".ui-editor-kit/installation.json", StringComparer.Ordinal))
            errors.Add("Eigener Installationsstatuspfad fehlt.");
        if (manifest.TargetStart is null || manifest.EditorStart is null ||
            manifest.TargetStart.Kind is not ("dotnetProject" or "executable") || manifest.EditorStart.Kind is not ("dotnetProject" or "executable"))
            errors.Add("Startart ist nicht erlaubt.");
        return errors;
    }

    private static IEnumerable<string?> Paths(TargetAppManifest manifest) =>
        [manifest.ProjectFile, manifest.IntegrationRoot, manifest.EditorIntegrationProject, manifest.HostExecutableProject,
            manifest.TargetStart?.Project, manifest.EditorStart?.Project, .. manifest.ExpectedFiles ?? []];

    [GeneratedRegex("^[a-z0-9][a-z0-9.-]{2,79}$", RegexOptions.CultureInvariant)]
    private static partial Regex ApplicationIdPattern();
}

public static class ManagerPathRules
{
    public static bool IsSafeRelativePath(string? value)
    {
        if (string.IsNullOrWhiteSpace(value) || Path.IsPathFullyQualified(value)) return false;
        var normalized = value.Replace('\\', '/');
        return normalized != "." && !normalized.StartsWith('/') &&
               !normalized.Split('/', StringSplitOptions.RemoveEmptyEntries).Contains("..", StringComparer.Ordinal) &&
               normalized.IndexOfAny(Path.GetInvalidPathChars()) < 0;
    }

    public static bool IsInside(string root, string candidate)
    {
        var normalizedRoot = Path.TrimEndingDirectorySeparator(Path.GetFullPath(root));
        var normalizedCandidate = Path.GetFullPath(candidate);
        var relative = Path.GetRelativePath(normalizedRoot, normalizedCandidate);
        return relative != ".." && !relative.StartsWith(".." + Path.DirectorySeparatorChar, StringComparison.Ordinal) && !Path.IsPathFullyQualified(relative);
    }

    public static string ResolveInside(string root, string relative)
    {
        if (!IsSafeRelativePath(relative)) throw new InvalidOperationException("Unsicherer relativer Pfad: " + relative);
        var result = Path.GetFullPath(Path.Combine(root, relative));
        if (!IsInside(root, result)) throw new InvalidOperationException("Pfad verlässt den erlaubten Root.");
        return result;
    }
}

public static class InstallationPlanner
{
    public static InstallationPlan Create(TargetAppManifest target, string root, IntegrationPackage package,
        IReadOnlyDictionary<string, string> currentHashes, InstallationState? installed, DateTimeOffset now)
    {
        var files = new List<PlanFile>();
        var blockers = new List<string>();
        foreach (var file in package.Files.OrderBy(file => file.RelativePath, StringComparer.Ordinal))
        {
            if (!ManagerPathRules.IsSafeRelativePath(file.RelativePath) || !target.ExpectedFiles.Contains(file.RelativePath, StringComparer.Ordinal))
            {
                blockers.Add("Paketpfad ist nicht durch das Zielmanifest erlaubt: " + file.RelativePath);
                continue;
            }
            currentHashes.TryGetValue(file.RelativePath, out var current);
            var ownership = installed?.Files.SingleOrDefault(item => item.RelativePath == file.RelativePath);
            var owned = ownership is not null && string.Equals(ownership.InstalledHash, current, StringComparison.OrdinalIgnoreCase);
            var action = current is null ? InstallationAction.Create : owned ?
                string.Equals(current, file.Sha256, StringComparison.OrdinalIgnoreCase) ? InstallationAction.Unchanged : InstallationAction.Update :
                InstallationAction.Conflict;
            var conflict = action == InstallationAction.Conflict ? "Vorhandene Datei ist nicht unverändert im Eigentum des Managers." : null;
            if (conflict is not null) blockers.Add(file.RelativePath + ": " + conflict);
            files.Add(new(file.RelativePath, action, current is not null, owned, current, file.Sha256, conflict, action == InstallationAction.Update));
        }
        foreach (var previous in installed?.Files.Where(previous => package.Files.All(file => file.RelativePath != previous.RelativePath)) ?? [])
        {
            if (!target.ExpectedFiles.Contains(previous.RelativePath, StringComparer.Ordinal)) continue;
            currentHashes.TryGetValue(previous.RelativePath, out var current);
            var owned = current is null || string.Equals(previous.InstalledHash, current, StringComparison.OrdinalIgnoreCase);
            var conflict = owned ? null : "Nicht mehr benötigte Managerdatei wurde lokal geändert.";
            if (conflict is not null) blockers.Add(previous.RelativePath + ": " + conflict);
            files.Add(new(previous.RelativePath, current is null ? InstallationAction.Unchanged : owned ? InstallationAction.Remove : InstallationAction.Conflict,
                current is not null, true, current, null, conflict, current is not null));
        }
        var previewId = PreviewId(target.ApplicationId, root, package.PackageVersion, files);
        return new(target.ApplicationId, Path.GetFullPath(root), target.ProjectFile, package.PackageVersion,
            package.ContractVersion, previewId, now, files, [], blockers);
    }

    public static string PreviewId(string applicationId, string root, string version, IEnumerable<PlanFile> files)
    {
        var value = string.Join("\n", new[] { applicationId, Path.GetFullPath(root), version }
            .Concat(files.OrderBy(file => file.RelativePath, StringComparer.Ordinal)
                .Select(file => $"{file.RelativePath}|{file.Action}|{file.OldHash}|{file.NewHash}")));
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value))).ToLowerInvariant();
    }
}
