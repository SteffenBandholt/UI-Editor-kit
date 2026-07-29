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
    double? FontSize,
    bool Visible = true,
    IReadOnlyDictionary<string, double>? Spacing = null)
{
    public bool Equals(ElementLayoutState? other) => other is not null &&
        ElementId == other.ElementId && ScopeId == other.ScopeId && X.Equals(other.X) && Y.Equals(other.Y) &&
        Width.Equals(other.Width) && Height.Equals(other.Height) && Nullable.Equals(TextOffsetX, other.TextOffsetX) &&
        Nullable.Equals(TextOffsetY, other.TextOffsetY) && Nullable.Equals(FontSize, other.FontSize) && Visible == other.Visible &&
        SameSpacing(Spacing, other.Spacing);

    public override int GetHashCode()
    {
        var hash = new HashCode();
        hash.Add(ElementId, StringComparer.Ordinal); hash.Add(ScopeId, StringComparer.Ordinal); hash.Add(X); hash.Add(Y);
        hash.Add(Width); hash.Add(Height); hash.Add(TextOffsetX); hash.Add(TextOffsetY); hash.Add(FontSize); hash.Add(Visible);
        foreach (var pair in (Spacing ?? new Dictionary<string, double>()).OrderBy(pair => pair.Key, StringComparer.Ordinal))
        { hash.Add(pair.Key, StringComparer.Ordinal); hash.Add(pair.Value); }
        return hash.ToHashCode();
    }

    private static bool SameSpacing(IReadOnlyDictionary<string, double>? left, IReadOnlyDictionary<string, double>? right)
    {
        var leftValues = left ?? new Dictionary<string, double>();
        var rightValues = right ?? new Dictionary<string, double>();
        return leftValues.Count == rightValues.Count && leftValues.All(pair => rightValues.TryGetValue(pair.Key, out var value) && value.Equals(pair.Value));
    }
}
