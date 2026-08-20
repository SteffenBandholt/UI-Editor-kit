using System.IO;
using System.Runtime.InteropServices;
using ReferenceTargetApp.EditorIntegration.Pdf;
using ReferenceTargetApp.PdfRendering;
using Windows.Data.Pdf;
using Windows.Storage.Streams;

namespace ReferenceTargetApp.PdfPreview;

public static class PdfPreviewErrorCodes
{
    public const string LoadFailed = "pdf_preview_load_failed";
    public const string RenderFailed = "pdf_preview_render_failed";
    public const string SelectionFailed = "pdf_preview_selection_failed";
}

public sealed record PdfPreviewPage(int PageNumber, uint PixelWidth, uint PixelHeight, byte[] PngBytes);
public sealed record PdfPreviewResult(bool Success, string Code, string Message, string SourcePath,
    IReadOnlyList<PdfPreviewPage> Pages, DateTimeOffset SourceLastWriteTime, long SourceLength)
{
    public static PdfPreviewResult Fail(string code, string message, string path) =>
        new(false, code, message, path, [], default, 0);
}

public sealed class NativePdfPreviewRenderer
{
    public async Task<PdfPreviewResult> RenderAsync(string sourcePath, uint destinationWidth = 1191,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(sourcePath);
        var fullPath = Path.GetFullPath(sourcePath);
        if (!File.Exists(fullPath))
            return PdfPreviewResult.Fail(PdfPreviewErrorCodes.LoadFailed, "Die erzeugte PDF-Datei ist noch nicht vorhanden.", fullPath);
        try
        {
            var bytes = await File.ReadAllBytesAsync(fullPath, cancellationToken).ConfigureAwait(false);
            cancellationToken.ThrowIfCancellationRequested();
            using var input = new InMemoryRandomAccessStream();
            using (var writer = new DataWriter(input.GetOutputStreamAt(0)))
            {
                writer.WriteBytes(bytes);
                await writer.StoreAsync().AsTask(cancellationToken).ConfigureAwait(false);
                await writer.FlushAsync().AsTask(cancellationToken).ConfigureAwait(false);
            }
            input.Seek(0);
            var document = await PdfDocument.LoadFromStreamAsync(input).AsTask(cancellationToken).ConfigureAwait(false);
            var pages = new List<PdfPreviewPage>((int)document.PageCount);
            for (uint index = 0; index < document.PageCount; index++)
            {
                cancellationToken.ThrowIfCancellationRequested();
                using var page = document.GetPage(index);
                using var output = new InMemoryRandomAccessStream();
                var height = (uint)Math.Round(destinationWidth * page.Size.Height / page.Size.Width);
                var options = new PdfPageRenderOptions { DestinationWidth = destinationWidth, DestinationHeight = height };
                await page.RenderToStreamAsync(output, options).AsTask(cancellationToken).ConfigureAwait(false);
                output.Seek(0);
                using var reader = new DataReader(output.GetInputStreamAt(0));
                await reader.LoadAsync((uint)output.Size).AsTask(cancellationToken).ConfigureAwait(false);
                var png = new byte[output.Size];
                reader.ReadBytes(png);
                pages.Add(new((int)index + 1, destinationWidth, height, png));
            }
            var info = new FileInfo(fullPath);
            return new(true, "pdf_preview_rendered", "Native PDF-Vorschau wurde aus der Ausgabedatei geladen.",
                fullPath, pages, info.LastWriteTimeUtc, info.Length);
        }
        catch (OperationCanceledException) { return PdfPreviewResult.Fail("cancelled", "PDF-Vorschau wurde abgebrochen.", fullPath); }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or ArgumentException or InvalidOperationException or COMException)
        {
            return PdfPreviewResult.Fail(PdfPreviewErrorCodes.RenderFailed, "PDF-Vorschau konnte nicht gerendert werden: " + exception.Message, fullPath);
        }
    }
}

public sealed record PdfPreviewTransform(double Left, double Top, double Width, double Height, double Scale);

public static class PdfPreviewCoordinateMapper
{
    public static PdfPreviewTransform Fit(PdfPageDefinition pageDefinition, double viewportWidth, double viewportHeight)
    {
        ArgumentNullException.ThrowIfNull(pageDefinition);
        if (!double.IsFinite(pageDefinition.Width) || !double.IsFinite(pageDefinition.Height) ||
            pageDefinition.Width <= 0 || pageDefinition.Height <= 0 ||
            !double.IsFinite(viewportWidth) || !double.IsFinite(viewportHeight) || viewportWidth <= 0 || viewportHeight <= 0)
            return new(0, 0, 0, 0, 0);
        var scale = Math.Min(viewportWidth / pageDefinition.Width, viewportHeight / pageDefinition.Height);
        var width = pageDefinition.Width * scale;
        var height = pageDefinition.Height * scale;
        return new((viewportWidth - width) / 2, (viewportHeight - height) / 2, width, height, scale);
    }

    public static (bool Success, double X, double Y) ToPdf(PdfPageDefinition pageDefinition, double x, double y,
        double viewportWidth, double viewportHeight)
    {
        var fit = Fit(pageDefinition, viewportWidth, viewportHeight);
        if (fit.Scale <= 0 || x < fit.Left || y < fit.Top || x > fit.Left + fit.Width || y > fit.Top + fit.Height)
            return (false, 0, 0);
        return (true, (x - fit.Left) / fit.Scale, (y - fit.Top) / fit.Scale);
    }

    public static PdfPreviewTransform ToViewport(PdfPageDefinition pageDefinition, PdfBox box,
        double viewportWidth, double viewportHeight)
    {
        var fit = Fit(pageDefinition, viewportWidth, viewportHeight);
        return new(fit.Left + box.X * fit.Scale, fit.Top + box.Y * fit.Scale,
            box.Width * fit.Scale, box.Height * fit.Scale, fit.Scale);
    }

    public static PdfRenderBound? HitTest(IEnumerable<PdfRenderBound> bounds, int pageNumber, double pdfX, double pdfY)
    {
        return bounds.Where(bound => bound.PageNumber == pageNumber && Contains(bound.Box, pdfX, pdfY))
            .OrderByDescending(bound => bound.Editable)
            .ThenBy(bound => bound.Box.Width * bound.Box.Height)
            .ThenByDescending(bound => bound.StableOrder)
            .FirstOrDefault();
    }

    private static bool Contains(PdfBox box, double x, double y) =>
        x >= box.X && y >= box.Y && x <= box.X + box.Width && y <= box.Y + box.Height;
}
