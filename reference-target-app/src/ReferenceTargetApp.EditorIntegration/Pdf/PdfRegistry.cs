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
            [PdfElementKind.Page] = PdfCapability.PageMargins,
            [PdfElementKind.Area] = PdfCapability.None,
            [PdfElementKind.Header] = PdfCapability.Position | PdfCapability.Width | PdfCapability.Height | PdfCapability.Visibility,
            [PdfElementKind.Footer] = PdfCapability.Position | PdfCapability.Width | PdfCapability.Height | PdfCapability.Visibility,
            [PdfElementKind.Group] = PdfCapability.Position | PdfCapability.Width | PdfCapability.Height | PdfCapability.FontSize | PdfCapability.TextAlignment | PdfCapability.LineSpacing | PdfCapability.Visibility,
            [PdfElementKind.Text] = PdfCapability.Position | PdfCapability.Width | PdfCapability.Height | PdfCapability.TextPosition | PdfCapability.FontSize | PdfCapability.TextAlignment | PdfCapability.LineSpacing | PdfCapability.Visibility,
            [PdfElementKind.Label] = PdfCapability.Position | PdfCapability.Width | PdfCapability.Height | PdfCapability.TextPosition | PdfCapability.FontSize | PdfCapability.TextAlignment | PdfCapability.LineSpacing | PdfCapability.Visibility,
            [PdfElementKind.Value] = PdfCapability.Position | PdfCapability.Width | PdfCapability.Height | PdfCapability.TextPosition | PdfCapability.FontSize | PdfCapability.TextAlignment | PdfCapability.LineSpacing | PdfCapability.Visibility,
            [PdfElementKind.Image] = PdfCapability.Position | PdfCapability.Width | PdfCapability.Height | PdfCapability.Visibility,
            [PdfElementKind.Table] = PdfCapability.Position | PdfCapability.Width | PdfCapability.Visibility,
            [PdfElementKind.TableColumn] = PdfCapability.Position | PdfCapability.Width | PdfCapability.Visibility,
            [PdfElementKind.RepeatingArea] = PdfCapability.Position | PdfCapability.Width | PdfCapability.Height | PdfCapability.LineSpacing | PdfCapability.Visibility
        };

    public static PdfRegistryValidationResult Validate(PdfDocumentDefinition? document)
    {
        var errors = new List<PdfRegistryValidationError>();
        if (document is null) return new([new("pdf_registry_invalid", "PDF-Dokumentdefinition fehlt.")]);
        if (string.IsNullOrWhiteSpace(document.DocumentId) || !document.DocumentId.StartsWith("pdf.", StringComparison.Ordinal) ||
            string.IsNullOrWhiteSpace(document.ApplicationId) || string.IsNullOrWhiteSpace(document.DocumentType))
            errors.Add(new("pdf_registry_invalid", "Dokument-, App- oder Dokumenttyp-Zuordnung ist ungültig."));
        if (!Enum.IsDefined(document.LayoutModel))
            errors.Add(new("pdf_registry_invalid", "PDF-Layoutmodell ist unbekannt."));
        var fixedLayout = document.LayoutModel == PdfLayoutModel.FixedLayout;
        var expectedWidth = document.Orientation == PdfPageOrientation.Portrait ? 210 : 297;
        var expectedHeight = document.Orientation == PdfPageOrientation.Portrait ? 297 : 210;
        if (fixedLayout) ValidateFixedPage(document, errors);
        else if (document.Unit != PdfLayoutUnit.Millimeter || document.PageFormat != PdfPageFormat.A4 ||
            !Same(document.PageTemplate.Width, expectedWidth) || !Same(document.PageTemplate.Height, expectedHeight))
            errors.Add(new("pdf_registry_invalid", "M76 erwartet A4 mit zur Orientierung passender Seitengröße und Millimeter als Einheit."));

        var entries = document.RegisteredElements;
        var byId = new Dictionary<string, PdfElementDefinition>(StringComparer.Ordinal);
        foreach (var element in entries)
        {
            if (string.IsNullOrWhiteSpace(element.ElementId) || !element.ElementId.StartsWith("pdf.", StringComparison.Ordinal) ||
                element.ElementId.StartsWith("ui.", StringComparison.Ordinal) || string.IsNullOrWhiteSpace(element.Name) ||
                element.ScopeId != document.DocumentId)
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
            if (element.AllowedOperations.Contains(PdfLayoutOperations.ResizeColumnBoundary, StringComparer.Ordinal) &&
                (element.Kind != PdfElementKind.Table || element.BoundaryResizePolicy != PdfTableBoundaryResizePolicies.AdjacentPreserveTotal))
                errors.Add(new("pdf_registry_invalid", "Gekoppelte Spaltengrenzen benötigen eine Tabelle mit fester Gesamtsummenregel.", element.ElementId));
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

        if (fixedLayout) ValidateFixedTopology(document, byId, errors);
        var requiredKinds = fixedLayout
            ? new[] { PdfElementKind.Document, PdfElementKind.Page }
            : new[] { PdfElementKind.Document, PdfElementKind.Page, PdfElementKind.Header, PdfElementKind.Footer, PdfElementKind.Group, PdfElementKind.Table };
        foreach (var kind in requiredKinds)
            if (!entries.Any(element => element.Kind == kind)) errors.Add(new("pdf_registry_invalid", $"Elementart {kind} fehlt."));
        var columns = entries.Where(element => element.Kind == PdfElementKind.TableColumn).OrderBy(element => element.StableOrder).ToArray();
        if (!fixedLayout && columns.Length < 2) errors.Add(new("pdf_registry_invalid", "Mindestens zwei Tabellenspalten sind erforderlich."));
        foreach (var table in entries.Where(element => element.Kind == PdfElementKind.Table))
        {
            var tableColumns = columns.Where(column => column.ParentId == table.ElementId).ToArray();
            if (fixedLayout && tableColumns.Length < 2)
                errors.Add(new("pdf_registry_invalid", "Jede Tabelle benötigt mindestens zwei Tabellenspalten.", table.ElementId));
            if (tableColumns.Sum(column => column.BaselineLayout.Width) > table.BaselineLayout.Width + Epsilon)
            errors.Add(new("pdf_invalid_table_width", "Spaltenbreiten überschreiten die Tabellenbreite.", table.ElementId));
        }
        return new(errors);
    }

    private static void ValidateFixedPage(PdfDocumentDefinition document, ICollection<PdfRegistryValidationError> errors)
    {
        var width = document.PageTemplate.Width;
        var height = document.PageTemplate.Height;
        if (document.Unit != PdfLayoutUnit.Millimeter || !Enum.IsDefined(document.PageFormat) ||
            !Enum.IsDefined(document.Orientation) || !Finite(width, height) || width <= 0 || height <= 0)
            errors.Add(new("pdf_registry_invalid", "Fixed-layout benötigt ein gültiges Seitenformat, Orientierung und positive endliche Millimetermaße."));
        if (document.PageFormat == PdfPageFormat.Custom)
        {
            if (document.Orientation == PdfPageOrientation.Portrait && width > height ||
                document.Orientation == PdfPageOrientation.Landscape && height > width)
                errors.Add(new("pdf_registry_invalid", "Benutzerdefinierte Seitengröße passt nicht zur Orientierung."));
        }
        else
        {
            (double shortSide, double longSide) = document.PageFormat switch
            {
                PdfPageFormat.A0 => (841, 1189), PdfPageFormat.A1 => (594, 841),
                PdfPageFormat.A2 => (420, 594), PdfPageFormat.A3 => (297, 420),
                PdfPageFormat.A4 => (210, 297), PdfPageFormat.A5 => (148, 210),
                PdfPageFormat.A6 => (105, 148), _ => (0, 0)
            };
            var expectedWidth = document.Orientation == PdfPageOrientation.Portrait ? shortSide : longSide;
            var expectedHeight = document.Orientation == PdfPageOrientation.Portrait ? longSide : shortSide;
            if (!Same(width, expectedWidth) || !Same(height, expectedHeight))
                errors.Add(new("pdf_registry_invalid", "Seitengröße passt nicht zu Format und Orientierung."));
        }
        // Existing PdfBox margin storage is left/top/right/bottom in X/Y/Width/Height.
        var margins = document.Margins;
        if (!Finite(margins.X, margins.Y, margins.Width, margins.Height) ||
            margins.X < 0 || margins.Y < 0 || margins.Width < 0 || margins.Height < 0 ||
            margins.X + margins.Width >= width || margins.Y + margins.Height >= height)
            errors.Add(new("pdf_registry_invalid", "Seitenränder müssen endlich, nicht negativ sein und positive Nutzfläche belassen."));
    }

    private static void ValidateFixedTopology(PdfDocumentDefinition document,
        IReadOnlyDictionary<string, PdfElementDefinition> byId, ICollection<PdfRegistryValidationError> errors)
    {
        var roots = document.RegisteredElements.Where(element => element.Kind == PdfElementKind.Document).ToArray();
        var pages = document.RegisteredElements.Where(element => element.Kind == PdfElementKind.Page).ToArray();
        if (roots.Length != 1 || roots[0].ElementId != document.DocumentId || roots[0].ParentId is not null)
            errors.Add(new("pdf_registry_invalid", "Fixed-layout benötigt genau eine Dokumentwurzel mit der Scope-ID."));
        if (pages.Length != 1 || pages[0].ElementId != document.PageTemplate.PageId || pages[0].ParentId != document.DocumentId)
            errors.Add(new("pdf_registry_invalid", "Fixed-layout benötigt genau eine direkt untergeordnete Template-Seite."));
        foreach (var element in document.RegisteredElements)
        {
            if (element.Kind == PdfElementKind.TableColumn &&
                (element.ParentId is null || !byId.TryGetValue(element.ParentId, out var parent) || parent.Kind != PdfElementKind.Table))
                errors.Add(new("pdf_registry_invalid", "Tabellenspalte muss direkt zu einer Tabelle gehören.", element.ElementId));
            if (element.Kind is PdfElementKind.Document or PdfElementKind.Page) continue;
            var current = element;
            var visited = new HashSet<string>(StringComparer.Ordinal);
            while (current.ParentId is not null && visited.Add(current.ElementId) && byId.TryGetValue(current.ParentId, out var ancestor))
            {
                current = ancestor;
                if (current.Kind == PdfElementKind.Page) break;
            }
            if (current.Kind != PdfElementKind.Page || current.ElementId != document.PageTemplate.PageId)
                errors.Add(new("pdf_registry_invalid", "Element muss zur deklarierten Template-Seite gehören.", element.ElementId));
        }
    }

    private static void ValidateBox(PdfElementDefinition element, PdfBox zone, ICollection<PdfRegistryValidationError> errors)
    {
        var box = element.BaselineLayout;
        if (!Finite(box.X, box.Y, box.Width, box.Height) || box.Width <= 0 || box.Height <= 0 ||
            box.FontSize is <= 0 || box.TextOffsetX is < 0 || box.TextOffsetY is < 0 || box.LineSpacing is <= 0 ||
            box.TextAlignment is not null && box.TextAlignment is not ("left" or "center" or "right"))
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
                element.PageArea, element.StableOrder.ToString(CultureInfo.InvariantCulture), element.BoundaryResizePolicy ?? string.Empty)));
        if (registry.Document.LayoutModel == PdfLayoutModel.FixedLayout)
        {
            var document = registry.Document;
            var format = document.PageFormat == PdfPageFormat.Custom ? "custom" : document.PageFormat.ToString();
            canonical = string.Join("|", "fixed-layout", format, document.Orientation.ToString().ToLowerInvariant(),
                document.PageTemplate.Width.ToString(CultureInfo.InvariantCulture),
                document.PageTemplate.Height.ToString(CultureInfo.InvariantCulture)) + "\n" + canonical;
        }
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(canonical))).ToLowerInvariant();
    }
}
