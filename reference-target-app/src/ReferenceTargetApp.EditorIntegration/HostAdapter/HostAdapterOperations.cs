namespace ReferenceTargetApp.EditorIntegration.HostAdapter;

public static class HostAdapterOperations
{
    public const string Move = "move";
    public const string Resize = "resize";
    public const string ResizeWidth = "resizeWidth";
    public const string ResizeHeight = "resizeHeight";
    public const string TextMove = "textMove";
    public const string TextResize = "textResize";
    public const string SetVisibility = "setVisibility";
    public const string SpacingIncrease = "spacingIncrease";
    public const string SpacingDecrease = "spacingDecrease";
    public const string SpacingSet = "spacingSet";
    public const string SpacingReset = "spacingReset";
    public const string FitTableToViewport = "fitTableToViewport";
    public const string ResizeColumnsProportionally = "resizeColumnsProportionally";
    public const string SetHorizontalOverflowMode = "setHorizontalOverflowMode";
    public const string SetColumnWidthMode = "setColumnWidthMode";
    public const string SetColumnWrapMode = "setColumnWrapMode";
    public const string SetColumnOverflowMode = "setColumnOverflowMode";
    public const string SetRowHeightMode = "setRowHeightMode";
    public const string ResetTableColumn = "resetTableColumn";
    public const string ResetTable = "resetTable";

    public static readonly IReadOnlySet<string> TableOperations = new HashSet<string>([
        FitTableToViewport, ResizeColumnsProportionally, SetHorizontalOverflowMode, SetColumnWidthMode,
        SetColumnWrapMode, SetColumnOverflowMode, SetRowHeightMode, ResetTableColumn, ResetTable
    ], StringComparer.Ordinal);
}
