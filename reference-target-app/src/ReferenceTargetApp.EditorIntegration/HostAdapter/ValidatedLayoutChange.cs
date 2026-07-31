namespace ReferenceTargetApp.EditorIntegration.HostAdapter;

internal sealed record ValidatedLayoutChange(
    string Operation,
    double? X = null,
    double? Y = null,
    double? Width = null,
    double? Height = null,
    double? TextOffsetX = null,
    double? TextOffsetY = null,
    double? FontSize = null,
    double? ExpectedCurrentFontSize = null,
    bool? Visible = null,
    string? SpacingTarget = null,
    double? SpacingValue = null,
    IReadOnlyDictionary<string, object?>? TableIntent = null);
