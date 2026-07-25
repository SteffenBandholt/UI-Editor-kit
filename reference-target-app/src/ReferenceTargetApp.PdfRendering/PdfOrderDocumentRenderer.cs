using System.Globalization;
using System.IO;
using PdfSharp.Drawing;
using PdfSharp.Fonts;
using PdfSharp.Pdf;
using PdfSharp.Pdf.IO;
using ReferenceTargetApp.Domain.Models;
using ReferenceTargetApp.EditorIntegration.Pdf;

namespace ReferenceTargetApp.PdfRendering;

public interface IPdfRenderFaultInjector
{
    void BeforeSerialization(int pageCount);
}

public sealed record PdfRenderTrace(string ElementId, int PageNumber, PdfBox Box, string Marker);
public sealed record PdfRenderResult(bool Success, string Code, string Message, string OutputPath, int PageCount,
    long FileSize, IReadOnlyList<PdfRenderTrace> Traces);
public sealed record PdfInspectionResult(bool Success, int PageCount, long FileSize, double FirstPageWidthMm, double FirstPageHeightMm, string Message);

public sealed class PdfOrderDocumentRenderer
{
    private static int fontsConfigured;
    private static readonly CultureInfo GermanCulture = CultureInfo.GetCultureInfo("de-DE");

    public async Task<PdfRenderResult> RenderAsync(PdfElementRegistry registry, PdfLayoutState layout, Order order,
        string outputPath, IPdfRenderFaultInjector? faultInjector = null, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(registry);
        ArgumentNullException.ThrowIfNull(layout);
        ArgumentNullException.ThrowIfNull(order);
        ArgumentException.ThrowIfNullOrWhiteSpace(outputPath);
        var fullPath = Path.GetFullPath(outputPath);
        var traces = new List<PdfRenderTrace>();
        byte[] bytes;
        try
        {
            var validationDocument = new PdfLayoutProfileDocument(PdfLayoutProfileDocumentValidator.SchemaVersion,
                PdfLayoutProfileDocumentValidator.DocumentKind, PdfOrderDocumentRegistryFactory.ApplicationId,
                PdfOrderDocumentRegistryFactory.DocumentType, PdfLayoutProfileDocumentValidator.ProfileId,
                PdfRegistryIds.Scope, DateTimeOffset.UtcNow, PdfRegistryFingerprint.Create(registry), layout);
            var validation = PdfLayoutProfileDocumentValidator.Validate(validationDocument, registry);
            if (!validation.Success) return Fail(validation.Code, validation.Message, fullPath, traces);
            ConfigureFonts();
            using var document = BuildDocument(registry, layout, order, traces, cancellationToken);
            faultInjector?.BeforeSerialization(document.PageCount);
            using var memory = new MemoryStream();
            document.Save(memory, false);
            bytes = memory.ToArray();
            using var verification = PdfReader.Open(new MemoryStream(bytes, writable: false), PdfDocumentOpenMode.Import);
            if (verification.PageCount < 2) return Fail(PdfErrorCodes.RenderFailed, "PDF-Erzeugung lieferte weniger als zwei Seiten.", fullPath, traces);
        }
        catch (OperationCanceledException) { return Fail("cancelled", "PDF-Erzeugung wurde abgebrochen.", fullPath, traces); }
        catch (Exception exception)
        {
            return Fail(PdfErrorCodes.RenderFailed, "PDF-Erzeugung fehlgeschlagen: " + exception.Message, fullPath, traces);
        }

        var directory = Path.GetDirectoryName(fullPath)!;
        var temporaryPath = Path.Combine(directory, $".{Path.GetFileName(fullPath)}.{Guid.NewGuid():N}.tmp");
        var backupPath = Path.Combine(directory, $".{Path.GetFileName(fullPath)}.{Guid.NewGuid():N}.backup");
        try
        {
            Directory.CreateDirectory(directory);
            await using (var stream = new FileStream(temporaryPath, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920,
                             FileOptions.Asynchronous | FileOptions.WriteThrough))
            {
                await stream.WriteAsync(bytes, cancellationToken).ConfigureAwait(false);
                await stream.FlushAsync(cancellationToken).ConfigureAwait(false);
                stream.Flush(true);
            }
            var replacedExisting = File.Exists(fullPath);
            if (replacedExisting) File.Replace(temporaryPath, fullPath, backupPath, true);
            else File.Move(temporaryPath, fullPath);
            var inspection = PdfTechnicalInspector.Inspect(fullPath);
            if (!inspection.Success)
            {
                if (replacedExisting && File.Exists(backupPath)) File.Replace(backupPath, fullPath, null, true);
                else if (!replacedExisting && File.Exists(fullPath)) File.Delete(fullPath);
                return Fail(PdfErrorCodes.RenderFailed, inspection.Message, fullPath, traces);
            }
            return new(true, "pdf_rendered", "Mehrseitige PDF wurde atomar erzeugt.", fullPath,
                inspection.PageCount, inspection.FileSize, traces);
        }
        catch (OperationCanceledException) { return Fail("cancelled", "PDF-Ausgabe wurde abgebrochen.", fullPath, traces); }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            return Fail(PdfErrorCodes.OutputWriteFailed, "PDF-Ausgabedatei konnte nicht geschrieben werden: " + exception.Message, fullPath, traces);
        }
        finally
        {
            try { if (File.Exists(temporaryPath)) File.Delete(temporaryPath); }
            catch (Exception exception) when (exception is IOException or UnauthorizedAccessException) { }
            try { if (File.Exists(backupPath)) File.Delete(backupPath); }
            catch (Exception exception) when (exception is IOException or UnauthorizedAccessException) { }
        }
    }

    private static PdfDocument BuildDocument(PdfElementRegistry registry, PdfLayoutState layout, Order order,
        ICollection<PdfRenderTrace> traces, CancellationToken cancellationToken)
    {
        var byId = layout.Elements.ToDictionary(element => element.ElementId, StringComparer.Ordinal);
        PdfBox Box(string id)
        {
            var definition = registry.FindById(id) ?? throw new InvalidOperationException("Registriertes PDF-Element fehlt: " + id);
            return PdfLayoutStateFactory.Resolve(definition, byId[id]);
        }

        var document = new PdfDocument();
        document.Info.Title = "Auftragsdokument " + order.OrderNumber;
        document.Info.Author = "ReferenceTargetApp";
        document.Info.Subject = "M76 reproducible registered PDF layout";
        var table = Box(PdfRegistryIds.Table);
        var body = registry.Document.PageTemplate.BodyArea;
        var columnWidths = PdfRegistryIds.Columns.Select(id => Box(id).Width).ToArray();
        var rows = order.Positions.ToArray();
        var rowIndex = 0;
        var pageNumber = 0;
        var summaryHeight = Box(PdfRegistryIds.Summary).Height;

        while (rowIndex < rows.Length)
        {
            cancellationToken.ThrowIfCancellationRequested();
            pageNumber++;
            var page = AddPage(document);
            using var graphics = XGraphics.FromPdfPage(page);
            DrawHeader(graphics, registry, Box, order, pageNumber, traces);
            var y = table.Y;
            DrawTableHeader(graphics, table.X, y, columnWidths, pageNumber, traces);
            y += 8;
            while (rowIndex < rows.Length)
            {
                var rowHeight = Math.Max(8, DeterministicPdfTextMeasurer.RequiredHeight(rows[rowIndex].Description, columnWidths[1] - 2, 3.1));
                if (rowHeight > body.Height - 8) throw new InvalidOperationException("Eine Tabellenzeile ist höher als ein leerer PDF-Body.");
                var remainingAfter = rows.Length - rowIndex - 1;
                var reserveSummary = remainingAfter == 0 ? summaryHeight + 4 : 0;
                if (y + rowHeight + reserveSummary > body.Y + body.Height) break;
                DrawRow(graphics, rows[rowIndex], table.X, y, rowHeight, columnWidths);
                y += rowHeight;
                rowIndex++;
            }
            if (rowIndex == rows.Length)
            {
                if (y + summaryHeight + 4 > body.Y + body.Height)
                {
                    DrawFooter(graphics, registry, Box, pageNumber, -1, traces);
                    pageNumber++;
                    var summaryPage = AddPage(document);
                    using var summaryGraphics = XGraphics.FromPdfPage(summaryPage);
                    DrawHeader(summaryGraphics, registry, Box, order, pageNumber, traces);
                    DrawTableHeader(summaryGraphics, table.X, table.Y, columnWidths, pageNumber, traces);
                    y = table.Y + 12;
                    DrawSummary(summaryGraphics, registry, Box, order, y, pageNumber, traces);
                    DrawFooter(summaryGraphics, registry, Box, pageNumber, -1, traces);
                }
                else
                {
                    DrawSummary(graphics, registry, Box, order, y + 4, pageNumber, traces);
                    DrawFooter(graphics, registry, Box, pageNumber, -1, traces);
                }
            }
            else DrawFooter(graphics, registry, Box, pageNumber, -1, traces);
        }

        var totalPages = document.PageCount;
        for (var index = 0; index < totalPages; index++)
        {
            using var graphics = XGraphics.FromPdfPage(document.Pages[index], XGraphicsPdfPageOptions.Append);
            DrawPageNumber(graphics, Box(PdfRegistryIds.PageNumber), index + 1, totalPages);
        }
        return document;
    }

    private static PdfPage AddPage(PdfDocument document)
    {
        var page = document.AddPage();
        page.Width = Mm(210);
        page.Height = Mm(297);
        return page;
    }

    private static void DrawHeader(XGraphics graphics, PdfElementRegistry registry, Func<string, PdfBox> box,
        Order order, int page, ICollection<PdfRenderTrace> traces)
    {
        var header = box(PdfRegistryIds.Header);
        graphics.DrawLine(new XPen(XColors.SteelBlue, 1), Pt(header.X), Pt(header.Y + header.Height), Pt(header.X + header.Width), Pt(header.Y + header.Height));
        Trace(PdfRegistryIds.Header, page, header, "header", traces);

        var logo = box(PdfRegistryIds.Logo);
        graphics.DrawRoundedRectangle(null, new XSolidBrush(XColor.FromArgb(31, 78, 121)), Rect(logo), new XSize(Pt(2), Pt(2)));
        graphics.DrawString("NE", Font(logo.Height * 0.42, XFontStyleEx.Bold), XBrushes.White, Rect(logo), XStringFormats.Center);
        Trace(PdfRegistryIds.Logo, page, logo, "logo", traces);

        DrawText(graphics, box(PdfRegistryIds.Sender), "Nordlicht Technik GmbH\nWerftstraße 4 · 24143 Kiel\nservice@nordlicht.example", XFontStyleEx.Regular);
        DrawText(graphics, box(PdfRegistryIds.Title), "AUFTRAG", XFontStyleEx.Bold);
        DrawText(graphics, box(PdfRegistryIds.Number), "Nummer: " + order.OrderNumber, XFontStyleEx.Regular);
        DrawText(graphics, box(PdfRegistryIds.Date), "Datum: " + order.OrderDate.ToString("dd.MM.yyyy", GermanCulture), XFontStyleEx.Regular);
        DrawText(graphics, box(PdfRegistryIds.CustomerAddress),
            $"{order.Customer.CompanyName}\n{order.Customer.ContactName}\n{order.Customer.Street}\n{order.Customer.PostalCode} {order.Customer.City}", XFontStyleEx.Regular);
        foreach (var id in new[] { PdfRegistryIds.Sender, PdfRegistryIds.Title, PdfRegistryIds.Number, PdfRegistryIds.Date, PdfRegistryIds.CustomerAddress })
            Trace(id, page, EffectiveTextBox(box(id)), "text", traces);
    }

    private static void DrawTableHeader(XGraphics graphics, double x, double y, IReadOnlyList<double> widths,
        int page, ICollection<PdfRenderTrace> traces)
    {
        var labels = new[] { "Pos.", "Beschreibung", "Menge", "Einheit", "Einzelpreis", "Gesamtpreis" };
        var cursor = x;
        for (var index = 0; index < widths.Count; index++)
        {
            var cell = new PdfBox(cursor, y, widths[index], 8);
            graphics.DrawRectangle(new XSolidBrush(XColor.FromArgb(225, 232, 240)), Rect(cell));
            graphics.DrawRectangle(new XPen(XColors.Gray, 0.5), Rect(cell));
            graphics.DrawString(labels[index], Font(3, XFontStyleEx.Bold), XBrushes.Black, Rect(Inset(cell, 1)), XStringFormats.CenterLeft);
            cursor += widths[index];
        }
        Trace(PdfRegistryIds.Table, page, new(x, y, widths.Sum(), 8), "table-header", traces);
    }

    private static void DrawRow(XGraphics graphics, OrderPosition position, double x, double y, double height, IReadOnlyList<double> widths)
    {
        var values = new[]
        {
            position.PositionNumber.ToString(GermanCulture), position.Description,
            position.Quantity.ToString("0.##", GermanCulture), position.Unit,
            position.UnitPrice.ToString("C2", GermanCulture), position.NetAmount.ToString("C2", GermanCulture)
        };
        var cursor = x;
        for (var index = 0; index < widths.Count; index++)
        {
            var cell = new PdfBox(cursor, y, widths[index], height);
            graphics.DrawRectangle(new XPen(XColors.LightGray, 0.4), Rect(cell));
            DrawWrappedText(graphics, values[index], Inset(cell, 1), 3.1, index >= 2 ? XStringFormats.TopRight : XStringFormats.TopLeft);
            cursor += widths[index];
        }
    }

    private static void DrawSummary(XGraphics graphics, PdfElementRegistry registry, Func<string, PdfBox> box,
        Order order, double flowY, int page, ICollection<PdfRenderTrace> traces)
    {
        var summary = box(PdfRegistryIds.Summary);
        var y = Math.Max(flowY, Math.Min(summary.Y, registry.Document.PageTemplate.BodyArea.Y + registry.Document.PageTemplate.BodyArea.Height - summary.Height));
        var effective = summary with { Y = y };
        graphics.DrawRectangle(new XPen(XColors.SteelBlue, 0.8), Rect(effective));
        DrawAmountLine(graphics, effective.X + 1, y + 1, effective.Width - 2, 5, "Zwischensumme", order.NetTotal, 3.3, false);
        DrawAmountLine(graphics, effective.X + 1, y + 7, effective.Width - 2, 5, "Umsatzsteuer 19 %", order.TaxAmount, 3.3, false);
        DrawAmountLine(graphics, effective.X + 1, y + 14, effective.Width - 2, 6, "Gesamtsumme", order.GrossTotal, 4, true);
        Trace(PdfRegistryIds.Summary, page, effective, "summary", traces);
        Trace(PdfRegistryIds.Subtotal, page, box(PdfRegistryIds.Subtotal) with { Y = y + 1 }, "summary-text", traces);
        Trace(PdfRegistryIds.Tax, page, box(PdfRegistryIds.Tax) with { Y = y + 7 }, "summary-text", traces);
        Trace(PdfRegistryIds.Total, page, box(PdfRegistryIds.Total) with { Y = y + 14 }, "summary-text", traces);
    }

    private static void DrawAmountLine(XGraphics graphics, double x, double y, double width, double height,
        string label, decimal amount, double fontSizeMm, bool bold)
    {
        var rect = new PdfBox(x, y, width, height);
        graphics.DrawString(label, Font(fontSizeMm, bold ? XFontStyleEx.Bold : XFontStyleEx.Regular), XBrushes.Black, Rect(rect), XStringFormats.CenterLeft);
        graphics.DrawString(amount.ToString("C2", GermanCulture), Font(fontSizeMm, bold ? XFontStyleEx.Bold : XFontStyleEx.Regular), XBrushes.Black, Rect(rect), XStringFormats.CenterRight);
    }

    private static void DrawFooter(XGraphics graphics, PdfElementRegistry registry, Func<string, PdfBox> box,
        int page, int totalPages, ICollection<PdfRenderTrace> traces)
    {
        var footer = box(PdfRegistryIds.Footer);
        graphics.DrawLine(new XPen(XColors.Gray, 0.6), Pt(footer.X), Pt(footer.Y), Pt(footer.X + footer.Width), Pt(footer.Y));
        DrawText(graphics, box(PdfRegistryIds.FooterContact), "Nordlicht Technik GmbH · Kiel · +49 431 555 760 · service@nordlicht.example", XFontStyleEx.Regular);
        if (totalPages > 0) DrawPageNumber(graphics, box(PdfRegistryIds.PageNumber), page, totalPages);
        Trace(PdfRegistryIds.Footer, page, footer, "footer", traces);
        Trace(PdfRegistryIds.FooterContact, page, box(PdfRegistryIds.FooterContact), "footer-text", traces);
        Trace(PdfRegistryIds.PageNumber, page, box(PdfRegistryIds.PageNumber), "page-number", traces);
    }

    private static void DrawPageNumber(XGraphics graphics, PdfBox box, int page, int totalPages) =>
        graphics.DrawString($"Seite {page} / {totalPages}", Font(box.FontSize ?? 2.8, XFontStyleEx.Regular), XBrushes.Black, Rect(box), XStringFormats.CenterRight);

    private static void DrawText(XGraphics graphics, PdfBox box, string value, XFontStyleEx style)
    {
        var positioned = EffectiveTextBox(box);
        DrawWrappedText(graphics, value, positioned, box.FontSize ?? 3.3, XStringFormats.TopLeft, style);
    }

    private static PdfBox EffectiveTextBox(PdfBox box) =>
        box with { X = box.X + (box.TextOffsetX ?? 0), Y = box.Y + (box.TextOffsetY ?? 0) };

    private static void DrawWrappedText(XGraphics graphics, string value, PdfBox box, double fontSizeMm,
        XStringFormat format, XFontStyleEx style = XFontStyleEx.Regular)
    {
        var lines = DeterministicPdfTextMeasurer.Wrap(value, box.Width, fontSizeMm);
        var lineHeight = fontSizeMm * 1.2;
        for (var index = 0; index < lines.Count && (index + 1) * lineHeight <= box.Height + 0.001; index++)
            graphics.DrawString(lines[index], Font(fontSizeMm, style), XBrushes.Black,
                Rect(new(box.X, box.Y + index * lineHeight, box.Width, lineHeight)), format);
    }

    private static void Trace(string id, int page, PdfBox box, string marker, ICollection<PdfRenderTrace> traces) => traces.Add(new(id, page, box, marker));
    private static XFont Font(double mm, XFontStyleEx style) => new("Arial", Pt(mm), style);
    private static XRect Rect(PdfBox box) => new(Pt(box.X), Pt(box.Y), Pt(box.Width), Pt(box.Height));
    private static PdfBox Inset(PdfBox box, double value) => new(box.X + value, box.Y + value, Math.Max(0.1, box.Width - 2 * value), Math.Max(0.1, box.Height - 2 * value));
    private static double Pt(double millimeter) => millimeter * 72d / 25.4d;
    private static XUnit Mm(double millimeter) => XUnit.FromMillimeter(millimeter);

    private static void ConfigureFonts()
    {
        if (Interlocked.Exchange(ref fontsConfigured, 1) == 0) GlobalFontSettings.UseWindowsFontsUnderWindows = true;
    }

    private static PdfRenderResult Fail(string code, string message, string path, IReadOnlyList<PdfRenderTrace> traces) =>
        new(false, code, message, path, 0, 0, traces);
}

public static class DeterministicPdfTextMeasurer
{
    private const double CharacterWidthFactor = 0.52;
    private const double LineHeightFactor = 1.2;

    public static IReadOnlyList<string> Wrap(string value, double widthMm, double fontSizeMm)
    {
        var maximumCharacters = Math.Max(1, (int)Math.Floor(widthMm / (fontSizeMm * CharacterWidthFactor)));
        var lines = new List<string>();
        foreach (var paragraph in value.Replace("\r", string.Empty, StringComparison.Ordinal).Split('\n'))
        {
            var current = string.Empty;
            foreach (var word in SplitLongWords(paragraph.Split(' ', StringSplitOptions.RemoveEmptyEntries), maximumCharacters))
            {
                var candidate = current.Length == 0 ? word : current + " " + word;
                if (candidate.Length <= maximumCharacters) current = candidate;
                else { if (current.Length > 0) lines.Add(current); current = word; }
            }
            lines.Add(current);
        }
        return lines.Count == 0 ? [string.Empty] : lines;
    }

    public static double RequiredHeight(string value, double widthMm, double fontSizeMm) =>
        Wrap(value, widthMm, fontSizeMm).Count * fontSizeMm * LineHeightFactor;

    private static IEnumerable<string> SplitLongWords(IEnumerable<string> words, int maximumCharacters)
    {
        foreach (var word in words)
            if (word.Length <= maximumCharacters) yield return word;
            else for (var index = 0; index < word.Length; index += maximumCharacters)
                yield return word.Substring(index, Math.Min(maximumCharacters, word.Length - index));
    }
}

public static class PdfTechnicalInspector
{
    public static PdfInspectionResult Inspect(string path)
    {
        try
        {
            var info = new FileInfo(path);
            if (!info.Exists || info.Length < 1024) return new(false, 0, info.Exists ? info.Length : 0, 0, 0, "PDF-Datei fehlt oder ist unplausibel klein.");
            using (var stream = File.OpenRead(path))
            {
                Span<byte> signature = stackalloc byte[5];
                if (stream.Read(signature) != signature.Length || !signature.SequenceEqual("%PDF-"u8))
                    return new(false, 0, info.Length, 0, 0, "PDF-Signatur fehlt.");
            }
            using var document = PdfReader.Open(path, PdfDocumentOpenMode.Import);
            if (document.PageCount == 0) return new(false, 0, info.Length, 0, 0, "PDF enthält keine Seite.");
            var page = document.Pages[0];
            return new(true, document.PageCount, info.Length, page.Width.Millimeter, page.Height.Millimeter, "PDF-Struktur ist lesbar.");
        }
        catch (Exception exception)
        {
            return new(false, 0, 0, 0, 0, "PDF-Strukturprüfung fehlgeschlagen: " + exception.Message);
        }
    }
}
