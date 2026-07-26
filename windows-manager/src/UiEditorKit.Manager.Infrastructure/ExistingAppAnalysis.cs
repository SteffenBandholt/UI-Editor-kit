using System.Text;
using System.Text.Json;
using System.Xml;
using System.Xml.Linq;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using UiEditorKit.Manager.Core;
using UiEditorKit.Manager.Domain;

namespace UiEditorKit.Manager.Infrastructure;

public sealed class SdkWpfProjectFileAdapter : IProjectFileAdapter
{
    public async Task<(ProjectFileAnalysis? Project, ManagerResult Result)> AnalyzeAsync(string root, string projectFile,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var path = ManagerPathRules.ResolveInside(root, projectFile);
            if (!File.Exists(path)) return (null, ManagerResult.Fail(ManagerErrorCodes.RegistrationProjectInvalid, "Projektdatei fehlt."));
            await using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read, 81920, FileOptions.Asynchronous);
            var document = await XDocument.LoadAsync(stream, LoadOptions.PreserveWhitespace | LoadOptions.SetLineInfo, cancellationToken);
            var project = document.Root;
            if (project is null || project.Name.LocalName != "Project")
                return (null, ManagerResult.Fail(ManagerErrorCodes.RegistrationProjectInvalid, "Projekt-XML besitzt kein Project-Wurzelelement."));
            var sdk = project.Attribute("Sdk")?.Value ?? project.Elements().FirstOrDefault(item => item.Name.LocalName == "Sdk")?.Attribute("Name")?.Value ?? string.Empty;
            var properties = project.Descendants().Where(item => item.Parent?.Name.LocalName == "PropertyGroup")
                .GroupBy(item => item.Name.LocalName, StringComparer.Ordinal).ToDictionary(group => group.Key, group => group.Last().Value.Trim(), StringComparer.Ordinal);
            var targetFramework = properties.GetValueOrDefault("TargetFramework") ?? properties.GetValueOrDefault("TargetFrameworks") ?? string.Empty;
            var useWpf = string.Equals(properties.GetValueOrDefault("UseWPF"), "true", StringComparison.OrdinalIgnoreCase);
            var warnings = new List<string>();
            if (string.IsNullOrWhiteSpace(sdk)) warnings.Add("SDK-Angabe fehlt.");
            if (targetFramework.Contains(';')) warnings.Add("Mehrfaches TargetFramework wird im M79-Erstumfang nicht installiert.");
            var references = project.Descendants().Where(item => item.Name.LocalName == "ProjectReference")
                .Select(item => item.Attribute("Include")?.Value).Where(value => !string.IsNullOrWhiteSpace(value)).Cast<string>().ToArray();
            var analysis = new ProjectFileAnalysis(projectFile.Replace('\\', '/'), sdk, targetFramework, useWpf,
                properties.GetValueOrDefault("RootNamespace"), properties.GetValueOrDefault("AssemblyName"), references, warnings);
            if (!sdk.StartsWith("Microsoft.NET.Sdk", StringComparison.OrdinalIgnoreCase) || !useWpf ||
                !targetFramework.Contains("-windows", StringComparison.OrdinalIgnoreCase))
                return (analysis, ManagerResult.Fail(ManagerErrorCodes.RegistrationFrameworkUnsupported, "Framework derzeit nicht unterstützt"));
            return (analysis, ManagerResult.Ok("registration_project_supported", "SDK-basiertes C#-/WPF-Projekt wurde erkannt."));
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or XmlException or InvalidOperationException)
        {
            return (null, ManagerResult.Fail(ManagerErrorCodes.RegistrationProjectInvalid, "Projektdatei konnte nicht strukturiert gelesen werden: " + exception.Message));
        }
    }
}

public sealed class StructuredXamlSourceAnalyzer : IXamlSourceAnalyzer
{
    private static readonly XNamespace XamlNamespace = "http://schemas.microsoft.com/winfx/2006/xaml";
    private static readonly HashSet<string> ViewTypes = new(StringComparer.OrdinalIgnoreCase) { "Window", "Page", "UserControl", "NavigationWindow" };
    private static readonly HashSet<string> IgnoredTypes = new(StringComparer.OrdinalIgnoreCase)
        { "RowDefinition", "ColumnDefinition", "Setter", "Trigger", "Style", "ControlTemplate", "DataTemplate", "ResourceDictionary" };

    public async Task<IReadOnlyList<UiSourceFinding>> AnalyzeAsync(string root, string relativeFile,
        CancellationToken cancellationToken = default)
    {
        var path = ManagerPathRules.ResolveInside(root, relativeFile);
        await using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read, 81920, FileOptions.Asynchronous);
        var document = await XDocument.LoadAsync(stream, LoadOptions.PreserveWhitespace | LoadOptions.SetLineInfo, cancellationToken);
        if (document.Root is null) return [];
        if (document.Root.Name.LocalName is "Application" or "ResourceDictionary") return [];
        var elements = document.Root.DescendantsAndSelf().Where(IsControlElement).ToArray();
        var paths = elements.ToDictionary(element => element, StructuralPath);
        var viewId = document.Root.Attribute(XamlNamespace + "Class")?.Value ?? relativeFile.Replace('\\', '/');
        return elements.Select(element =>
        {
            cancellationToken.ThrowIfCancellationRequested();
            var line = (IXmlLineInfo)element;
            var declaredName = element.Attribute(XamlNamespace + "Name")?.Value ?? element.Attribute("Name")?.Value;
            if (ReferenceEquals(element, document.Root) && string.IsNullOrWhiteSpace(declaredName))
                declaredName = element.Attribute(XamlNamespace + "Class")?.Value?.Split('.').LastOrDefault();
            var attributes = element.Attributes().Where(attribute => !attribute.IsNamespaceDeclaration)
                .ToDictionary(AttributeName, attribute => attribute.Value, StringComparer.Ordinal);
            var bindings = attributes.Where(pair => pair.Value.Contains("{Binding", StringComparison.Ordinal) ||
                                                     pair.Value.Contains("{TemplateBinding", StringComparison.Ordinal) ||
                                                     pair.Key.Contains("Command", StringComparison.OrdinalIgnoreCase))
                .Select(pair => pair.Key + "=" + pair.Value).ToArray();
            var events = attributes.Where(pair => pair.Key is "Click" or "Command" or "CommandParameter" || pair.Key.EndsWith("Command", StringComparison.Ordinal))
                .Select(pair => pair.Key + "=" + pair.Value).ToArray();
            var dynamic = element.AncestorsAndSelf().Any(item => item.Name.LocalName.Contains("Template", StringComparison.OrdinalIgnoreCase) ||
                                                                 item.Name.LocalName is "ItemsPanel" or "ItemTemplate");
            var warnings = new List<string>();
            if (string.IsNullOrWhiteSpace(declaredName) && !ReferenceEquals(element, document.Root)) warnings.Add("Element besitzt weder x:Name noch Name.");
            if (dynamic) warnings.Add("Template- oder dynamische Laufzeitstruktur; statische Parentbeziehung ist unsicher.");
            var parent = element.Ancestors().FirstOrDefault(IsControlElement);
            return new UiSourceFinding(
                FindingId(relativeFile, paths[element]), viewId,
                new(relativeFile.Replace('\\', '/'), line.HasLineInfo() ? line.LineNumber : 1, line.HasLineInfo() ? line.LinePosition : 1),
                "wpf-sdk-dotnet", element.Name.LocalName, declaredName, paths[element], parent is null ? null : paths.GetValueOrDefault(parent),
                attributes, bindings, events, dynamic || string.IsNullOrWhiteSpace(declaredName) ? RegistrationConfidence.Low : RegistrationConfidence.High,
                ReferenceEquals(element, document.Root) && ViewTypes.Contains(element.Name.LocalName), dynamic, warnings);
        }).ToArray();
    }

    private static bool IsControlElement(XElement element) =>
        !element.Name.LocalName.Contains('.') && !IgnoredTypes.Contains(element.Name.LocalName) &&
        element.Name.Namespace != XamlNamespace;

    private static string StructuralPath(XElement element)
    {
        var segments = element.AncestorsAndSelf().Reverse().Where(IsControlElement).Select(item =>
        {
            var siblings = item.Parent?.Elements().Where(candidate => candidate.Name == item.Name && IsControlElement(candidate)).ToArray() ?? [item];
            var index = Array.IndexOf(siblings, item) + 1;
            return item.Name.LocalName + "[" + index + "]";
        });
        return "/" + string.Join('/', segments);
    }

    private static string AttributeName(XAttribute attribute) => attribute.Name.Namespace == XamlNamespace
        ? "x:" + attribute.Name.LocalName : attribute.Name.LocalName;

    private static string FindingId(string file, string path)
    {
        var hash = Hashing.Bytes(Encoding.UTF8.GetBytes(file.Replace('\\', '/') + "|" + path));
        return "xaml-" + hash[..16];
    }
}

public sealed class RoslynCSharpSourceAnalyzer : ICSharpSourceAnalyzer
{
    private static readonly string[] RiskTokens =
    [
        "save", "delete", "create", "add", "upload", "import", "export", "send", "submit", "execute", "process",
        "synchronize", "database", "sql", "http", "socket", "network", "write", "file", "pipe", "ipc"
    ];

    public async Task<IReadOnlyList<CodeActionFinding>> AnalyzeAsync(string root, string relativeFile,
        CancellationToken cancellationToken = default)
    {
        var path = ManagerPathRules.ResolveInside(root, relativeFile);
        var source = await File.ReadAllTextAsync(path, cancellationToken);
        var tree = CSharpSyntaxTree.ParseText(source, new CSharpParseOptions(LanguageVersion.Latest), path, cancellationToken: cancellationToken);
        var rootNode = await tree.GetRootAsync(cancellationToken);
        var result = new List<CodeActionFinding>();
        foreach (var method in rootNode.DescendantNodes().OfType<MethodDeclarationSyntax>())
        {
            cancellationToken.ThrowIfCancellationRequested();
            var symbol = method.Identifier.ValueText;
            var evidenceNodes = method.DescendantNodes().OfType<InvocationExpressionSyntax>().Select(item => item.Expression.ToString())
                .Concat(method.DescendantNodes().OfType<ObjectCreationExpressionSyntax>().Select(item => item.Type.ToString()))
                .Concat([symbol]).ToArray();
            var categories = RiskTokens.Where(token => evidenceNodes.Any(value => value.Contains(token, StringComparison.OrdinalIgnoreCase))).ToArray();
            if (categories.Length == 0 && !symbol.EndsWith("Click", StringComparison.OrdinalIgnoreCase)) continue;
            var position = tree.GetLineSpan(method.Identifier.Span).StartLinePosition;
            result.Add(new(new(relativeFile.Replace('\\', '/'), position.Line + 1, position.Character + 1), symbol,
                categories.Length == 0 ? "unknownAction" : string.Join('+', categories), string.Join(", ", evidenceNodes.Take(8)),
                categories.Length > 0 ? RegistrationConfidence.High : RegistrationConfidence.Medium,
                ["Reiner Syntaxfund; Zielcode wurde nicht ausgeführt."]));
        }
        foreach (var property in rootNode.DescendantNodes().OfType<PropertyDeclarationSyntax>()
                     .Where(item => item.Type.ToString().Contains("ICommand", StringComparison.Ordinal)))
        {
            var position = tree.GetLineSpan(property.Identifier.Span).StartLinePosition;
            result.Add(new(new(relativeFile.Replace('\\', '/'), position.Line + 1, position.Character + 1), property.Identifier.ValueText,
                "command", property.Type.ToString(), RegistrationConfidence.High, ["ICommand-Syntaxfund; Command bleibt gesperrt."]));
        }
        return result.OrderBy(item => item.SourceLocation.Line).ThenBy(item => item.Symbol, StringComparer.Ordinal).ToArray();
    }
}

public sealed class RegistrationAnalysisStore(ManagerPaths paths)
{
    private string DirectoryPath => Path.Combine(paths.Data, "registration-analyses");

    public async Task SaveAsync(ExistingAppAnalysis analysis, CancellationToken cancellationToken = default)
    {
        Directory.CreateDirectory(DirectoryPath);
        var target = Path.Combine(DirectoryPath, analysis.RootPathFingerprint + ".json");
        await AtomicJsonFile.WriteAsync(target, analysis, cancellationToken);
    }

    public async Task<ExistingAppAnalysis?> LoadAsync(string rootPathFingerprint, CancellationToken cancellationToken = default)
    {
        var target = Path.Combine(DirectoryPath, rootPathFingerprint + ".json");
        if (!File.Exists(target)) return null;
        try
        {
            await using var stream = File.OpenRead(target);
            var value = await JsonSerializer.DeserializeAsync<ExistingAppAnalysis>(stream, ManagerJson.Options, cancellationToken);
            return value is { SchemaVersion: 1 } ? value : null;
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or JsonException) { return null; }
    }
}

public sealed class WpfExistingProjectAdapter(
    ManagerPaths managerPaths,
    IProjectFileAdapter? projectAdapter = null,
    IXamlSourceAnalyzer? xamlAnalyzer = null,
    ICSharpSourceAnalyzer? csharpAnalyzer = null) : IExistingProjectAdapter
{
    private readonly IProjectFileAdapter projectAdapter = projectAdapter ?? new SdkWpfProjectFileAdapter();
    private readonly IXamlSourceAnalyzer xamlAnalyzer = xamlAnalyzer ?? new StructuredXamlSourceAnalyzer();
    private readonly ICSharpSourceAnalyzer csharpAnalyzer = csharpAnalyzer ?? new RoslynCSharpSourceAnalyzer();
    public string AdapterVersion => "wpf-sdk-dotnet/1.0";

    public async Task<RegistrationAnalysisResult> AnalyzeAsync(string selectedPath, CancellationToken cancellationToken = default)
    {
        try
        {
            var selection = ResolveSelection(selectedPath);
            if (!selection.Result.Success || selection.Root is null || selection.ProjectFile is null)
                return new(null, selection.Result, false);
            var before = await SourceInventoryBuilder.CreateAsync(selection.Root, cancellationToken);
            var projectResult = await projectAdapter.AnalyzeAsync(selection.Root, selection.ProjectFile, cancellationToken);
            if (projectResult.Project is null || !projectResult.Result.Success)
                return new(null, projectResult.Result, false);

            var xamlFiles = before.Files.Select(item => item.RelativePath).Where(path => path.EndsWith(".xaml", StringComparison.OrdinalIgnoreCase)).ToArray();
            var codeFiles = before.Files.Select(item => item.RelativePath).Where(path => path.EndsWith(".cs", StringComparison.OrdinalIgnoreCase)).ToArray();
            var xamlTasks = xamlFiles.Select(path => xamlAnalyzer.AnalyzeAsync(selection.Root, path, cancellationToken));
            var codeTasks = codeFiles.Select(path => csharpAnalyzer.AnalyzeAsync(selection.Root, path, cancellationToken));
            var xamlResults = await Task.WhenAll(xamlTasks);
            var codeResults = await Task.WhenAll(codeTasks);
            var findings = xamlResults.SelectMany(item => item).OrderBy(item => item.SourceLocation.RelativeFile, StringComparer.Ordinal)
                .ThenBy(item => item.SourceLocation.Line).ToArray();
            var actions = codeResults.SelectMany(item => item).OrderBy(item => item.SourceLocation.RelativeFile, StringComparer.Ordinal)
                .ThenBy(item => item.SourceLocation.Line).ToArray();
            var applicationId = StableRegistrationIds.ApplicationId(projectResult.Project.AssemblyName ?? projectResult.Project.RootNamespace ??
                                                                       Path.GetFileNameWithoutExtension(selection.ProjectFile));
            var proposals = RegistrationProposalGenerator.Create(applicationId, findings, actions);
            var store = new RegistrationAnalysisStore(managerPaths);
            var previous = await store.LoadAsync(before.RootPathFingerprint, cancellationToken);
            if (previous is not null) proposals = RegistrationProposalGenerator.PreserveSafeDecisions(proposals, previous.Proposals);
            var analysisId = Hashing.Bytes(Encoding.UTF8.GetBytes(applicationId + "|" + before.InventoryHash + "|" + AdapterVersion));
            var warnings = projectResult.Project.Warnings.Concat(findings.SelectMany(item => item.Warnings)).Distinct(StringComparer.Ordinal).ToArray();
            var analysis = new ExistingAppAnalysis(1, analysisId, applicationId, projectResult.Project.AssemblyName ?? applicationId,
                before.RootPathFingerprint, RegistrationFramework.WpfSdkDotNet, selection.ProjectFile.Replace('\\', '/'), projectResult.Project,
                DateTimeOffset.UtcNow, before.InventoryHash, AdapterVersion, before, findings, actions, proposals, warnings, [], []);
            var after = await SourceInventoryBuilder.CreateAsync(selection.Root, cancellationToken);
            var identical = SourceInventoryBuilder.ByteIdentical(before, after);
            if (!identical)
                return new(null, ManagerResult.Fail(ManagerErrorCodes.RegistrationSourceChanged, "Zielprojekt änderte sich während der read-only Analyse."), false);
            await store.SaveAsync(analysis, cancellationToken);
            return new(analysis, ManagerResult.Ok("registration_analysis_complete",
                $"Read-only Analyse abgeschlossen: {findings.Length} UI-Fundstellen, {proposals.Count} Vorschläge."), true);
        }
        catch (OperationCanceledException) { return new(null, ManagerResult.Fail(ManagerErrorCodes.RegistrationAnalysisFailed, "Analyse wurde sicher abgebrochen."), false); }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or XmlException or InvalidOperationException or ArgumentException)
        {
            return new(null, ManagerResult.Fail(ManagerErrorCodes.RegistrationAnalysisFailed, "Read-only Analyse fehlgeschlagen: " + exception.Message), false);
        }
    }

    private static (string? Root, string? ProjectFile, ManagerResult Result) ResolveSelection(string selectedPath)
    {
        if (string.IsNullOrWhiteSpace(selectedPath)) return (null, null, ManagerResult.Fail(ManagerErrorCodes.RegistrationProjectInvalid, "Projektpfad fehlt."));
        var selected = Path.GetFullPath(selectedPath);
        var root = File.Exists(selected) ? Path.GetDirectoryName(selected)! : selected;
        if (!Directory.Exists(root)) return (null, null, ManagerResult.Fail(ManagerErrorCodes.RegistrationProjectInvalid, "Projektpfad existiert nicht."));
        string[] projects;
        if (File.Exists(selected) && selected.EndsWith(".csproj", StringComparison.OrdinalIgnoreCase)) projects = [selected];
        else projects = Directory.EnumerateFiles(root, "*.csproj", SearchOption.AllDirectories)
            .Where(path => !SourceInventoryBuilder.IsExcluded(root, path)).Order(StringComparer.OrdinalIgnoreCase).ToArray();
        if (projects.Length == 0) return (null, null, ManagerResult.Fail(ManagerErrorCodes.RegistrationProjectInvalid, "Keine .csproj-Datei gefunden."));
        if (projects.Length > 1) return (null, null, ManagerResult.Fail(ManagerErrorCodes.RegistrationProjectInvalid,
            "Mehrere Projekte gefunden; im M79-Erstumfang muss die WPF-.csproj-Datei ausdrücklich ausgewählt werden."));
        root = FindProjectRoot(root, projects[0]);
        return (root, Path.GetRelativePath(root, projects[0]), ManagerResult.Ok("registration_project_selected", "Projekt wurde ausgewählt."));
    }

    private static string FindProjectRoot(string selectionRoot, string project)
    {
        var projectDirectory = Path.GetDirectoryName(project)!;
        if (ManagerPathRules.IsInside(selectionRoot, projectDirectory)) return Path.GetFullPath(selectionRoot);
        return Path.GetFullPath(projectDirectory);
    }
}

public static class SourceInventoryBuilder
{
    private static readonly HashSet<string> ExcludedDirectories = new(StringComparer.OrdinalIgnoreCase)
        { ".git", ".vs", ".ui-editor-kit", "bin", "obj", "node_modules" };

    public static async Task<SourceInventory> CreateAsync(string root, CancellationToken cancellationToken = default)
    {
        var fullRoot = Path.GetFullPath(root);
        var files = new List<SourceInventoryItem>();
        foreach (var path in Directory.EnumerateFiles(fullRoot, "*", SearchOption.AllDirectories)
                     .Where(path => !IsExcluded(fullRoot, path) && !string.Equals(Path.GetRelativePath(fullRoot, path).Replace('\\', '/'),
                         "ui-editor-target.json", StringComparison.OrdinalIgnoreCase)).Order(StringComparer.Ordinal))
        {
            cancellationToken.ThrowIfCancellationRequested();
            var info = new FileInfo(path);
            files.Add(new(Path.GetRelativePath(fullRoot, path).Replace('\\', '/'), await Hashing.FileAsync(path, cancellationToken), info.Length));
        }
        var canonical = string.Join("\n", files.Select(item => $"{item.RelativePath}|{item.Sha256}|{item.Length}"));
        var inventoryHash = Hashing.Bytes(Encoding.UTF8.GetBytes(canonical));
        var rootFingerprint = Hashing.Bytes(Encoding.UTF8.GetBytes(fullRoot.ToUpperInvariant()));
        return new(rootFingerprint, inventoryHash, files);
    }

    public static bool ByteIdentical(SourceInventory left, SourceInventory right) => left.InventoryHash == right.InventoryHash &&
        left.Files.SequenceEqual(right.Files);

    public static bool IsExcluded(string root, string path)
    {
        var relative = Path.GetRelativePath(root, path);
        return relative.Split(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar).Any(ExcludedDirectories.Contains);
    }
}

internal static class AtomicJsonFile
{
    public static async Task WriteAsync<T>(string target, T value, CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(target)!);
        var temp = target + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            await using (var stream = new FileStream(temp, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920,
                             FileOptions.Asynchronous | FileOptions.WriteThrough))
            {
                await JsonSerializer.SerializeAsync(stream, value, ManagerJson.Options, cancellationToken);
                await stream.FlushAsync(cancellationToken); stream.Flush(true);
            }
            if (File.Exists(target)) File.Replace(temp, target, null, true); else File.Move(temp, target);
        }
        finally { try { if (File.Exists(temp)) File.Delete(temp); } catch { } }
    }
}
