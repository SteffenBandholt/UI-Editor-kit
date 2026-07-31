namespace ReferenceTargetApp.EditorIntegration.HostAdapter;

public sealed record TextResizeReadback(
    string Unit,
    double RequestedFontSize,
    double? ExpectedCurrentFontSize,
    double? PreviousFontSize,
    double? AppliedFontSize,
    double Tolerance,
    bool Changed,
    bool MatchesRequested);

internal sealed record TextResizeVerification(
    bool Success,
    string? ErrorCode,
    string Message,
    TextResizeReadback Readback);

internal static class TextResizeContract
{
    public const string Unit = "dip";
    public const double Tolerance = 0.02d;
    public const string ExpectedValueConflict = "text_resize_expected_value_conflict";
    public const string ReadbackMissing = "text_resize_readback_missing";
    public const string ReadbackMismatch = "text_resize_readback_mismatch";
    public const string NoEffect = "text_resize_no_effect";

    public static bool IsAlreadyApplied(ChangeRequest request, ElementLayoutState current)
    {
        if (request.Operation != HostAdapterOperations.TextResize || request.Payload is null ||
            !request.Payload.TryGetValue("text", out var rawText) || rawText is not IReadOnlyDictionary<string, object?> text ||
            !text.TryGetValue("fontSize", out var rawFontSize) || !TryFinite(rawFontSize, out var desiredFontSize) ||
            !current.FontSize.HasValue)
            return false;
        return Math.Abs(desiredFontSize - current.FontSize.Value) <= Tolerance;
    }

    public static TextResizeVerification VerifyExpectedCurrent(
        double requestedFontSize,
        double? expectedCurrentFontSize,
        double? previousFontSize)
    {
        var readback = CreateReadback(requestedFontSize, expectedCurrentFontSize, previousFontSize, null);
        if (expectedCurrentFontSize.HasValue && previousFontSize.HasValue &&
            Math.Abs(expectedCurrentFontSize.Value - previousFontSize.Value) > Tolerance)
            return new(false, ExpectedValueConflict, "Die aktuelle Schriftgroesse hat sich seit der Anforderung geaendert.", readback);
        return new(true, null, "Aktuelle Schriftgroesse stimmt mit der Anforderung ueberein.", readback);
    }

    public static TextResizeVerification VerifyReadback(
        double requestedFontSize,
        double? expectedCurrentFontSize,
        double? previousFontSize,
        double? appliedFontSize)
    {
        var readback = CreateReadback(requestedFontSize, expectedCurrentFontSize, previousFontSize, appliedFontSize);
        if (!previousFontSize.HasValue || !appliedFontSize.HasValue)
            return new(false, ReadbackMissing, "Die tatsaechliche Schriftgroesse konnte nicht vollstaendig zurueckgelesen werden.", readback);
        if (!readback.MatchesRequested)
            return new(false, ReadbackMismatch, "Die tatsaechlich angewandte Schriftgroesse entspricht nicht dem akzeptierten Zielwert.", readback);
        if (!readback.Changed)
            return new(false, NoEffect, "Die tatsaechliche Schriftgroesse blieb unveraendert.", readback);
        return new(true, null, "Schriftgroesse wurde am realen Ziel angewandt und zurueckgelesen.", readback);
    }

    private static TextResizeReadback CreateReadback(
        double requestedFontSize,
        double? expectedCurrentFontSize,
        double? previousFontSize,
        double? appliedFontSize) => new(
            Unit,
            requestedFontSize,
            expectedCurrentFontSize,
            previousFontSize,
            appliedFontSize,
            Tolerance,
            previousFontSize.HasValue && appliedFontSize.HasValue && Math.Abs(previousFontSize.Value - appliedFontSize.Value) > Tolerance,
            appliedFontSize.HasValue && Math.Abs(requestedFontSize - appliedFontSize.Value) <= Tolerance);

    private static bool TryFinite(object? value, out double number)
    {
        number = 0;
        if (value is null or bool or char or string || value is not IConvertible) return false;
        try
        {
            number = Convert.ToDouble(value, System.Globalization.CultureInfo.InvariantCulture);
            return double.IsFinite(number);
        }
        catch (Exception exception) when (exception is FormatException or InvalidCastException or OverflowException)
        {
            return false;
        }
    }
}
