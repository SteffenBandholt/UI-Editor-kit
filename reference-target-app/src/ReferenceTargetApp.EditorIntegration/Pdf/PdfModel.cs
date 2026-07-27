using System.Collections.ObjectModel;

namespace ReferenceTargetApp.EditorIntegration.Pdf;

public enum PdfLayoutUnit { Millimeter }
public enum PdfPageFormat { A4 }
public enum PdfPageOrientation { Portrait, Landscape }
public enum PdfPageArea { Document, Header, Body, Footer }
public enum PdfElementKind { Document, Page, Area, Group, Text, Label, Value, Image, Table, TableColumn, RepeatingArea, Header, Footer }
public enum PdfElementRole { Layout, Content, Meta, Structure, Date, FieldLabel, Heading, ColumnHeader }

[Flags]
public enum PdfCapability
{
    None = 0,
    Position = 1,
    Width = 2,
    Height = 4,
    TextPosition = 8,
    FontSize = 16,
    TextAlignment = 32,
    LineSpacing = 64,
    Visibility = 128,
    PageMargins = 256
}

public static class PdfLayoutOperations
{
    public const string Inspect = "inspect";
    public const string Move = "move";
    public const string Resize = "resize";
    public const string ResizeWidth = "resizeWidth";
    public const string ResizeHeight = "resizeHeight";
    public const string TextMove = "textMove";
    public const string TextResize = "textResize";
    public const string SetTextAlignment = "setTextAlignment";
    public const string SetLineSpacing = "setLineSpacing";
    public const string SetVisibility = "setVisibility";
    public const string SetPageMargins = "setPageMargins";

    public static readonly IReadOnlyList<string> Mutating =
        [Move, Resize, ResizeWidth, ResizeHeight, TextMove, TextResize, SetTextAlignment, SetLineSpacing, SetVisibility, SetPageMargins];
}

public sealed record PdfBox(
    double X,
    double Y,
    double Width,
    double Height,
    double? TextOffsetX = null,
    double? TextOffsetY = null,
    double? FontSize = null,
    string? TextAlignment = null,
    double? LineSpacing = null,
    bool? Visible = null,
    double? MarginTop = null,
    double? MarginRight = null,
    double? MarginBottom = null,
    double? MarginLeft = null);

public sealed record PdfLayoutBounds(
    double MinX, double MaxX, double MinY, double MaxY,
    double MinWidth, double MaxWidth, double MinHeight, double MaxHeight);

public sealed record PdfPageDefinition(
    string PageId,
    double Width,
    double Height,
    PdfBox ContentBounds,
    PdfBox HeaderArea,
    PdfBox BodyArea,
    PdfBox FooterArea);

public sealed record PdfElementDefinition(
    string ElementId,
    string Name,
    string ScopeId,
    string? ParentId,
    PdfElementKind Kind,
    PdfElementRole Role,
    PdfCapability Capabilities,
    PdfPageArea PageArea,
    PdfBox BaselineLayout,
    int StableOrder,
    bool Visible,
    bool Editable,
    IReadOnlyList<string> AllowedOperations,
    IReadOnlyList<string> LockedOperations,
    string? ColumnRole = null,
    string? RefKey = null,
    string? RendererKey = null,
    PdfLayoutBounds? LayoutBounds = null);

public sealed class PdfDocumentDefinition
{
    public PdfDocumentDefinition(
        string documentId,
        string applicationId,
        string documentType,
        PdfPageFormat pageFormat,
        PdfPageOrientation orientation,
        PdfLayoutUnit unit,
        PdfBox margins,
        string defaultFont,
        PdfPageDefinition pageTemplate,
        IEnumerable<PdfElementDefinition> registeredElements)
    {
        DocumentId = documentId;
        ApplicationId = applicationId;
        DocumentType = documentType;
        PageFormat = pageFormat;
        Orientation = orientation;
        Unit = unit;
        Margins = margins;
        DefaultFont = defaultFont;
        PageTemplate = pageTemplate;
        RegisteredElements = new ReadOnlyCollection<PdfElementDefinition>(registeredElements.ToArray());
    }

    public string DocumentId { get; }
    public string ApplicationId { get; }
    public string DocumentType { get; }
    public PdfPageFormat PageFormat { get; }
    public PdfPageOrientation Orientation { get; }
    public PdfLayoutUnit Unit { get; }
    public PdfBox Margins { get; }
    public string DefaultFont { get; }
    public PdfPageDefinition PageTemplate { get; }
    public IReadOnlyList<PdfElementDefinition> RegisteredElements { get; }
}

public sealed class PdfElementRegistry
{
    private readonly IReadOnlyDictionary<string, PdfElementDefinition> byId;

    public PdfElementRegistry(PdfDocumentDefinition document)
    {
        Document = document ?? throw new ArgumentNullException(nameof(document));
        var validation = PdfRegistryValidator.Validate(document);
        if (!validation.Success) throw new PdfRegistryValidationException(validation.Errors);
        byId = document.RegisteredElements.ToDictionary(element => element.ElementId, StringComparer.Ordinal);
    }

    public PdfDocumentDefinition Document { get; }
    public IReadOnlyList<PdfElementDefinition> Entries => Document.RegisteredElements;
    public PdfElementDefinition? FindById(string elementId) => byId.GetValueOrDefault(elementId);
}

public sealed record PdfElementLayoutState(
    string ElementId,
    string ScopeId,
    double? X,
    double? Y,
    double? Width,
    double? Height,
    double? TextOffsetX,
    double? TextOffsetY,
    double? FontSize,
    string? TextAlignment = null,
    double? LineSpacing = null,
    bool? Visible = null,
    double? MarginTop = null,
    double? MarginRight = null,
    double? MarginBottom = null,
    double? MarginLeft = null);

public sealed class PdfLayoutState
{
    public PdfLayoutState(string scopeId, DateTimeOffset capturedAt, IReadOnlyList<PdfElementLayoutState> elements)
    {
        ScopeId = scopeId;
        CapturedAt = capturedAt;
        Elements = new ReadOnlyCollection<PdfElementLayoutState>(elements.ToArray());
    }

    public string ScopeId { get; }
    public DateTimeOffset CapturedAt { get; }
    public IReadOnlyList<PdfElementLayoutState> Elements { get; }
}

public static class PdfLayoutStateFactory
{
    public static PdfLayoutState Baseline(PdfElementRegistry registry) => new(
        registry.Document.DocumentId,
        DateTimeOffset.UtcNow,
        registry.Entries.OrderBy(element => element.StableOrder).Select(element => FromBox(element, element.BaselineLayout)).ToArray());

    public static PdfElementLayoutState FromBox(PdfElementDefinition element, PdfBox box) => new(
        element.ElementId,
        element.ScopeId,
        element.Capabilities.HasFlag(PdfCapability.Position) ? box.X : null,
        element.Capabilities.HasFlag(PdfCapability.Position) ? box.Y : null,
        element.Capabilities.HasFlag(PdfCapability.Width) ? box.Width : null,
        element.Capabilities.HasFlag(PdfCapability.Height) ? box.Height : null,
        element.Capabilities.HasFlag(PdfCapability.TextPosition) ? box.TextOffsetX ?? 0 : null,
        element.Capabilities.HasFlag(PdfCapability.TextPosition) ? box.TextOffsetY ?? 0 : null,
        element.Capabilities.HasFlag(PdfCapability.FontSize) ? box.FontSize : null,
        element.Capabilities.HasFlag(PdfCapability.TextAlignment) ? box.TextAlignment ?? "left" : null,
        element.Capabilities.HasFlag(PdfCapability.LineSpacing) ? box.LineSpacing ?? 1 : null,
        element.Capabilities.HasFlag(PdfCapability.Visibility) ? box.Visible ?? true : null,
        element.Capabilities.HasFlag(PdfCapability.PageMargins) ? box.MarginTop ?? 0 : null,
        element.Capabilities.HasFlag(PdfCapability.PageMargins) ? box.MarginRight ?? 0 : null,
        element.Capabilities.HasFlag(PdfCapability.PageMargins) ? box.MarginBottom ?? 0 : null,
        element.Capabilities.HasFlag(PdfCapability.PageMargins) ? box.MarginLeft ?? 0 : null);

    public static PdfBox Resolve(PdfElementDefinition element, PdfElementLayoutState state) => new(
        state.X ?? element.BaselineLayout.X,
        state.Y ?? element.BaselineLayout.Y,
        state.Width ?? element.BaselineLayout.Width,
        state.Height ?? element.BaselineLayout.Height,
        state.TextOffsetX ?? element.BaselineLayout.TextOffsetX,
        state.TextOffsetY ?? element.BaselineLayout.TextOffsetY,
        state.FontSize ?? element.BaselineLayout.FontSize,
        state.TextAlignment ?? element.BaselineLayout.TextAlignment,
        state.LineSpacing ?? element.BaselineLayout.LineSpacing,
        state.Visible ?? element.BaselineLayout.Visible,
        state.MarginTop ?? element.BaselineLayout.MarginTop,
        state.MarginRight ?? element.BaselineLayout.MarginRight,
        state.MarginBottom ?? element.BaselineLayout.MarginBottom,
        state.MarginLeft ?? element.BaselineLayout.MarginLeft);
}

public static class PdfRegistryIds
{
    public const string Scope = "pdf.order-document";
    public const string Page = Scope + ".page-template";
    public const string Header = Scope + ".header";
    public const string HeaderIdentity = Header + ".identity";
    public const string Logo = Header + ".logo";
    public const string Sender = Header + ".sender";
    public const string Title = Header + ".title";
    public const string Number = Header + ".number";
    public const string Date = Header + ".date";
    public const string Customer = Header + ".customer";
    public const string CustomerAddress = Customer + ".address";
    public const string Body = Scope + ".body";
    public const string Table = Body + ".positions";
    public const string PositionColumn = Table + ".column.position";
    public const string DescriptionColumn = Table + ".column.description";
    public const string QuantityColumn = Table + ".column.quantity";
    public const string UnitColumn = Table + ".column.unit";
    public const string UnitPriceColumn = Table + ".column.unit-price";
    public const string TotalPriceColumn = Table + ".column.total-price";
    public const string Summary = Body + ".summary";
    public const string Subtotal = Summary + ".subtotal";
    public const string Tax = Summary + ".tax";
    public const string Total = Summary + ".total";
    public const string Footer = Scope + ".footer";
    public const string FooterContact = Footer + ".contact";
    public const string PageNumber = Footer + ".page-number";

    public static readonly IReadOnlyList<string> Columns =
        [PositionColumn, DescriptionColumn, QuantityColumn, UnitColumn, UnitPriceColumn, TotalPriceColumn];
}

public static class PdfOrderDocumentRegistryFactory
{
    public const string ApplicationId = "reference-target-app";
    public const string DocumentType = "order-document";

    public static PdfElementRegistry Create()
    {
        var page = new PdfPageDefinition(PdfRegistryIds.Page, 210, 297,
            new(15, 15, 180, 267), new(15, 15, 180, 45), new(15, 65, 180, 187), new(15, 262, 180, 20));
        var entries = new[]
        {
            E(PdfRegistryIds.Scope, "Auftragsdokument", null, PdfElementKind.Document, PdfElementRole.Layout, PdfCapability.None, PdfPageArea.Document, new(0,0,210,297), 0),
            E(PdfRegistryIds.Page, "A4-Seitentemplate", PdfRegistryIds.Scope, PdfElementKind.Page, PdfElementRole.Layout, PdfCapability.None, PdfPageArea.Document, new(0,0,210,297), 10),
            E(PdfRegistryIds.Header, "Kopfbereich", PdfRegistryIds.Page, PdfElementKind.Header, PdfElementRole.Layout, PdfCapability.Height, PdfPageArea.Header, new(15,15,180,45), 20),
            E(PdfRegistryIds.HeaderIdentity, "Absendergruppe", PdfRegistryIds.Header, PdfElementKind.Group, PdfElementRole.Layout, Pwh, PdfPageArea.Header, new(15,15,105,26), 30),
            E(PdfRegistryIds.Logo, "Firmenlogo", PdfRegistryIds.HeaderIdentity, PdfElementKind.Image, PdfElementRole.Content, Pwh, PdfPageArea.Header, new(15,17,18,18), 40),
            E(PdfRegistryIds.Sender, "Absender und Firmendaten", PdfRegistryIds.HeaderIdentity, PdfElementKind.Text, PdfElementRole.Content, Text, PdfPageArea.Header, new(37,17,80,18,1,1,3.1), 50),
            E(PdfRegistryIds.Title, "Dokumenttitel", PdfRegistryIds.Header, PdfElementKind.Text, PdfElementRole.Content, Text, PdfPageArea.Header, new(125,17,60,10,0,0,5), 60),
            E(PdfRegistryIds.Number, "Dokumentnummer", PdfRegistryIds.Header, PdfElementKind.Text, PdfElementRole.Meta, Text, PdfPageArea.Header, new(125,30,60,6,0,0,3.3), 70),
            E(PdfRegistryIds.Date, "Dokumentdatum", PdfRegistryIds.Header, PdfElementKind.Text, PdfElementRole.Date, Text, PdfPageArea.Header, new(125,38,60,6,0,0,3.3), 80),
            E(PdfRegistryIds.Customer, "Kundendatenblock", PdfRegistryIds.Header, PdfElementKind.Group, PdfElementRole.Content, Pwh, PdfPageArea.Header, new(15,43,100,17), 90),
            E(PdfRegistryIds.CustomerAddress, "Kundenanschrift", PdfRegistryIds.Customer, PdfElementKind.Text, PdfElementRole.Content, Text, PdfPageArea.Header, new(15,44,95,15,1,1,3.1), 100),
            E(PdfRegistryIds.Body, "Inhaltsbereich", PdfRegistryIds.Page, PdfElementKind.Area, PdfElementRole.Layout, PdfCapability.None, PdfPageArea.Body, new(15,65,180,187), 110),
            E(PdfRegistryIds.Table, "Positionstabelle", PdfRegistryIds.Body, PdfElementKind.Table, PdfElementRole.Content, PdfCapability.Position | PdfCapability.Width, PdfPageArea.Body, new(15,68,180,180), 120),
            E(PdfRegistryIds.PositionColumn, "Positionsnummer", PdfRegistryIds.Table, PdfElementKind.TableColumn, PdfElementRole.Structure, PdfCapability.Width, PdfPageArea.Body, new(15,68,14,180), 130, "structureColumn"),
            E(PdfRegistryIds.DescriptionColumn, "Beschreibung", PdfRegistryIds.Table, PdfElementKind.TableColumn, PdfElementRole.Content, PdfCapability.Width, PdfPageArea.Body, new(29,68,70,180), 140, "contentColumn"),
            E(PdfRegistryIds.QuantityColumn, "Menge", PdfRegistryIds.Table, PdfElementKind.TableColumn, PdfElementRole.Meta, PdfCapability.Width, PdfPageArea.Body, new(99,68,18,180), 150, "metaColumn"),
            E(PdfRegistryIds.UnitColumn, "Einheit", PdfRegistryIds.Table, PdfElementKind.TableColumn, PdfElementRole.Meta, PdfCapability.Width, PdfPageArea.Body, new(117,68,18,180), 160, "metaColumn"),
            E(PdfRegistryIds.UnitPriceColumn, "Einzelpreis", PdfRegistryIds.Table, PdfElementKind.TableColumn, PdfElementRole.Content, PdfCapability.Width, PdfPageArea.Body, new(135,68,28,180), 170, "contentColumn"),
            E(PdfRegistryIds.TotalPriceColumn, "Gesamtpreis", PdfRegistryIds.Table, PdfElementKind.TableColumn, PdfElementRole.Content, PdfCapability.Width, PdfPageArea.Body, new(163,68,32,180), 180, "contentColumn"),
            E(PdfRegistryIds.Summary, "Summenbereich", PdfRegistryIds.Body, PdfElementKind.Group, PdfElementRole.Content, Pwh, PdfPageArea.Body, new(120,225,75,22), 190),
            E(PdfRegistryIds.Subtotal, "Zwischensumme", PdfRegistryIds.Summary, PdfElementKind.Text, PdfElementRole.Content, Text, PdfPageArea.Body, new(120,225,75,6,0,0,3.3), 200),
            E(PdfRegistryIds.Tax, "Steuer", PdfRegistryIds.Summary, PdfElementKind.Text, PdfElementRole.Content, Text, PdfPageArea.Body, new(120,232,75,6,0,0,3.3), 210),
            E(PdfRegistryIds.Total, "Gesamtsumme", PdfRegistryIds.Summary, PdfElementKind.Text, PdfElementRole.Content, Text, PdfPageArea.Body, new(120,239,75,8,0,0,4), 220),
            E(PdfRegistryIds.Footer, "Fussbereich", PdfRegistryIds.Page, PdfElementKind.Footer, PdfElementRole.Layout, PdfCapability.Height, PdfPageArea.Footer, new(15,262,180,20), 230),
            E(PdfRegistryIds.FooterContact, "Firmen- und Kontaktzeile", PdfRegistryIds.Footer, PdfElementKind.Text, PdfElementRole.Content, Text, PdfPageArea.Footer, new(15,269,135,6,0,0,2.8), 240),
            E(PdfRegistryIds.PageNumber, "Seitenzahl", PdfRegistryIds.Footer, PdfElementKind.Text, PdfElementRole.Meta, Text, PdfPageArea.Footer, new(165,269,30,6,0,0,2.8), 250)
        };
        return new(new(PdfRegistryIds.Scope, ApplicationId, DocumentType, PdfPageFormat.A4,
            PdfPageOrientation.Portrait, PdfLayoutUnit.Millimeter, new(15,15,15,15), "Arial", page, entries));
    }

    private const PdfCapability Pwh = PdfCapability.Position | PdfCapability.Width | PdfCapability.Height;
    private const PdfCapability Text = Pwh | PdfCapability.TextPosition | PdfCapability.FontSize;

    private static PdfElementDefinition E(string id, string name, string? parent, PdfElementKind kind, PdfElementRole role,
        PdfCapability capabilities, PdfPageArea area, PdfBox baseline, int order, string? columnRole = null)
    {
        var allowed = new List<string> { PdfLayoutOperations.Inspect };
        if (capabilities.HasFlag(PdfCapability.Position)) allowed.Add(PdfLayoutOperations.Move);
        if (capabilities.HasFlag(PdfCapability.Width)) allowed.Add(PdfLayoutOperations.ResizeWidth);
        if (capabilities.HasFlag(PdfCapability.Height)) allowed.Add(PdfLayoutOperations.ResizeHeight);
        if (capabilities.HasFlag(PdfCapability.Width) && capabilities.HasFlag(PdfCapability.Height)) allowed.Add(PdfLayoutOperations.Resize);
        if (capabilities.HasFlag(PdfCapability.TextPosition)) allowed.Add(PdfLayoutOperations.TextMove);
        if (capabilities.HasFlag(PdfCapability.FontSize)) allowed.Add(PdfLayoutOperations.TextResize);
        if (capabilities.HasFlag(PdfCapability.TextAlignment)) allowed.Add(PdfLayoutOperations.SetTextAlignment);
        if (capabilities.HasFlag(PdfCapability.LineSpacing)) allowed.Add(PdfLayoutOperations.SetLineSpacing);
        if (capabilities.HasFlag(PdfCapability.Visibility)) allowed.Add(PdfLayoutOperations.SetVisibility);
        if (capabilities.HasFlag(PdfCapability.PageMargins)) allowed.Add(PdfLayoutOperations.SetPageMargins);
        var locked = PdfLayoutOperations.Mutating.Where(operation => !allowed.Contains(operation, StringComparer.Ordinal)).ToArray();
        return new(id, name, PdfRegistryIds.Scope, parent, kind, role, capabilities, area, baseline, order,
            true, capabilities != PdfCapability.None, allowed, locked, columnRole);
    }
}
