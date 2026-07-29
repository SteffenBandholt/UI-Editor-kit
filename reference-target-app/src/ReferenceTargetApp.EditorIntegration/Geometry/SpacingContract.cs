namespace ReferenceTargetApp.EditorIntegration.Geometry;

public static class SpacingTargets
{
    public const string BeforeElement = "beforeElement";
    public const string AfterElement = "afterElement";
    public const string GroupPaddingLeft = "groupPaddingLeft";
    public const string GroupPaddingRight = "groupPaddingRight";
    public const string GroupPaddingTop = "groupPaddingTop";
    public const string GroupPaddingBottom = "groupPaddingBottom";
    public const string ChildGapHorizontal = "childGapHorizontal";
    public const string ChildGapVertical = "childGapVertical";
    public const string ReservedWidth = "reservedWidth";
    public const string ReservedHeight = "reservedHeight";

    public static IReadOnlySet<string> All { get; } = new HashSet<string>(StringComparer.Ordinal)
    {
        BeforeElement, AfterElement, GroupPaddingLeft, GroupPaddingRight, GroupPaddingTop,
        GroupPaddingBottom, ChildGapHorizontal, ChildGapVertical, ReservedWidth, ReservedHeight,
    };
}

public static class SpacingOperations
{
    public const string Increase = "spacingIncrease";
    public const string Decrease = "spacingDecrease";
    public const string Set = "spacingSet";
    public const string Reset = "spacingReset";
    public static IReadOnlySet<string> All { get; } = new HashSet<string>(StringComparer.Ordinal) { Increase, Decrease, Set, Reset };
}
