using System.Globalization;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using ReferenceTargetApp.EditorIntegration.Electron;
using ReferenceTargetApp.EditorIntegration.Pdf;

namespace ReferenceTargetApp.Tests;

[TestClass]
public sealed class PdfFixedLayoutContractTests
{
    private const string Scope = "pdf.overlay-sheet";
    private const string PageId = Scope + ".page";
    private const string TextId = Scope + ".title";

    [TestMethod]
    public void FixedLayoutAcceptsA2LandscapeWithoutArtificialTablesOrGroups()
    {
        var registry = new PdfElementRegistry(Document());
        Assert.AreEqual(PdfLayoutModel.FixedLayout, registry.Document.LayoutModel);
        Assert.HasCount(3, registry.Entries);
        Assert.IsTrue(PdfLayoutStateValidator.Validate(PdfLayoutStateFactory.Baseline(registry), registry).Success);
    }

    [TestMethod]
    public void LegacyTabularStillRequiresItsOriginalStructureAndFingerprint()
    {
        var legacy = PdfOrderDocumentRegistryFactory.Create();
        Assert.AreEqual(PdfLayoutModel.Tabular, legacy.Document.LayoutModel);
        Assert.AreEqual(Hash(Canonical(legacy)), PdfRegistryFingerprint.Create(legacy));
        var incomplete = Document(PdfPageFormat.A4, 297, 210, model: PdfLayoutModel.Tabular);
        var errors = PdfRegistryValidator.Validate(incomplete).Errors;
        Assert.IsTrue(errors.Any(error => error.Message.Contains("Table")));
        Assert.IsTrue(errors.Any(error => error.Message.Contains("Tabellenspalten")));
        Assert.IsFalse(PdfRegistryValidator.Validate(Document(model: PdfLayoutModel.Tabular)).Success);
    }

    [TestMethod]
    public void FixedLayoutValidatesEveryASeriesFormatAndOrientation()
    {
        (PdfPageFormat format, double shortSide, double longSide)[] formats =
        [
            (PdfPageFormat.A0, 841, 1189), (PdfPageFormat.A1, 594, 841),
            (PdfPageFormat.A2, 420, 594), (PdfPageFormat.A3, 297, 420),
            (PdfPageFormat.A4, 210, 297), (PdfPageFormat.A5, 148, 210), (PdfPageFormat.A6, 105, 148)
        ];
        foreach (var (format, shortSide, longSide) in formats)
        {
            Assert.IsTrue(PdfRegistryValidator.Validate(Document(format, longSide, shortSide)).Success, format.ToString());
            Assert.IsTrue(PdfRegistryValidator.Validate(Document(format, shortSide, longSide, PdfPageOrientation.Portrait)).Success, format.ToString());
            Assert.IsFalse(PdfRegistryValidator.Validate(Document(format, longSide + 1, shortSide)).Success, format.ToString());
        }
    }

    [TestMethod]
    public void FixedLayoutRejectsInvalidPageSizesOrientationsUnitsAndMargins()
    {
        Assert.IsTrue(PdfRegistryValidator.Validate(Document(PdfPageFormat.Custom, 500, 300)).Success);
        Assert.IsTrue(PdfRegistryValidator.Validate(Document(PdfPageFormat.Custom, 300, 300)).Success);
        foreach (var size in new[] { 0d, -1d, double.NaN, double.PositiveInfinity })
            Assert.IsFalse(PdfRegistryValidator.Validate(Document(PdfPageFormat.Custom, size, 300)).Success);
        Assert.IsFalse(PdfRegistryValidator.Validate(Document(PdfPageFormat.Custom, 300, 500)).Success);
        Assert.IsFalse(PdfRegistryValidator.Validate(Document(orientation: (PdfPageOrientation)99)).Success);
        Assert.IsFalse(PdfRegistryValidator.Validate(Document(format: (PdfPageFormat)99)).Success);
        Assert.IsFalse(PdfRegistryValidator.Validate(Document(unit: (PdfLayoutUnit)99)).Success);
        Assert.IsFalse(PdfRegistryValidator.Validate(Document(model: (PdfLayoutModel)99)).Success);
        foreach (var margins in new PdfBox[] { new(-1, 0, 0, 0), new(0, double.NaN, 0, 0), new(300, 0, 294, 0), new(0, 210, 0, 210) })
            Assert.IsFalse(PdfRegistryValidator.Validate(Document(margins: margins)).Success);
    }

    [TestMethod]
    public void FixedLayoutRequiresOneScopeRootAndOneDirectPageAndRejectsBrokenTopology()
    {
        var original = Document().RegisteredElements;
        Reject(original.Where(element => element.Kind != PdfElementKind.Page));
        Reject(original.Append(original[0] with { ElementId = Scope + ".extra-root" }));
        Reject(original.Append(original[1] with { ElementId = Scope + ".extra-page" }));
        Reject(original.Select(element => element.Kind == PdfElementKind.Document ? element with { ElementId = Scope + ".wrong-root" } : element));
        Reject(original.Select(element => element.Kind == PdfElementKind.Page ? element with { ParentId = TextId } : element));
        Reject(original.Select(element => element.Kind == PdfElementKind.Text ? element with { ParentId = Scope } : element));
        Reject(original.Select(element => element.Kind == PdfElementKind.Text ? element with { ParentId = "pdf.missing" } : element));
        Reject(original.Select(element => element.Kind == PdfElementKind.Text ? element with { ParentId = TextId } : element));
        Reject(original.Append(original[2]));
        void Reject(IEnumerable<PdfElementDefinition> entries) => Assert.IsFalse(PdfRegistryValidator.Validate(Document(entries: entries)).Success);
    }

    [TestMethod]
    public void OptionalTablesStillRequireTwoDirectClassifiedColumnsEach()
    {
        var entries = Document().RegisteredElements;
        var table = Element(Scope + ".table", PageId, PdfElementKind.Table, new(10, 30, 100, 20), 30);
        var column = Element(Scope + ".column", table.ElementId, PdfElementKind.TableColumn, new(10, 30, 50, 20), 40) with { ColumnRole = "contentColumn" };
        var second = column with { ElementId = Scope + ".column2", StableOrder = 50, BaselineLayout = new(60, 30, 50, 20) };
        Assert.IsFalse(PdfRegistryValidator.Validate(Document(entries: entries.Append(table))).Success);
        Assert.IsFalse(PdfRegistryValidator.Validate(Document(entries: entries.Append(table).Append(column))).Success);
        Assert.IsTrue(PdfRegistryValidator.Validate(Document(entries: entries.Concat([table, column, second]))).Success);
        Assert.IsFalse(PdfRegistryValidator.Validate(Document(entries: entries.Append(column with { ParentId = PageId }))).Success);
        Assert.IsFalse(PdfRegistryValidator.Validate(Document(entries: entries.Concat([table, column, second with { ColumnRole = null }]))).Success);
        Assert.IsFalse(PdfRegistryValidator.Validate(Document(entries: entries.Concat([table, column, second, table with { ElementId = Scope + ".empty-table" }]))).Success);
    }

    [TestMethod]
    public void FixedLayoutFingerprintIncludesFormatOrientationAndDimensions()
    {
        var registry = new PdfElementRegistry(Document());
        Assert.AreEqual(Hash("fixed-layout|A2|landscape|594|420\n" + Canonical(registry)), PdfRegistryFingerprint.Create(registry));
        var custom = new PdfElementRegistry(Document(PdfPageFormat.Custom));
        Assert.AreNotEqual(PdfRegistryFingerprint.Create(registry), PdfRegistryFingerprint.Create(custom));
        var wider = new PdfElementRegistry(Document(PdfPageFormat.Custom, 595));
        Assert.AreNotEqual(PdfRegistryFingerprint.Create(custom), PdfRegistryFingerprint.Create(wider));
    }

    [TestMethod]
    public void ElectronPipePreservesFixedLayoutA2AndCustomAndRejectsUnknownWireValues()
    {
        var wire = WireRegistry(Document());
        var registry = ReadPipeRegistry(wire);
        Assert.AreEqual(PdfPageFormat.A2, registry.Document.PageFormat);
        Assert.AreEqual(PdfLayoutModel.FixedLayout, registry.Document.LayoutModel);
        Assert.AreEqual(594d, registry.Document.PageTemplate.Width);
        Assert.AreEqual(PdfRegistryFingerprint.Create(new PdfElementRegistry(Document())), PdfRegistryFingerprint.Create(registry));
        wire["pageSettings"]!["format"] = "custom";
        Assert.AreEqual(PdfPageFormat.Custom, ReadPipeRegistry(wire).Document.PageFormat);
        wire["layoutModel"] = null;
        Assert.ThrowsExactly<TargetInvocationException>(() => ReadPipeRegistry(wire));
        wire["layoutModel"] = "unknown";
        Assert.ThrowsExactly<TargetInvocationException>(() => ReadPipeRegistry(wire));
        wire["layoutModel"] = "fixed-layout";
        wire["pageSettings"]!["format"] = "A99";
        Assert.ThrowsExactly<TargetInvocationException>(() => ReadPipeRegistry(wire));
        wire["pageSettings"]!["format"] = "A2";
        wire["pageSettings"]!["orientation"] = "upside-down";
        Assert.ThrowsExactly<TargetInvocationException>(() => ReadPipeRegistry(wire));
    }

    private static PdfDocumentDefinition Document(PdfPageFormat format = PdfPageFormat.A2, double width = 594, double height = 420,
        PdfPageOrientation orientation = PdfPageOrientation.Landscape, PdfBox? margins = null,
        IEnumerable<PdfElementDefinition>? entries = null, PdfLayoutModel model = PdfLayoutModel.FixedLayout,
        PdfLayoutUnit unit = PdfLayoutUnit.Millimeter)
    {
        var zone = new PdfBox(0, 0, width, height);
        var page = new PdfPageDefinition(PageId, width, height, zone, zone, zone, zone);
        return new(Scope, "neutral-fixture", "overlay-sheet", format, orientation, unit, margins ?? new(0, 0, 0, 0), "Arial", page,
            entries ?? [Element(Scope, null, PdfElementKind.Document, zone, 0), Element(PageId, Scope, PdfElementKind.Page, zone, 10),
                Element(TextId, PageId, PdfElementKind.Text, new(10, 10, 80, 10), 20)], model);
    }

    private static PdfElementDefinition Element(string id, string? parent, PdfElementKind kind, PdfBox box, int order) =>
        new(id, id, Scope, parent, kind, PdfElementRole.Layout, PdfCapability.None, PdfPageArea.Document, box, order,
            true, false, [PdfLayoutOperations.Inspect], PdfLayoutOperations.Mutating);

    private static string Canonical(PdfElementRegistry registry) => string.Join("\n", registry.Entries.OrderBy(element => element.ElementId, StringComparer.Ordinal).Select(element =>
        string.Join("|", element.ElementId, element.ScopeId, element.ParentId ?? string.Empty, element.Kind, element.Role,
            string.Join(",", Enum.GetValues<PdfCapability>().Where(value => value != PdfCapability.None && element.Capabilities.HasFlag(value)).OrderBy(value => value)),
            element.PageArea, element.StableOrder.ToString(CultureInfo.InvariantCulture), element.BoundaryResizePolicy ?? string.Empty)));
    private static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value))).ToLowerInvariant();

    private static JsonObject WireRegistry(PdfDocumentDefinition document) => JsonSerializer.SerializeToNode(new
    {
        applicationId = document.ApplicationId, documentTypeId = document.DocumentType, displayName = "Overlay sheet", scopeId = Scope, unit = "mm",
        registryVersion = 1, registryFingerprint = "fixture", layoutModel = "fixed-layout",
        pageSettings = new { format = "A2", orientation = "landscape", width = 594, height = 420, margins = new { top = 0, right = 0, bottom = 0, left = 0 } },
        elements = document.RegisteredElements.Select(element => new
        {
            id = element.ElementId, name = element.Name, scopeId = Scope, parentId = element.ParentId,
            kind = char.ToLowerInvariant(element.Kind.ToString()[0]) + element.Kind.ToString()[1..], role = "layout", pageArea = "document",
            order = element.StableOrder, visible = true, editable = false, capabilities = Array.Empty<string>(), allowedOps = element.AllowedOperations,
            lockedOps = element.LockedOperations, baseline = new { x = element.BaselineLayout.X, y = element.BaselineLayout.Y, width = element.BaselineLayout.Width, height = element.BaselineLayout.Height },
            layoutBounds = new { minX = 0, maxX = 594, minY = 0, maxY = 420, minWidth = 0, maxWidth = 594, minHeight = 0, maxHeight = 420 },
            refKey = element.ElementId, rendererKey = element.ElementId
        })
    })!.AsObject();

    private static PdfElementRegistry ReadPipeRegistry(JsonObject wire)
    {
        var adapter = typeof(ElectronPdfPipeHostAdapter);
        var remoteType = adapter.GetNestedType("RemotePdfRegistry", BindingFlags.NonPublic)!;
        var remote = JsonSerializer.Deserialize(wire.ToJsonString(), remoteType, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        return (PdfElementRegistry)adapter.GetMethod("BuildRegistry", BindingFlags.NonPublic | BindingFlags.Static)!.Invoke(null, [remote])!;
    }
}
