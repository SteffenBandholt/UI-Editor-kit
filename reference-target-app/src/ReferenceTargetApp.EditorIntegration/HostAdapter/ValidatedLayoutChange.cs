namespace ReferenceTargetApp.EditorIntegration.HostAdapter;

internal sealed record ValidatedLayoutChange(
    string Operation,
    double? X = null,
    double? Y = null,
    double? Width = null,
    double? Height = null,
    double? TextOffsetX = null,
    double? TextOffsetY = null,
    double? FontSize = null);
