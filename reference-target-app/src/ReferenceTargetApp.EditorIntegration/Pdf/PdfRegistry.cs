using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace ReferenceTargetApp.EditorIntegration.Pdf;

public sealed record PdfRegistryValidationError(string Code, string Message, string? ElementId = null);
public sealed record PdfRegistryValidationResult(IReadOnlyList<PdfRegistryValidationError> Errors)
{
    public bool Success => Errors.Count == 0;
}

public sealed class PdfRegistryValidationException(IReadOnlyList<PdfRegistryValidationError> errors)
    : Exception(string.Join("; ", errors.Select(error => $"{error.Code}: {error.Message}")))
{
    public IReadOnlyList<PdfRegistryValidationError> Errors { get; } = errors;
}

public static class PdfRegistryValidator
{
    private const double Epsilon = 0.000001;
    private static readonly IReadOnlyDictionary<PdfElementKind, PdfCapability> AllowedCapabilities =
        new Dictionary<PdfElementKind, PdfCapability>
        {
            [PdfElementKind.Document] = PdfCapability.None,
            [PdfElementKind.Page] = PdfCapability.None,
            [PdfElementKind.Area] = PdfCapability.None,
            [PdfElementKind.Header] = PdfCapability.Height,
            [PdfElementKind.Footer] = PdfCapability.Height,
            [PdfElementKind.Group] = PdfCapability.Position | PdfCapability.Width | PdfCapability.Height,
            [PdfElementKind.Text] = PdfCapability.Position | PdfCapability.Width | PdfCapability.Height | PdfCapability.TextPosition | PdfCapability.FontSize,
            [PdfElementKind.Image] = PdfCapability.Position | PdfCapability.Width | PdfCapability.Height,
            [PdfElementKind.Table] = PdfCapability.Position | PdfCapability.Width,
            [PdfElementKind.TableColumn] = PdfCapability.Width
        };

    public static PdfRegistryValidationResult Validate(PdfDocumentDefinition? document)
    {
        var errors = new List<PdfRegistryValidationError>();
        if (document is null) return new([new("pdf_registry_invalid", "PDF-Dokumentdefinition fehlt.")]);
        if (document.DocumentId != PdfRegistryIds.Scope || document.ApplicationId != PdfOrderDocumentRegistryFactory.ApplicationId ||
            document.DocumentType != PdfOrderDocumentRegistryFactory.DocumentType)
            errors.Add(new("pdf_registry_invalid", "Dokument-, App- oder Dokumenttyp-Zuordnung ist ungültig."));
        if (document.Unit != PdfLayoutUnit.Millimeter || document.PageFormat != PdfPageFormat.A4 ||
            document.Orientation != PdfPageOrientation.Portrait || !Same(document.PageTemplate.Width, 210) || !Same(document.PageTemplate.Height, 297))
            errors.Add(new("pdf_registry_invalid", "M76 erwartet A4 Hochformat mit Millimeter als Einheit."));

        var entries = document.RegisteredElements;
        var byId = new Dictionary<string, PdfElementDefinition>(StringComparer.Ordinal);
        foreach (var element in entries)
        {
            if (string.IsNullOrWhiteSpace(element.ElementId) || !element.ElementId.StartsWith("pdf.", StringComparison.Ordinal) ||
                element.ElementId.StartsWith("ui.", StringComparison.Ordinal) || string.IsNullOrWhiteSpace(element.Name) ||
                element.ScopeId != PdfRegistryIds.Scope)
                errors.Add(new("pdf_registry_invalid", "ID, Name oder Scope ist ungültig.", element.ElementId));
            if (!byId.TryAdd(element.ElementId, element)) errors.Add(new("pdf_registry_invalid", "Element-ID ist doppelt.", element.ElementId));
            if (!Enum.IsDefined(element.Kind) || !Enum.IsDefined(element.Role) || !Enum.IsDefined(element.PageArea))
                errors.Add(new("pdf_registry_invalid", "Elementart, Rolle oder Seitenbereich ist unbekannt.", element.ElementId));
            if (AllowedCapabilities.TryGetValue(element.Kind, out var allowed) && (element.Capabilities & ~allowed) != 0)
                errors.Add(new("pdf_registry_invalid", "Capability ist für die Elementart nicht erlaubt.", element.ElementId));
            if (element.Editable != (element.Capabilities != PdfCapability.None) || !element.Visible)
                errors.Add(new("pdf_registry_invalid", "visible/editable passt nicht zu den Capabilities.", element.ElementId));
            if (element.AllowedOperations.Intersect(element.LockedOperations, StringComparer.Ordinal).Any())
                errors.Add(new("pdf_registry_invalid", "Operation ist gleichzeitig erlaubt und gesperrt.", element.ElementId));
            ValidateBox(element, Zone(document.PageTemplate, element.PageArea), errors);
            if (element.Kind == PdfElementKind.TableColumn && string.IsNullOrWhiteSpace(element.ColumnRole))
                errors.Add(new("pdf_registry_invalid", "Tabellenspalte benötigt columnRole.", element.ElementId));
        }

        foreach (var element in entries)
        {
            if (element.Kind == PdfElementKind.Document)
            {
                if (element.ParentId is not null) errors.Add(new("pdf_registry_invalid", "Dokumentwurzel darf keinen Parent besitzen.", element.ElementId));
                continue;
            }
            if (string.IsNullOrWhiteSpace(element.ParentId) || !byId.TryGetValue(element.ParentId, out var parent))
                errors.Add(new("pdf_registry_invalid", "Parent fehlt oder ist unbekannt.", element.ElementId));
            else if (parent.ScopeId != element.ScopeId)
                errors.Add(new("pdf_registry_invalid", "Parent und Kind haben verschiedene Scopes.", element.ElementId));
        }
        ValidateCycles(byId, errors);

        foreach (var kind in new[] { PdfElementKind.Document, PdfElementKind.Page, PdfElementKind.Header, PdfElementKind.Footer,
                     PdfElementKind.Group, PdfElementKind.Text, PdfElementKind.Image, PdfElementKind.Table })
            if (!entries.Any(element => element.Kind == kind)) errors.Add(new("pdf_registry_invalid", $"Elementart {kind} fehlt."));
        var columns = entries.Where(element => element.Kind == PdfElementKind.TableColumn).OrderBy(element => element.StableOrder).ToArray();
        if (columns.Length < 6) errors.Add(new("pdf_registry_invalid", "Mindestens sechs Tabellenspalten sind erforderlich."));
        var table = entries.FirstOrDefault(element => element.Kind == PdfElementKind.Table);
        if (table is not null && columns.Sum(column => column.BaselineLayout.Width) > table.BaselineLayout.Width + Epsilon)
            errors.Add(new("pdf_invalid_table_width", "Spaltenbreiten überschreiten die Tabellenbreite.", table.ElementId));
        return new(errors);
    }

    private static void ValidateBox(PdfElementDefinition element, PdfBox zone, ICollection<PdfRegistryValidationError> errors)
    {
        var box = element.BaselineLayout;
        if (!Finite(box.X, box.Y, box.Width, box.Height) || box.Width <= 0 || box.Height <= 0 ||
            box.FontSize is <= 0 || box.TextOffsetX is < 0 || box.TextOffsetY is < 0)
            errors.Add(new("pdf_registry_invalid", "Baseline enthält ungültige Layoutwerte.", element.ElementId));
        if (box.X < zone.X - Epsilon || box.Y < zone.Y - Epsilon || box.X + box.Width > zone.X + zone.Width + Epsilon ||
            box.Y + box.Height > zone.Y + zone.Height + Epsilon)
            errors.Add(new("pdf_invalid_page_zone", "Baseline liegt außerhalb des zugewiesenen Seitenbereichs.", element.ElementId));
    }

    internal static PdfBox Zone(PdfPageDefinition page, PdfPageArea area) => area switch
    {
        PdfPageArea.Header => page.HeaderArea,
        PdfPageArea.Body => page.BodyArea,
        PdfPageArea.Footer => page.FooterArea,
        _ => new(0, 0, page.Width, page.Height)
    };

    private static void ValidateCycles(IReadOnlyDictionary<string, PdfElementDefinition> byId, ICollection<PdfRegistryValidationError> errors)
    {
        foreach (var element in byId.Values)
        {
            var visited = new HashSet<string>(StringComparer.Ordinal);
            var current = element;
            while (current.ParentId is not null && byId.TryGetValue(current.ParentId, out current!))
                if (!visited.Add(current.ElementId)) { errors.Add(new("pdf_registry_invalid", "Parent-Zyklus erkannt.", element.ElementId)); break; }
        }
    }

    private static bool Finite(params double[] values) => values.All(double.IsFinite);
    private static bool Same(double left, double right) => Math.Abs(left - right) <= Epsilon;
}

public static class PdfRegistryFingerprint
{
    public static string Create(PdfElementRegistry registry)
    {
        var canonical = string.Join("\n", registry.Entries.OrderBy(element => element.ElementId, StringComparer.Ordinal).Select(element =>
            string.Join("|", element.ElementId, element.ScopeId, element.ParentId ?? string.Empty, element.Kind, element.Role,
                string.Join(",", Enum.GetValues<PdfCapability>().Where(value => value != PdfCapability.None && element.Capabilities.HasFlag(value)).OrderBy(value => value)),
                element.PageArea, element.StableOrder.ToString(CultureInfo.InvariantCulture))));
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(canonical))).ToLowerInvariant();
    }
}
