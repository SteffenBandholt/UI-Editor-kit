using System.IO;
using System.Text.Json;
using System.Xml.Linq;
using ReferenceTargetApp.EditorIntegration.Geometry;
using ReferenceTargetApp.EditorIntegration.Persistence;

namespace ReferenceTargetApp.Tests;

[TestClass]
public sealed class M822GeometryRiskTests
{
    private static readonly GeometryTarget Target = new(
        "target", "Kurztext", "field", new GeometryBounds(20, 20, 100, 30));
    private static readonly GeometryTarget Group = new(
        "group", "Klasse", "group", new GeometryBounds(0, 0, 300, 160));
    private static readonly GeometryTarget Area = new(
        "area", "Restarbeiten", "area", new GeometryBounds(0, 0, 600, 400));

    [TestMethod]
    public void SelectionCompatibleGeometryHasNoWarning()
    {
        var result = Evaluate(GeometryEditModes.Guided, new GeometryBounds(25, 25, 100, 30));

        Assert.IsFalse(result.HasRisks);
        Assert.AreEqual(string.Empty, result.Title);
        Assert.AreEqual("guaranteed", result.TechnicalDetails.RollbackStatus);
    }

    [TestMethod]
    public void GuidedModeOffersGroupBoundaryAndUsesDisplayNames()
    {
        var result = Evaluate(GeometryEditModes.Guided, new GeometryBounds(260, 20, 100, 30));

        Assert.IsTrue(result.HasRisks);
        Assert.AreEqual(GeometryRiskTypes.LeavesGroup, result.RiskType);
        CollectionAssert.Contains(result.SuggestedActions.ToArray(), GeometryRiskActions.ClampToGroup);
        StringAssert.Contains(result.Message, "Kurztext");
        StringAssert.Contains(result.Message, "Klasse");
        Assert.IsFalse(result.Message.Contains("target", StringComparison.Ordinal));
        Assert.AreEqual("target", result.TechnicalDetails.ElementId);
    }

    [TestMethod]
    public void FreeModeKeepsRiskVisibleButDoesNotOfferAutomaticGroupClamp()
    {
        var result = Evaluate(GeometryEditModes.Free, new GeometryBounds(260, 20, 100, 30));

        Assert.IsTrue(result.HasRisks);
        Assert.AreEqual(GeometryEditModes.Free, result.EditMode);
        CollectionAssert.DoesNotContain(result.SuggestedActions.ToArray(), GeometryRiskActions.ClampToGroup);
        CollectionAssert.Contains(result.SuggestedActions.ToArray(), GeometryRiskActions.ApplyAnyway);
        CollectionAssert.Contains(result.SuggestedActions.ToArray(), GeometryRiskActions.Cancel);
    }

    [TestMethod]
    public void NeighborOverlapCarriesPreviewAndBackAction()
    {
        var neighbor = new GeometryNeighbor("neighbor", "Beschreibung", "field",
            new GeometryBounds(130, 20, 100, 30));
        var result = GeometryRiskEvaluator.Evaluate(GeometryEditModes.Free, "operation", "scope", Target,
            new GeometryBounds(80, 20, 100, 30), Group, Group, Area, [neighbor]);

        Assert.AreEqual(GeometryRiskTypes.OverlapsNeighbor, result.RiskType);
        Assert.IsNotNull(result.AffectedNeighbors.Single().OverlapBounds);
        CollectionAssert.Contains(result.SuggestedActions.ToArray(), GeometryRiskActions.GoBack);
        Assert.AreEqual(Target.Bounds, result.Preview.CurrentBounds);
    }

    [TestMethod]
    public void ClampPreservesElementSizeAndKeepsItInsideContainer()
    {
        var clamped = GeometryRiskEvaluator.Clamp(
            new GeometryBounds(280, -20, 100, 30), Group.Bounds);

        Assert.AreEqual(200, clamped.Left, 0.001);
        Assert.AreEqual(0, clamped.Top, 0.001);
        Assert.AreEqual(100, clamped.Width, 0.001);
        Assert.AreEqual(30, clamped.Height, 0.001);
    }

    [TestMethod]
    public async Task EditModePreferenceIsSeparateAtomicStateAndSurvivesReload()
    {
        var root = Path.Combine(Path.GetTempPath(), "ui-editor-kit-m82-2-preferences", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        try
        {
            var profilePath = Path.Combine(root, "standard.layout-profile.json");
            await File.WriteAllTextAsync(profilePath, "{\"profile\":\"unchanged\"}");
            var profileBefore = await File.ReadAllBytesAsync(profilePath);
            var store = new EditorPreferenceStore(root, "reference-target-app");

            Assert.AreEqual(GeometryEditModes.Guided, await store.LoadEditModeAsync());
            Assert.IsTrue(await store.SaveEditModeAsync(GeometryEditModes.Free));
            Assert.AreEqual(GeometryEditModes.Free, await new EditorPreferenceStore(root, "reference-target-app").LoadEditModeAsync());
            CollectionAssert.AreEqual(profileBefore, await File.ReadAllBytesAsync(profilePath));
            Assert.IsFalse(Directory.EnumerateFiles(root, "*.tmp").Any());

            using var preferences = JsonDocument.Parse(await File.ReadAllTextAsync(store.FilePath));
            Assert.AreEqual(1, preferences.RootElement.GetProperty("schemaVersion").GetInt32());
            Assert.AreEqual("reference-target-app", preferences.RootElement.GetProperty("applicationId").GetString());
        }
        finally
        {
            if (Directory.Exists(root)) Directory.Delete(root, true);
        }
    }

    [TestMethod]
    public async Task CorruptOrForeignPreferenceFallsBackToGuided()
    {
        var root = Path.Combine(Path.GetTempPath(), "ui-editor-kit-m82-2-preferences-invalid", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        try
        {
            var store = new EditorPreferenceStore(root, "reference-target-app");
            await File.WriteAllTextAsync(store.FilePath, "not-json");
            Assert.AreEqual(GeometryEditModes.Guided, await store.LoadEditModeAsync());
            await File.WriteAllTextAsync(store.FilePath,
                "{\"schemaVersion\":1,\"applicationId\":\"other-app\",\"editMode\":\"free\",\"savedAt\":\"2026-01-01T00:00:00Z\"}");
            Assert.AreEqual(GeometryEditModes.Guided, await store.LoadEditModeAsync());
        }
        finally
        {
            if (Directory.Exists(root)) Directory.Delete(root, true);
        }
    }

    [TestMethod]
    public void InvalidGeometryIsRejectedBeforeRiskEvaluation()
    {
        Assert.ThrowsExactly<ArgumentException>(() =>
            Evaluate(GeometryEditModes.Guided, new GeometryBounds(20, 20, double.NaN, 30)));
    }

    [TestMethod]
    public void PdfRiskMessageUsesTheSameUserFacingVocabulary()
    {
        var result = GeometryRiskMessages.ForPdf(GeometryRiskTypes.OverlapsNeighbor, "Tabelle", "Inhalt");

        StringAssert.Contains(result.Title, "überlappt");
        StringAssert.Contains(result.Message, "Tabelle");
        Assert.IsFalse(result.Message.Contains("pdf.", StringComparison.Ordinal));
    }

    [TestMethod]
    public void PdfRenderFailureIsContainedByTheWorkspace()
    {
        var root = FindRepositoryRoot();
        var source = File.ReadAllText(Path.Combine(root, "reference-target-app", "src", "ReferenceTargetApp.Wpf", "UI", "ViewModels", "PdfEditorWorkspaceViewModel.cs"));

        StringAssert.Contains(source, "catch (ElectronEditorException exception)");
        StringAssert.Contains(source, "PDF konnte nicht erzeugt werden. Sie können direkt weiterarbeiten.");
        StringAssert.Contains(source, "finally { activeRender?.Dispose(); activeRender = null; IsBusy = false;");
        StringAssert.Contains(source, "boundaryFailure");
        StringAssert.Contains(source, "Änderung wurde nicht übernommen. Sie können direkt weiterarbeiten.");
        StringAssert.Contains(source, "result.Success && electronAdapter is not null");
        StringAssert.Contains(source, "await RenderAsync()");
        StringAssert.Contains(source, "registry.FindById(bound.ElementId)?.Editable == true");
    }

    [TestMethod]
    public void EditorWindowKeepsTechnicalElementIdsBehindDetailsAndShowsPdfEditMode()
    {
        var root = FindRepositoryRoot();
        var path = Path.Combine(root, "reference-target-app", "src", "ReferenceTargetApp.Wpf", "UI", "Views", "EditorWindow.xaml");
        var document = XDocument.Load(path);
        var selectedIdBindings = document.Descendants()
            .Where(element => element.Name.LocalName == "TextBlock" &&
                string.Equals((string?)element.Attribute("Text"), "{Binding SelectedId}", StringComparison.Ordinal))
            .ToArray();

        Assert.HasCount(2, selectedIdBindings);
        Assert.IsTrue(selectedIdBindings.All(element => element.Ancestors().Any(ancestor =>
            ancestor.Name.LocalName == "Expander" &&
            string.Equals((string?)ancestor.Attribute("Header"), "Details anzeigen", StringComparison.Ordinal))));
        Assert.IsFalse(document.Descendants().Any(element =>
            string.Equals((string?)element.Attribute("ToolTip"), "{Binding Id}", StringComparison.Ordinal)));

        var pdfTab = document.Descendants().Single(element =>
            element.Name.LocalName == "TabItem" &&
            string.Equals((string?)element.Attribute("Header"), "PDF-Ausgabe", StringComparison.Ordinal));
        Assert.IsTrue(pdfTab.Descendants().Any(element =>
            string.Equals((string?)element.Attribute("GroupName"), "PdfEditMode", StringComparison.Ordinal) &&
            string.Equals((string?)element.Attribute("Content"), "Geführt", StringComparison.Ordinal)));
        Assert.IsTrue(pdfTab.Descendants().Any(element =>
            string.Equals((string?)element.Attribute("GroupName"), "PdfEditMode", StringComparison.Ordinal) &&
            string.Equals((string?)element.Attribute("Content"), "Frei", StringComparison.Ordinal)));
        Assert.IsTrue(pdfTab.Descendants().Any(element =>
            string.Equals((string?)element.Attribute("Content"), "Original", StringComparison.Ordinal)));
        Assert.IsTrue(pdfTab.Descendants().Any(element =>
            string.Equals((string?)element.Attribute("Content"), "Sichtbarkeit EIN/AUS", StringComparison.Ordinal)));
        var pageSurface = pdfTab.Descendants().Single(element =>
            string.Equals((string?)element.Attribute(XName.Get("Name", "http://schemas.microsoft.com/winfx/2006/xaml")), "PdfPageSurface", StringComparison.Ordinal));
        Assert.AreEqual("{Binding PageDefinition.Width}", (string?)pageSurface.Attribute("Width"));
        Assert.AreEqual("{Binding PageDefinition.Height}", (string?)pageSurface.Attribute("Height"));
        Assert.IsTrue(pageSurface.Ancestors().Any(element => element.Name.LocalName == "Viewbox"));
    }

    private static string FindRepositoryRoot()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null && !File.Exists(Path.Combine(current.FullName, "UIEditorKit.slnx"))) current = current.Parent;
        return current?.FullName ?? throw new DirectoryNotFoundException("UI-Editor-kit-Repository nicht gefunden.");
    }

    private static GeometryRiskAssessment Evaluate(string mode, GeometryBounds bounds) =>
        GeometryRiskEvaluator.Evaluate(mode, "operation", "scope", Target, bounds, Group, Group, Area, []);
}
