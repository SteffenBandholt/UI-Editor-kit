namespace ReferenceTargetApp.EditorIntegration.HostAdapter;

public sealed record ElementLayoutState(
    string ElementId,
    string ScopeId,
    double X,
    double Y,
    double Width,
    double Height,
    double? TextOffsetX,
    double? TextOffsetY,
    double? FontSize);
