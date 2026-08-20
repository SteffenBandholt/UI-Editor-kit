using System.IO;
using System.Diagnostics;
using ReferenceTargetApp.EditorIntegration.Pdf;
using ReferenceTargetApp.Infrastructure.SampleData;
using ReferenceTargetApp.PdfPreview;
using ReferenceTargetApp.PdfRendering;

namespace ReferenceTargetApp.Tests;

[TestClass]
public sealed class M77VisiblePdfEditorTests
{
    [TestMethod]
    public void RegistryTreeContainsExactlyAll26ElementsAndSixColumns()
    {
        var registry = PdfOrderDocumentRegistryFactory.Create();
        Assert.HasCount(26, registry.Entries);
        Assert.HasCount(6, registry.Entries.Where(element => element.Kind == PdfElementKind.TableColumn));
        Assert.AreEqual(PdfRegistryIds.Scope, registry.Entries.Single(element => element.ParentId is null).ElementId);
        Assert.IsTrue(registry.Entries.Where(element => element.ParentId is not null)
            .All(element => registry.FindById(element.ParentId!) is not null));
    }

    [TestMethod]
    public void CoordinateMappingUsesPortraitLandscapeAndNeutralPageDefinitions()
    {
        foreach (var page in new[] { Page(210, 297), Page(297, 210), Page(200, 200) })
        {
            var fit = PdfPreviewCoordinateMapper.Fit(page, 800, 600);
            Assert.AreEqual(page.Width / page.Height, fit.Width / fit.Height, 0.000001);
            Assert.IsLessThanOrEqualTo(800.000001, fit.Left + fit.Width);
            Assert.IsLessThanOrEqualTo(600.000001, fit.Top + fit.Height);
            Assert.IsFalse(PdfPreviewCoordinateMapper.ToPdf(page, fit.Left - 1, fit.Top, 800, 600).Success);
        }
    }

    [TestMethod]
    public void CoordinateMappingRoundTripsPointsAndRectanglesForEveryPageShape()
    {
        foreach (var page in new[] { Page(210, 297), Page(297, 210), Page(200, 200) })
        {
            var boxes = new[]
            {
                new PdfBox(0, 0, page.Width, page.Height),
                new PdfBox(12, 18, Math.Min(35, page.Width - 12), Math.Min(24, page.Height - 18)),
                new PdfBox(page.Width * 0.62, page.Height * 0.71, page.Width * 0.11, page.Height * 0.08),
            };
            foreach (var source in boxes)
            {
                var view = PdfPreviewCoordinateMapper.ToViewport(page, source, 800, 600);
                var topLeft = PdfPreviewCoordinateMapper.ToPdf(page, view.Left, view.Top, 800, 600);
                var bottomRight = PdfPreviewCoordinateMapper.ToPdf(page, view.Left + view.Width, view.Top + view.Height, 800, 600);
                Assert.IsTrue(topLeft.Success);
                Assert.IsTrue(bottomRight.Success);
                Assert.AreEqual(source.X, topLeft.X, 0.0001);
                Assert.AreEqual(source.Y, topLeft.Y, 0.0001);
                Assert.AreEqual(source.X + source.Width, bottomRight.X, 0.0001);
                Assert.AreEqual(source.Y + source.Height, bottomRight.Y, 0.0001);
            }
        }
    }

    [TestMethod]
    public void LandscapeAdjacentElementsRemainAdjacentAndSelectIndependently()
    {
        var page = Page(297, 210);
        var number = new PdfBox(12, 40, 9, 12);
        var classification = new PdfBox(21, 40, 24, 12);
        var numberView = PdfPreviewCoordinateMapper.ToViewport(page, number, 800, 600);
        var classificationView = PdfPreviewCoordinateMapper.ToViewport(page, classification, 800, 600);

        Assert.AreEqual(numberView.Left + numberView.Width, classificationView.Left, 0.0001);

        var bounds = new[]
        {
            new PdfRenderBound("nr", 1, number, 10, true),
            new PdfRenderBound("klasse", 1, classification, 20, true),
        };
        var numberPoint = PdfPreviewCoordinateMapper.ToPdf(page,
            numberView.Left + numberView.Width / 2, numberView.Top + numberView.Height / 2, 800, 600);
        var classificationPoint = PdfPreviewCoordinateMapper.ToPdf(page,
            classificationView.Left + classificationView.Width / 2, classificationView.Top + classificationView.Height / 2, 800, 600);
        Assert.AreEqual("nr", PdfPreviewCoordinateMapper.HitTest(bounds, 1, numberPoint.X, numberPoint.Y)?.ElementId);
        Assert.AreEqual("klasse", PdfPreviewCoordinateMapper.HitTest(bounds, 1, classificationPoint.X, classificationPoint.Y)?.ElementId);
    }

    [TestMethod]
    public void HitTestPrefersSmallEditableAndIsStable()
    {
        var bounds = new[]
        {
            new PdfRenderBound("root", 1, new(0, 0, 210, 297), 0, false),
            new PdfRenderBound("editable-large", 1, new(10, 10, 80, 80), 10, true),
            new PdfRenderBound("editable-small", 1, new(20, 20, 10, 10), 20, true)
        };
        Assert.AreEqual("editable-small", PdfPreviewCoordinateMapper.HitTest(bounds, 1, 25, 25)!.ElementId);
        Assert.IsNull(PdfPreviewCoordinateMapper.HitTest(bounds, 1, 211, 25));
    }

    [TestMethod]
    public async Task ElementDiscardAndResetKeepSavedAndBaselineDistinct()
    {
        var root = TemporaryRoot();
        try
        {
            var registry = PdfOrderDocumentRegistryFactory.Create();
            var adapter = new PdfHostAdapter(registry);
            var session = new PdfLayoutSession(adapter, new(root));
            Assert.IsTrue((await session.ApplyBatchAsync([Move(PdfRegistryIds.Title, 124)])).Success);
            Assert.IsTrue((await session.SaveAsync()).Success);
            Assert.IsTrue((await session.ApplyBatchAsync([Move(PdfRegistryIds.Title, 123)])).Success);
            Assert.IsTrue((await session.DiscardElementAsync(PdfRegistryIds.Title)).Success);
            Assert.AreEqual(124, State(adapter, PdfRegistryIds.Title).X);
            Assert.IsTrue((await session.ResetElementAsync(PdfRegistryIds.Title)).Success);
            Assert.AreEqual(125, State(adapter, PdfRegistryIds.Title).X);
            Assert.IsTrue(session.GetStatus().IsDirty);
        }
        finally { Directory.Delete(root, true); }
    }

    [TestMethod]
    public async Task RendererReturnsRegisteredBoundsForEveryRealPage()
    {
        var root = TemporaryRoot();
        try
        {
            var registry = PdfOrderDocumentRegistryFactory.Create();
            var result = await new PdfOrderDocumentRenderer().RenderAsync(registry, PdfLayoutStateFactory.Baseline(registry),
                new ReferenceOrderFactory().CreatePdfDiagnosticOrder(), Path.Combine(root, "bounds.pdf"));
            Assert.IsTrue(result.Success, result.Message);
            Assert.IsGreaterThanOrEqualTo(2, result.PageCount);
            Assert.HasCount(result.PageCount * 26, result.RenderBounds);
            Assert.IsTrue(result.RenderBounds.All(bound => bound.Box.X >= 0 && bound.Box.Y >= 0 &&
                bound.Box.X + bound.Box.Width <= 210.0001 && bound.Box.Y + bound.Box.Height <= 297.0001));
            Assert.IsTrue(Enumerable.Range(1, result.PageCount).All(page =>
                result.RenderBounds.Count(bound => bound.PageNumber == page) == 26));
        }
        finally { Directory.Delete(root, true); }
    }

    [TestMethod]
    public async Task NativePreviewRendersEveryPageAndReleasesOutputFile()
    {
        var root = TemporaryRoot();
        try
        {
            var registry = PdfOrderDocumentRegistryFactory.Create();
            var path = Path.Combine(root, "preview.pdf");
            var render = await new PdfOrderDocumentRenderer().RenderAsync(registry, PdfLayoutStateFactory.Baseline(registry),
                new ReferenceOrderFactory().CreatePdfDiagnosticOrder(), path);
            var preview = await new NativePdfPreviewRenderer().RenderAsync(path, 600);
            Assert.IsTrue(preview.Success, preview.Message);
            Assert.HasCount(render.PageCount, preview.Pages);
            Assert.IsTrue(preview.Pages.All(page => page.PngBytes.Length > 1000 && page.PixelWidth == 600 && page.PixelHeight > page.PixelWidth));
            using var exclusive = new FileStream(path, FileMode.Open, FileAccess.ReadWrite, FileShare.None);
            Assert.IsGreaterThan(1024, exclusive.Length);
        }
        finally { Directory.Delete(root, true); }
    }

    [TestMethod]
    public async Task CorruptPreviewReturnsStructuredError()
    {
        var root = TemporaryRoot();
        try
        {
            var path = Path.Combine(root, "broken.pdf");
            await File.WriteAllTextAsync(path, "not a pdf");
            var result = await new NativePdfPreviewRenderer().RenderAsync(path);
            Assert.IsFalse(result.Success);
            Assert.AreEqual(PdfPreviewErrorCodes.RenderFailed, result.Code);
        }
        finally { Directory.Delete(root, true); }
    }

    [TestMethod]
    public void PreviewProjectHasNoBrowserOrPdfGenerationPackage()
    {
        var project = File.ReadAllText(Path.Combine(RepositoryRoot(), "reference-target-app", "src", "ReferenceTargetApp.PdfPreview", "ReferenceTargetApp.PdfPreview.csproj"));
        Assert.DoesNotContain("PackageReference", project, StringComparison.Ordinal);
        Assert.DoesNotContain("WebView", project, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("PDFsharp", project, StringComparison.OrdinalIgnoreCase);
    }

    [TestMethod]
    public void PdfSharpRemainsOnlyInPdfRenderingProject()
    {
        var source = Path.Combine(RepositoryRoot(), "reference-target-app", "src");
        var projectReferences = Directory.EnumerateFiles(source, "*.csproj", SearchOption.AllDirectories)
            .Where(path => File.ReadAllText(path).Contains("PackageReference Include=\"PDFsharp\"", StringComparison.Ordinal)).ToArray();
        Assert.HasCount(1, projectReferences);
        Assert.Contains("ReferenceTargetApp.PdfRendering", projectReferences[0], StringComparison.Ordinal);
    }

    [TestMethod]
    [Timeout(210_000, CooperativeCancellation = true)]
    public async Task VisibleUiPdfEndToEndUsesTwoRealProcessesAndCleansArtifacts()
    {
        var executable = Path.Combine(AppContext.BaseDirectory, "ReferenceTargetApp.exe");
        using var process = Process.Start(new ProcessStartInfo
        {
            FileName = executable,
            UseShellExecute = false,
            WorkingDirectory = AppContext.BaseDirectory,
            ArgumentList = { "--ui-pdf-end-to-end-diagnostic" }
        })!;
        await process.WaitForExitAsync();
        Assert.AreEqual(0, process.ExitCode);
        var diagnostics = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "UI-Editor-kit", "ReferenceTargetApp", "diagnostics");
        Assert.IsFalse(Directory.Exists(diagnostics) && Directory.EnumerateFileSystemEntries(diagnostics, "m77-*", SearchOption.TopDirectoryOnly).Any());
    }

    private static PdfChangeRequest Move(string id, double x) => new(Guid.NewGuid().ToString("N"), id,
        PdfLayoutOperations.Move, new Dictionary<string, object?> { ["x"] = x, ["y"] = 17d }, DateTimeOffset.UtcNow, "m77-test", PdfRegistryIds.Scope);
    private static PdfElementLayoutState State(IPdfHostAdapter adapter, string id) => adapter.GetCurrentLayoutState().Elements.Single(element => element.ElementId == id);
    private static PdfPageDefinition Page(double width, double height) => new("pdf.test.page", width, height,
        new(0, 0, width, height), new(0, 0, width, height), new(0, 0, width, height), new(0, 0, width, height));
    private static string TemporaryRoot() { var path = Path.Combine(Path.GetTempPath(), "m77-" + Guid.NewGuid().ToString("N")); Directory.CreateDirectory(path); return path; }
    private static string RepositoryRoot() => Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", ".."));
}
