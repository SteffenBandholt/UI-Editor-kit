using System.Diagnostics;
using System.Text;
using System.Text.Json;
using System.Xml;
using System.Xml.Linq;
using UiEditorKit.Manager.Core;
using UiEditorKit.Manager.Domain;

namespace UiEditorKit.Manager.Infrastructure;

public sealed class ControlledRegistrationArtifactGenerator : IRegistrationArtifactGenerator
{
    public Task<(GeneratedRegistrationRegistry? Registry, IReadOnlyList<RegistrationGeneratedFile> Files, ManagerResult Result)> GenerateAsync(
        ExistingAppAnalysis analysis, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var generated = RegistrationRegistryGenerator.Create(analysis);
        if (generated.Registry is null)
        {
            var message = string.Join(" ", generated.Validation.Issues.Select(item => item.Code + ": " + item.Message));
            return Task.FromResult<(GeneratedRegistrationRegistry?, IReadOnlyList<RegistrationGeneratedFile>, ManagerResult)>(
                (null, [], ManagerResult.Fail(ManagerErrorCodes.RegistrationRegistryInvalid, message)));
        }

        var json = new JsonSerializerOptions(ManagerJson.Options) { WriteIndented = true };
        var registryBytes = JsonSerializer.SerializeToUtf8Bytes(generated.Registry, json);
        var analysisBytes = JsonSerializer.SerializeToUtf8Bytes(analysis, json);
        var adapterBytes = new UTF8Encoding(false).GetBytes(GeneratedWpfAdapterTemplate.Create(generated.Registry));
        var expectedFiles = new[]
        {
            "ui-editor-target.json",
            ".ui-editor-kit/registration-analysis.json",
            ".ui-editor-kit/registration-registry.json",
            ".ui-editor-kit/generated/UiEditorKitRegistration.g.cs",
            ".ui-editor-kit/registration-installation.json"
        };
        var manifest = new TargetAppManifest(1, analysis.ApplicationId, analysis.DisplayName, "wpf-sdk-existing",
            analysis.ProjectFile, analysis.Project.TargetFramework, "registered-existing-wpf", ".ui-editor-kit",
            analysis.ProjectFile, analysis.ProjectFile, TargetContractValidator.ContractVersion,
            new(true, true, true, true, true), expectedFiles,
            new("dotnetProject", analysis.ProjectFile, null, []),
            new("dotnetProject", analysis.ProjectFile, null, ["--ui-editor-kit-editor"]), "ui-editor-kit-m79");
        var manifestBytes = JsonSerializer.SerializeToUtf8Bytes(manifest, json);
        IReadOnlyList<RegistrationGeneratedFile> files =
        [
            new("ui-editor-target.json", manifestBytes, "ui-editor-kit-m79", "Versionierter M79-Ziel-App-Vertrag"),
            new(".ui-editor-kit/registration-analysis.json", analysisBytes, "ui-editor-kit-m79", "Bestätigte lokale Analyse ohne absolute Pfade oder Dateiinhalte"),
            new(".ui-editor-kit/registration-registry.json", registryBytes, "ui-editor-kit-m79", "Deterministische neutrale UI-Registry"),
            new(".ui-editor-kit/generated/UiEditorKitRegistration.g.cs", adapterBytes, "ui-editor-kit-m79", "Kontrollierter WPF-HostAdapter aus festem Template")
        ];
        return Task.FromResult<(GeneratedRegistrationRegistry?, IReadOnlyList<RegistrationGeneratedFile>, ManagerResult)>((generated.Registry, files,
            ManagerResult.Ok("registration_artifacts_generated", "Registry und WPF-HostAdapter wurden deterministisch aus bestätigten Vorschlägen erzeugt.")));
    }
}

public static class StructuredProjectRegistrationEditor
{
    public const string Label = "UI-Editor-kit M79";
    public const string GeneratedCompilePath = ".ui-editor-kit\\generated\\UiEditorKitRegistration.g.cs";

    public static byte[] AddRegistrationCompileItem(byte[] original)
    {
        var (text, encoding, bom) = Decode(original);
        using var reader = new StringReader(text);
        var document = XDocument.Load(reader, LoadOptions.PreserveWhitespace | LoadOptions.SetLineInfo);
        if (document.Root?.Name.LocalName != "Project") throw new XmlException("Projektdatei besitzt kein Project-Wurzelelement.");
        if (document.Root.Elements().Any(item => item.Name.LocalName == "ItemGroup" && (string?)item.Attribute("Label") == Label))
            return original.ToArray();
        var closing = text.LastIndexOf("</Project>", StringComparison.Ordinal);
        if (closing < 0) throw new XmlException("Project-Endelement fehlt.");
        var newline = text.Contains("\r\n", StringComparison.Ordinal) ? "\r\n" : "\n";
        var indent = DetectIndent(text);
        var block = indent + "<ItemGroup Label=\"" + Label + "\">" + newline +
                    indent + indent + "<Compile Include=\"" + GeneratedCompilePath + "\">" + newline +
                    indent + indent + indent + "<Visible>false</Visible>" + newline +
                    indent + indent + "</Compile>" + newline +
                    indent + "</ItemGroup>" + newline;
        var updated = text.Insert(closing, block);
        var payload = encoding.GetBytes(updated);
        return bom.Length == 0 ? payload : bom.Concat(payload).ToArray();
    }

    public static byte[] RemoveRegistrationCompileItem(byte[] installed)
    {
        var (text, encoding, bom) = Decode(installed);
        var document = XDocument.Parse(text, LoadOptions.PreserveWhitespace);
        var group = document.Root?.Elements().SingleOrDefault(item => item.Name.LocalName == "ItemGroup" && (string?)item.Attribute("Label") == Label);
        if (group is null) return installed.ToArray();
        group.Remove();
        var updated = document.ToString(SaveOptions.DisableFormatting);
        var payload = encoding.GetBytes(updated);
        return bom.Length == 0 ? payload : bom.Concat(payload).ToArray();
    }

    private static string DetectIndent(string text)
    {
        foreach (var line in text.Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries))
        {
            var trimmed = line.TrimStart();
            if (trimmed.StartsWith('<') && line.Length > trimmed.Length) return line[..(line.Length - trimmed.Length)];
        }
        return "  ";
    }

    private static (string Text, Encoding Encoding, byte[] Bom) Decode(byte[] bytes)
    {
        if (bytes.AsSpan().StartsWith(Encoding.UTF8.GetPreamble()))
            return (Encoding.UTF8.GetString(bytes, Encoding.UTF8.GetPreamble().Length, bytes.Length - Encoding.UTF8.GetPreamble().Length),
                new UTF8Encoding(false), Encoding.UTF8.GetPreamble());
        return (new UTF8Encoding(false, true).GetString(bytes), new UTF8Encoding(false), []);
    }
}

internal static class GeneratedWpfAdapterTemplate
{
    public static string Create(GeneratedRegistrationRegistry registry)
    {
        var entries = string.Join(",\n", registry.Elements.Select(item =>
            "        new(" + Literal(item.Id) + ", " + Literal(item.Name) + ", " + Literal(item.Type) + ", " + Literal(item.Role) + ", " +
            NullableLiteral(item.ParentId) + ", " + item.Order + ", " + Bool(item.Editable) + ", " + ArrayLiteral(item.AllowedOps) + ", " +
            ArrayLiteral(item.LockedOps) + ", " + NullableLiteral(item.DeclaredName) + ")"));
        return $$"""
// <auto-generated by UI-Editor-kit M79 />
// Kontrolliertes Template: keine Fachaktion, kein Command und kein Ereignishandler wird aufgerufen.
#nullable enable
using System;
using System.Collections.ObjectModel;
using System.Collections.Generic;
using System.IO;
using System.IO.Pipes;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;

namespace UiEditorKit.Generated;

public static class UiEditorKitRegistrationMetadata
{
    public const string ApplicationId = {{Literal(registry.ApplicationId)}};
    public const string RegistryFingerprint = {{Literal(registry.Fingerprint)}};
}

public sealed record RegistrationEntry(string Id, string Name, string Type, string Role, string? ParentId, int Order,
    bool Editable, IReadOnlyList<string> AllowedOps, IReadOnlyList<string> LockedOps, string? DeclaredName);
public sealed record ElementLayoutState(string ElementId, double X, double Y, double Width, double Height,
    double? TextOffsetX, double? TextOffsetY, double? FontSize);
public sealed record LayoutState(DateTimeOffset CapturedAt, IReadOnlyList<ElementLayoutState> Elements);
public sealed record ChangeRequest(string ChangeId, string ElementId, string Operation, IReadOnlyDictionary<string, double> Payload);
public sealed record ChangeResult(bool Success, string ChangeId, string ElementId, string Operation, string? ErrorCode,
    string Message, ElementLayoutState? PreviousState, ElementLayoutState? NewState, bool RollbackSucceeded);

public interface IHostAdapter
{
    IReadOnlyList<RegistrationEntry> GetRegistry();
    LayoutState GetCurrentLayoutState();
    ChangeResult SubmitChangeRequest(ChangeRequest changeRequest);
}

public sealed class GeneratedWpfHostAdapter(FrameworkElement root) : IHostAdapter
{
    private static readonly IReadOnlyList<RegistrationEntry> Registry = new ReadOnlyCollection<RegistrationEntry>(
    [
{{entries}}
    ]);

    public IReadOnlyList<RegistrationEntry> GetRegistry() => Registry;

    public LayoutState GetCurrentLayoutState() => root.Dispatcher.Invoke(() =>
        new LayoutState(DateTimeOffset.UtcNow, Registry.Where(item => item.Editable).Select(Read).ToArray()));

    public ChangeResult SubmitChangeRequest(ChangeRequest request) => root.Dispatcher.Invoke(() => Apply(request));

    private ChangeResult Apply(ChangeRequest request)
    {
        var entry = Registry.SingleOrDefault(item => item.Id == request.ElementId);
        if (entry is null) return Rejected(request, "unknown_element", "Element ist nicht registriert.");
        if (!entry.Editable || !entry.AllowedOps.Contains(request.Operation, StringComparer.Ordinal) ||
            entry.LockedOps.Contains(request.Operation, StringComparer.Ordinal) || request.Operation is "executeTargetAction" or "modifyDomainData" or "delete")
            return Rejected(request, "operation_not_allowed", "Operation ist nicht als neutrale Layoutoperation freigegeben.");
        var target = Resolve(entry);
        if (target is null) return Rejected(request, "element_ref_missing", "Bestätigte Elementreferenz wurde nicht gefunden.");
        var before = Read(entry);
        var snapshot = Capture(target);
        try
        {
            ApplyLayout(target, request);
            return new(true, request.ChangeId, request.ElementId, request.Operation, null, "Layoutänderung angewendet.", before, Read(entry), true);
        }
        catch (Exception exception) when (exception is InvalidOperationException or ArgumentException)
        {
            try { Restore(target, snapshot); }
            catch { return new(false, request.ChangeId, request.ElementId, request.Operation, "rollback_failed", exception.Message, before, null, false); }
            return new(false, request.ChangeId, request.ElementId, request.Operation, "target_rejected_change", exception.Message, before, before, true);
        }
    }

    public object? ResolveRegisteredElement(string elementId)
    {
        var entry = Registry.SingleOrDefault(item => item.Id == elementId);
        return entry is null ? null : Resolve(entry);
    }

    private object? Resolve(RegistrationEntry entry)
    {
        if (entry.Type == "root") return root;
        if (string.IsNullOrWhiteSpace(entry.DeclaredName)) return null;
        var direct = root.FindName(entry.DeclaredName);
        return direct ?? FindInConfirmedNameScopes(root, entry.DeclaredName, new HashSet<DependencyObject>());
    }

    private static object? FindInConfirmedNameScopes(DependencyObject current, string declaredName, ISet<DependencyObject> visited)
    {
        if (!visited.Add(current)) return null;
        if (current is FrameworkElement framework)
        {
            var found = framework.FindName(declaredName);
            if (found is not null) return found;
        }
        var count = VisualTreeHelper.GetChildrenCount(current);
        for (var index = 0; index < count; index++)
        {
            var found = FindInConfirmedNameScopes(VisualTreeHelper.GetChild(current, index), declaredName, visited);
            if (found is not null) return found;
        }
        return null;
    }

    private ElementLayoutState Read(RegistrationEntry entry)
    {
        var target = Resolve(entry) ?? throw new InvalidOperationException("Elementreferenz fehlt: " + entry.Id);
        if (target is DataGridColumn column)
            return new(entry.Id, 0, 0, column.ActualWidth, 0, null, null, null);
        if (target is not FrameworkElement element) throw new InvalidOperationException("Elementtyp wird nicht unterstützt.");
        var translation = element.RenderTransform as TranslateTransform;
        double? fontSize = element switch { Control control => control.FontSize, TextBlock text => text.FontSize, _ => null };
        double? textOffsetX = element is Control padded ? NonNegativeOrZero(padded.Padding.Left) : null;
        double? textOffsetY = element is Control paddedControl ? NonNegativeOrZero(paddedControl.Padding.Top) : null;
        return new(entry.Id, translation?.X ?? 0, translation?.Y ?? 0,
            double.IsNaN(element.Width) ? element.ActualWidth : element.Width,
            double.IsNaN(element.Height) ? element.ActualHeight : element.Height, textOffsetX, textOffsetY, fontSize);
    }

    private static double FiniteOrZero(double value) => double.IsFinite(value) ? value : 0;
    private static double NonNegativeOrZero(double value) => double.IsFinite(value) && value >= 0 ? value : 0;

    private static (double Width, double Height, Transform Transform, Thickness? Padding, double? FontSize) Capture(object target) => target switch
    {
        DataGridColumn column => (column.Width.IsAbsolute ? column.Width.Value : column.ActualWidth, double.NaN, Transform.Identity, null, null),
        Control control => (control.Width, control.Height, control.RenderTransform, control.Padding, control.FontSize),
        TextBlock text => (text.Width, text.Height, text.RenderTransform, null, text.FontSize),
        FrameworkElement element => (element.Width, element.Height, element.RenderTransform, null, null),
        _ => throw new InvalidOperationException("Elementtyp wird nicht unterstützt.")
    };

    private static void ApplyLayout(object target, ChangeRequest request)
    {
        static double Required(ChangeRequest request, string name) => request.Payload.TryGetValue(name, out var value) && double.IsFinite(value)
            ? value : throw new ArgumentException("Endlicher Payloadwert fehlt: " + name);
        if (target is DataGridColumn column && request.Operation == "changeWidth")
        {
            var width = Required(request, "width"); if (width <= 0) throw new ArgumentException("Breite muss positiv sein.");
            column.Width = new DataGridLength(width); return;
        }
        if (target is not FrameworkElement element) throw new InvalidOperationException("Elementtyp wird nicht unterstützt.");
        switch (request.Operation)
        {
            case "move": element.RenderTransform = new TranslateTransform(Required(request, "x"), Required(request, "y")); break;
            case "resize":
                var width = Required(request, "width"); var height = Required(request, "height");
                if (width <= 0 || height <= 0) throw new ArgumentException("Größe muss positiv sein.");
                element.Width = width; element.Height = height; break;
            case "resizeWidth":
                var singleWidth = Required(request, "width"); if (singleWidth <= 0) throw new ArgumentException("Breite muss positiv sein.");
                element.Width = singleWidth; break;
            case "resizeHeight":
                var singleHeight = Required(request, "height"); if (singleHeight <= 0) throw new ArgumentException("Höhe muss positiv sein.");
                element.Height = singleHeight; break;
            case "textResize" when element is Control control:
                var size = Required(request, "fontSize"); if (size <= 0) throw new ArgumentException("Schriftgröße muss positiv sein.");
                control.FontSize = size; break;
            case "textResize" when element is TextBlock text:
                var textSize = Required(request, "fontSize"); if (textSize <= 0) throw new ArgumentException("Schriftgröße muss positiv sein.");
                text.FontSize = textSize; break;
            case "textMove" when element is Control padded:
                var offsetX = Required(request, "offsetX"); var offsetY = Required(request, "offsetY");
                if (offsetX < 0 || offsetY < 0) throw new ArgumentException("Textoffset muss nicht-negativ sein.");
                padded.Padding = new Thickness(offsetX, offsetY, FiniteOrZero(padded.Padding.Right), FiniteOrZero(padded.Padding.Bottom)); break;
            default: throw new InvalidOperationException("Operation wird vom WPF-Template nicht unterstützt.");
        }
    }

    private static void Restore(object target, (double Width, double Height, Transform Transform, Thickness? Padding, double? FontSize) state)
    {
        if (target is DataGridColumn column) { column.Width = new DataGridLength(state.Width); return; }
        if (target is not FrameworkElement element) return;
        element.Width = state.Width; element.Height = state.Height; element.RenderTransform = state.Transform;
        if (target is Control control)
        {
            if (state.Padding is not null) control.Padding = state.Padding.Value;
            if (state.FontSize is not null) control.FontSize = state.FontSize.Value;
        }
        if (target is TextBlock text && state.FontSize is not null) text.FontSize = state.FontSize.Value;
    }

    private static ChangeResult Rejected(ChangeRequest request, string code, string message) =>
        new(false, request.ChangeId, request.ElementId, request.Operation, code, message, null, null, true);
}

public static class UiEditorKitRegistrationBridge
{
    private const string PipePrefix = "--ui-editor-kit-host-pipe=";
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static int started;

    [ModuleInitializer]
    public static void Initialize()
    {
        if (!Environment.GetCommandLineArgs().Any(argument => argument.StartsWith(PipePrefix, StringComparison.Ordinal))) return;
        EventManager.RegisterClassHandler(typeof(Window), FrameworkElement.LoadedEvent, new RoutedEventHandler(OnWindowLoaded));
    }

    private static async void OnWindowLoaded(object sender, RoutedEventArgs args)
    {
        if (sender is not Window window || Interlocked.Exchange(ref started, 1) != 0) return;
        var argument = Environment.GetCommandLineArgs().Single(item => item.StartsWith(PipePrefix, StringComparison.Ordinal));
        var pipeName = argument[PipePrefix.Length..];
        if (string.IsNullOrWhiteSpace(pipeName)) return;
        try { await RunAsync(pipeName, new GeneratedWpfHostAdapter(window)); }
        catch (Exception exception) when (exception is IOException or InvalidOperationException or JsonException) { }
    }

    private static async Task RunAsync(string pipeName, GeneratedWpfHostAdapter adapter)
    {
        await using var pipe = new NamedPipeServerStream(pipeName, PipeDirection.InOut, 1,
            PipeTransmissionMode.Byte, PipeOptions.Asynchronous);
        await pipe.WaitForConnectionAsync();
        using var reader = new StreamReader(pipe, new UTF8Encoding(false), false, 4096, true);
        await using var writer = new StreamWriter(pipe, new UTF8Encoding(false), 4096, true) { AutoFlush = true };
        while (pipe.IsConnected && await reader.ReadLineAsync() is { } line)
        {
            BridgeResponse response;
            BridgeRequest? request = null;
            try
            {
                request = JsonSerializer.Deserialize<BridgeRequest>(line, JsonOptions)
                          ?? throw new JsonException("Lokale M79-Anfrage fehlt.");
                response = Handle(request, adapter);
            }
            catch (Exception exception) when (exception is JsonException or InvalidOperationException or ArgumentException)
            {
                response = new(request?.Id ?? "unknown", false, "Lokale M79-HostAdapter-Anfrage wurde sicher abgewiesen.",
                    JsonSerializer.SerializeToElement(new { }, JsonOptions));
            }
            await writer.WriteLineAsync(JsonSerializer.Serialize(response, JsonOptions));
        }
    }

    private static BridgeResponse Handle(BridgeRequest request, GeneratedWpfHostAdapter adapter)
    {
        object payload = request.Type switch
        {
            "getRegistry" => adapter.GetRegistry(),
            "getLayout" => adapter.GetCurrentLayoutState(),
            "submitChange" => adapter.SubmitChangeRequest(request.Payload.Deserialize<ChangeRequest>(JsonOptions)
                ?? throw new JsonException("ChangeRequest fehlt.")),
            _ => throw new InvalidOperationException("Unbekannter lokaler M79-Anfragetyp.")
        };
        return new(request.Id, true, null, JsonSerializer.SerializeToElement(payload, JsonOptions));
    }

    private sealed record BridgeRequest(string Id, string Type, string? ElementId, JsonElement Payload);
    private sealed record BridgeResponse(string Id, bool Success, string? Error, JsonElement Payload);
}
""";
    }

    private static string Literal(string value) => JsonSerializer.Serialize(value);
    private static string NullableLiteral(string? value) => value is null ? "null" : Literal(value);
    private static string Bool(bool value) => value ? "true" : "false";
    private static string ArrayLiteral(IReadOnlyList<string> values) => "new string[] { " + string.Join(", ", values.Select(Literal)) + " }";
}

public sealed class GeneratedRegistrationContractChecker : IRegistrationContractChecker
{
    public Task<ManagerResult> CheckAsync(string targetRoot, ExistingAppAnalysis analysis, GeneratedRegistrationRegistry registry,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var generated = RegistrationRegistryGenerator.Create(analysis);
        if (generated.Registry is null || generated.Registry.Fingerprint != registry.Fingerprint)
            return Task.FromResult(ManagerResult.Fail(ManagerErrorCodes.RegistrationContractFailed, "Registryvalidierung oder Fingerprintvergleich ist fehlgeschlagen."));
        var adapterPath = ManagerPathRules.ResolveInside(targetRoot, ".ui-editor-kit/generated/UiEditorKitRegistration.g.cs");
        if (!File.Exists(adapterPath)) return Task.FromResult(ManagerResult.Fail(ManagerErrorCodes.RegistrationContractFailed, "Generierter HostAdapter fehlt."));
        var source = File.ReadAllText(adapterPath);
        if (!source.Contains("public interface IHostAdapter", StringComparison.Ordinal) ||
            !source.Contains("GetRegistry()", StringComparison.Ordinal) || !source.Contains("GetCurrentLayoutState()", StringComparison.Ordinal) ||
            !source.Contains("SubmitChangeRequest", StringComparison.Ordinal) || source.Contains(".Execute(", StringComparison.Ordinal) ||
            source.Contains("HttpClient", StringComparison.Ordinal) || source.Contains("System.Net", StringComparison.Ordinal))
            return Task.FromResult(ManagerResult.Fail(ManagerErrorCodes.RegistrationContractFailed, "HostAdapter verletzt den kontrollierten M73-/M79-Vertrag."));
        return Task.FromResult(ManagerResult.Ok("registration_contract_valid", "Registry, Elementreferenzen und HostAdapter-Vertrag sind gültig."));
    }
}

public sealed record GitSafetyResult(bool IsRepository, bool Safe, string? RepositoryRoot, IReadOnlyList<string> DirtyPaths, string Message);

public sealed class GitSafetyInspector
{
    public async Task<GitSafetyResult> CheckAsync(string targetRoot, IReadOnlyCollection<string> affectedRelativePaths,
        CancellationToken cancellationToken = default)
    {
        var probe = await RunAsync(targetRoot, ["rev-parse", "--show-toplevel"], cancellationToken);
        if (probe.ExitCode != 0) return new(false, true, null, [], "Kein Git-Repository; Hashinventar und Backups sind verpflichtend.");
        var repositoryRoot = probe.StandardOutput.Trim();
        var status = await RunAsync(targetRoot, ["status", "--porcelain=v1", "--untracked-files=all"], cancellationToken);
        if (status.ExitCode != 0) return new(true, false, repositoryRoot, [], "Git-Status konnte nicht gelesen werden.");
        var dirty = status.StandardOutput.Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries)
            .Select(line => line.Length > 3 ? line[3..].Trim().Trim('"').Replace('\\', '/') : string.Empty)
            .Where(path => path.Length > 0).ToArray();
        var targetPrefix = Path.GetRelativePath(repositoryRoot, targetRoot).Replace('\\', '/').TrimEnd('/');
        var conflicts = dirty.Where(path => affectedRelativePaths.Any(affected =>
            string.Equals(path, Combine(targetPrefix, affected), StringComparison.OrdinalIgnoreCase))).ToArray();
        return conflicts.Length == 0
            ? new(true, true, repositoryRoot, dirty, dirty.Length == 0 ? "Git-Arbeitsbaum ist sauber." : "Fremde uncommittete Dateien werden nicht berührt.")
            : new(true, false, repositoryRoot, conflicts, "Uncommittete Änderung kollidiert mit einer M79-Zieldatei.");
    }

    private static string Combine(string prefix, string relative) => string.IsNullOrWhiteSpace(prefix) || prefix == "."
        ? relative.Replace('\\', '/') : prefix + "/" + relative.Replace('\\', '/');

    private static async Task<(int ExitCode, string StandardOutput)> RunAsync(string root, IReadOnlyList<string> arguments,
        CancellationToken cancellationToken)
    {
        try
        {
            var start = new ProcessStartInfo("git") { WorkingDirectory = root, UseShellExecute = false, RedirectStandardOutput = true, RedirectStandardError = true };
            start.ArgumentList.Add("-C"); start.ArgumentList.Add(root); foreach (var argument in arguments) start.ArgumentList.Add(argument);
            using var process = Process.Start(start); if (process is null) return (-1, string.Empty);
            var output = await process.StandardOutput.ReadToEndAsync(cancellationToken);
            await process.WaitForExitAsync(cancellationToken); return (process.ExitCode, output);
        }
        catch (Exception exception) when (exception is IOException or InvalidOperationException) { return (-1, string.Empty); }
    }
}

public static class ExactTextDiff
{
    public static string Create(string relativePath, byte[] oldBytes, byte[] newBytes)
    {
        if (oldBytes.AsSpan().SequenceEqual(newBytes)) return string.Empty;
        var oldLines = Encoding.UTF8.GetString(oldBytes).Replace("\r\n", "\n", StringComparison.Ordinal).Split('\n');
        var newLines = Encoding.UTF8.GetString(newBytes).Replace("\r\n", "\n", StringComparison.Ordinal).Split('\n');
        var builder = new StringBuilder().AppendLine("--- a/" + relativePath).AppendLine("+++ b/" + relativePath);
        var max = Math.Max(oldLines.Length, newLines.Length);
        for (var index = 0; index < max; index++)
        {
            var oldLine = index < oldLines.Length ? oldLines[index] : null;
            var newLine = index < newLines.Length ? newLines[index] : null;
            if (oldLine == newLine) continue;
            if (oldLine is not null) builder.AppendLine("-" + oldLine);
            if (newLine is not null) builder.AppendLine("+" + newLine);
        }
        return builder.ToString();
    }
}
