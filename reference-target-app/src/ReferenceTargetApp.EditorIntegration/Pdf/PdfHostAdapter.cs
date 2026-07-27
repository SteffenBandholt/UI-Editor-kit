using System.Collections;
using System.Collections.ObjectModel;
using System.Globalization;

namespace ReferenceTargetApp.EditorIntegration.Pdf;

public static class PdfErrorCodes
{
    public const string RegistryInvalid = "pdf_registry_invalid";
    public const string UnknownElement = "pdf_unknown_element";
    public const string OperationNotAllowed = "pdf_operation_not_allowed";
    public const string InvalidNumber = "pdf_invalid_number";
    public const string OutOfPageBounds = "pdf_out_of_page_bounds";
    public const string InvalidPageZone = "pdf_invalid_page_zone";
    public const string InvalidTableWidth = "pdf_invalid_table_width";
    public const string InvalidColumnWidth = "pdf_invalid_column_width";
    public const string LayoutIncompatible = "pdf_layout_incompatible";
    public const string ProfileNotFound = "pdf_profile_not_found";
    public const string ProfileInvalid = "pdf_profile_invalid";
    public const string SaveFailed = "pdf_save_failed";
    public const string LoadFailed = "pdf_load_failed";
    public const string RenderFailed = "pdf_render_failed";
    public const string OutputWriteFailed = "pdf_output_write_failed";
    public const string BatchFailed = "pdf_batch_failed";
    public const string RollbackFailed = "pdf_rollback_failed";
}

public sealed class PdfChangeRequest
{
    public PdfChangeRequest(string changeId, string elementId, string operation,
        IReadOnlyDictionary<string, object?>? payload, DateTimeOffset createdAt, string source, string scopeId)
    {
        ChangeId = changeId;
        ElementId = elementId;
        Operation = operation;
        Payload = payload is null ? null : new ReadOnlyDictionary<string, object?>(payload.ToDictionary(pair => pair.Key, pair => Copy(pair.Value), StringComparer.Ordinal));
        CreatedAt = createdAt;
        Source = source;
        ScopeId = scopeId;
    }

    public string ChangeId { get; }
    public string ElementId { get; }
    public string Operation { get; }
    public IReadOnlyDictionary<string, object?>? Payload { get; }
    public DateTimeOffset CreatedAt { get; }
    public string Source { get; }
    public string ScopeId { get; }

    private static object? Copy(object? value) => value switch
    {
        IReadOnlyDictionary<string, object?> dictionary => new ReadOnlyDictionary<string, object?>(dictionary.ToDictionary(pair => pair.Key, pair => Copy(pair.Value), StringComparer.Ordinal)),
        IDictionary<string, object?> dictionary => new ReadOnlyDictionary<string, object?>(dictionary.ToDictionary(pair => pair.Key, pair => Copy(pair.Value), StringComparer.Ordinal)),
        IEnumerable sequence when value is not string => new ReadOnlyCollection<object?>(sequence.Cast<object?>().Select(Copy).ToList()),
        _ => value
    };
}

public sealed record PdfChangeResult(
    bool Success,
    string ChangeId,
    string ElementId,
    string Operation,
    string? ErrorCode,
    string Message,
    PdfElementLayoutState? PreviousState,
    PdfElementLayoutState? NewState,
    bool RollbackSucceeded)
{
    public static PdfChangeResult Reject(PdfChangeRequest? request, string code, string message) =>
        new(false, request?.ChangeId ?? string.Empty, request?.ElementId ?? string.Empty, request?.Operation ?? string.Empty,
            code, message, null, null, true);
}

public interface IPdfHostAdapter
{
    PdfElementRegistry GetRegistry();
    PdfLayoutState GetCurrentLayoutState();
    PdfChangeResult SubmitChangeRequest(PdfChangeRequest request);
}

public interface IAsyncPdfHostAdapter : IPdfHostAdapter
{
    Task<PdfChangeResult> SubmitChangeRequestAsync(PdfChangeRequest request, CancellationToken cancellationToken = default);
}

public sealed class PdfHostAdapter : IPdfHostAdapter
{
    private const double Epsilon = 0.000001;
    private readonly PdfElementRegistry registry;
    private readonly Dictionary<string, PdfBox> current;

    public PdfHostAdapter(PdfElementRegistry registry)
    {
        this.registry = registry ?? throw new ArgumentNullException(nameof(registry));
        current = registry.Entries.ToDictionary(element => element.ElementId, element => element.BaselineLayout, StringComparer.Ordinal);
    }

    public PdfElementRegistry GetRegistry() => registry;

    public PdfLayoutState GetCurrentLayoutState() => new(PdfRegistryIds.Scope, DateTimeOffset.UtcNow,
        registry.Entries.OrderBy(element => element.StableOrder).Select(element => PdfLayoutStateFactory.FromBox(element, current[element.ElementId])).ToArray());

    public PdfChangeResult SubmitChangeRequest(PdfChangeRequest request)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.ChangeId) || string.IsNullOrWhiteSpace(request.ElementId) ||
            string.IsNullOrWhiteSpace(request.Operation) || string.IsNullOrWhiteSpace(request.Source) || request.CreatedAt == default)
            return PdfChangeResult.Reject(request, PdfErrorCodes.ProfileInvalid, "PDF-Änderungsauftrag ist unvollständig.");
        var element = registry.FindById(request.ElementId);
        if (element is null) return PdfChangeResult.Reject(request, PdfErrorCodes.UnknownElement, "PDF-Element ist nicht registriert.");
        if (request.ScopeId != PdfRegistryIds.Scope || element.ScopeId != request.ScopeId)
            return PdfChangeResult.Reject(request, PdfErrorCodes.LayoutIncompatible, "PDF-Scope passt nicht zum Element.");
        var required = RequiredCapability(request.Operation);
        if (required is null || !element.Capabilities.HasFlag(required.Value))
            return PdfChangeResult.Reject(request, PdfErrorCodes.OperationNotAllowed, "PDF-Operation ist für dieses Element nicht erlaubt.");
        if (request.Payload is null) return PdfChangeResult.Reject(request, PdfErrorCodes.InvalidNumber, "PDF-Payload fehlt.");

        var previousBox = current[element.ElementId];
        var previousState = PdfLayoutStateFactory.FromBox(element, previousBox);
        var parsed = Parse(request, element, previousBox);
        if (!parsed.Success) return PdfChangeResult.Reject(request, parsed.Code!, parsed.Message!);
        var validation = ValidateCandidate(element, parsed.Box!);
        if (validation is not null) return PdfChangeResult.Reject(request, validation.Value.Code, validation.Value.Message);

        current[element.ElementId] = parsed.Box!;
        try
        {
            var newState = PdfLayoutStateFactory.FromBox(element, current[element.ElementId]);
            return new(true, request.ChangeId, request.ElementId, request.Operation, null, "PDF-Layoutänderung angewandt.", previousState, newState, true);
        }
        catch (Exception exception) when (exception is InvalidOperationException or ArgumentException)
        {
            current[element.ElementId] = previousBox;
            return new(false, request.ChangeId, request.ElementId, request.Operation, PdfErrorCodes.BatchFailed,
                $"PDF-Layoutänderung fehlgeschlagen: {exception.Message}", previousState, previousState, true);
        }
    }

    private ParseResult Parse(PdfChangeRequest request, PdfElementDefinition element, PdfBox currentBox)
    {
        var payload = request.Payload!;
        if (ContainsForbiddenFields(payload)) return ParseResult.Fail(PdfErrorCodes.ProfileInvalid, "Payload enthält Fach- oder Dateidaten.");
        return request.Operation switch
        {
            PdfLayoutOperations.Move when Only(payload, "x", "y") && (payload.ContainsKey("x") || payload.ContainsKey("y")) &&
                Optional(payload, "x", out var x) && Optional(payload, "y", out var y) => ParseResult.Ok(currentBox with { X = x ?? currentBox.X, Y = y ?? currentBox.Y }),
            PdfLayoutOperations.ResizeWidth when Only(payload, "width") && Required(payload, "width", out var width) && width > 0 => ParseResult.Ok(currentBox with { Width = width }),
            PdfLayoutOperations.ResizeHeight when Only(payload, "height") && Required(payload, "height", out var height) && height > 0 => ParseResult.Ok(currentBox with { Height = height }),
            PdfLayoutOperations.Resize when Only(payload, "width", "height") && (payload.ContainsKey("width") || payload.ContainsKey("height")) &&
                Optional(payload, "width", out var rw) && Optional(payload, "height", out var rh) && rw is null or > 0 && rh is null or > 0 &&
                (rw is null || element.Capabilities.HasFlag(PdfCapability.Width)) && (rh is null || element.Capabilities.HasFlag(PdfCapability.Height)) =>
                ParseResult.Ok(currentBox with { Width = rw ?? currentBox.Width, Height = rh ?? currentBox.Height }),
            PdfLayoutOperations.TextMove when Only(payload, "text") && Dictionary(payload, "text", out var text) &&
                Only(text, "offsetX", "offsetY") && (text.ContainsKey("offsetX") || text.ContainsKey("offsetY")) &&
                Optional(text, "offsetX", out var ox) && Optional(text, "offsetY", out var oy) && ox is null or >= 0 && oy is null or >= 0 =>
                ParseResult.Ok(currentBox with { TextOffsetX = ox ?? currentBox.TextOffsetX ?? 0, TextOffsetY = oy ?? currentBox.TextOffsetY ?? 0 }),
            PdfLayoutOperations.TextResize when Only(payload, "text") && Dictionary(payload, "text", out var size) &&
                Only(size, "fontSize") && Required(size, "fontSize", out var font) && font is > 0 and <= 25 => ParseResult.Ok(currentBox with { FontSize = font }),
            _ => ParseResult.Fail(PdfErrorCodes.InvalidNumber, "PDF-Payload enthält ungültige, nicht endliche oder nicht erlaubte Werte.")
        };
    }

    private (string Code, string Message)? ValidateCandidate(PdfElementDefinition element, PdfBox box)
    {
        if (!Finite(box.X, box.Y, box.Width, box.Height) || box.Width <= 0 || box.Height <= 0 || box.FontSize is <= 0)
            return (PdfErrorCodes.InvalidNumber, "PDF-Layoutwerte müssen endlich und positiv sein.");
        var page = registry.Document.PageTemplate;
        if (box.X < -Epsilon || box.Y < -Epsilon || box.X + box.Width > page.Width + Epsilon || box.Y + box.Height > page.Height + Epsilon)
            return (PdfErrorCodes.OutOfPageBounds, "PDF-Element überschreitet die Seitengrenze.");
        var zone = element.Kind == PdfElementKind.Header
            ? new PdfBox(page.HeaderArea.X, page.HeaderArea.Y, page.HeaderArea.Width, page.BodyArea.Y - page.HeaderArea.Y)
            : PdfRegistryValidator.Zone(page, element.PageArea);
        if (box.X < zone.X - Epsilon || box.Y < zone.Y - Epsilon || box.X + box.Width > zone.X + zone.Width + Epsilon ||
            box.Y + box.Height > zone.Y + zone.Height + Epsilon)
            return (PdfErrorCodes.InvalidPageZone, "PDF-Element verlässt seinen Seitenbereich.");
        if (box.TextOffsetX is < 0 || box.TextOffsetY is < 0 || box.TextOffsetX >= box.Width || box.TextOffsetY >= box.Height)
            return (PdfErrorCodes.InvalidPageZone, "Textposition liegt außerhalb des Elements.");

        if (element.Kind == PdfElementKind.TableColumn)
        {
            if (box.Width < 5) return (PdfErrorCodes.InvalidColumnWidth, "PDF-Spaltenbreite muss mindestens 5 mm betragen.");
            var tableWidth = current[PdfRegistryIds.Table].Width;
            var sum = PdfRegistryIds.Columns.Sum(id => id == element.ElementId ? box.Width : current[id].Width);
            if (sum > tableWidth + Epsilon) return (PdfErrorCodes.InvalidTableWidth, "Spaltensumme überschreitet die Tabellenbreite.");
        }
        if (element.Kind == PdfElementKind.Table)
        {
            var sum = PdfRegistryIds.Columns.Sum(id => current[id].Width);
            if (sum > box.Width + Epsilon) return (PdfErrorCodes.InvalidTableWidth, "Tabellenbreite ist kleiner als die Spaltensumme.");
        }
        if (element.Kind is PdfElementKind.Header or PdfElementKind.Footer && !DescendantsFit(element, box))
            return (PdfErrorCodes.InvalidPageZone, "Bereichshöhe würde registrierte Kinder abschneiden.");
        return null;
    }

    private bool DescendantsFit(PdfElementDefinition parent, PdfBox candidate)
    {
        var descendants = registry.Entries.Where(entry => IsDescendantOf(entry, parent.ElementId));
        return descendants.All(entry =>
        {
            var box = current[entry.ElementId];
            return box.Y >= candidate.Y - Epsilon && box.Y + box.Height <= candidate.Y + candidate.Height + Epsilon;
        });
    }

    private bool IsDescendantOf(PdfElementDefinition element, string parentId)
    {
        var currentElement = element;
        while (currentElement.ParentId is not null)
        {
            if (currentElement.ParentId == parentId) return true;
            currentElement = registry.FindById(currentElement.ParentId)!;
        }
        return false;
    }

    private static PdfCapability? RequiredCapability(string operation) => operation switch
    {
        PdfLayoutOperations.Move => PdfCapability.Position,
        PdfLayoutOperations.ResizeWidth => PdfCapability.Width,
        PdfLayoutOperations.ResizeHeight => PdfCapability.Height,
        PdfLayoutOperations.Resize => PdfCapability.Width | PdfCapability.Height,
        PdfLayoutOperations.TextMove => PdfCapability.TextPosition,
        PdfLayoutOperations.TextResize => PdfCapability.FontSize,
        _ => null
    };

    private static bool ContainsForbiddenFields(IReadOnlyDictionary<string, object?> payload)
    {
        var forbidden = new HashSet<string>(["businessData", "customer", "order", "orderNumber", "positions", "price", "filePath", "fileName", "command", "action"], StringComparer.OrdinalIgnoreCase);
        return payload.Any(pair => forbidden.Contains(pair.Key) || pair.Value is IReadOnlyDictionary<string, object?> nested && ContainsForbiddenFields(nested));
    }

    private static bool Only(IReadOnlyDictionary<string, object?> values, params string[] names) => values.Keys.All(new HashSet<string>(names, StringComparer.Ordinal).Contains);
    private static bool Dictionary(IReadOnlyDictionary<string, object?> source, string key, out IReadOnlyDictionary<string, object?> value)
    { if (source.TryGetValue(key, out var raw) && raw is IReadOnlyDictionary<string, object?> dictionary) { value = dictionary; return true; } value = null!; return false; }
    private static bool Required(IReadOnlyDictionary<string, object?> source, string key, out double value)
    { value = 0; return source.TryGetValue(key, out var raw) && Number(raw, out value); }
    private static bool Optional(IReadOnlyDictionary<string, object?> source, string key, out double? value)
    { value = null; if (!source.TryGetValue(key, out var raw)) return true; if (!Number(raw, out var number)) return false; value = number; return true; }
    private static bool Number(object? raw, out double value)
    { value = 0; if (raw is null or bool or char or string || raw is not IConvertible) return false; try { value = Convert.ToDouble(raw, CultureInfo.InvariantCulture); return double.IsFinite(value); } catch { return false; } }
    private static bool Finite(params double[] values) => values.All(double.IsFinite);

    private sealed record ParseResult(bool Success, PdfBox? Box, string? Code, string? Message)
    { public static ParseResult Ok(PdfBox box) => new(true, box, null, null); public static ParseResult Fail(string code, string message) => new(false, null, code, message); }
}
