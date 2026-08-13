using System.Windows;
using System.Windows.Controls;

namespace ReferenceTargetApp.EditorIntegration.Tables;

public static class TableWidthModes
{
    public const string Fixed = "fixed";
    public const string Auto = "auto";
    public const string Proportional = "proportional";
    public static readonly IReadOnlySet<string> All = new HashSet<string>([Fixed, Auto, Proportional], StringComparer.Ordinal);
}

public static class TableWrapModes
{
    public const string NoWrap = "noWrap";
    public const string WordWrap = "wordWrap";
    public const string CharacterWrap = "characterWrap";
    public const string Ellipsis = "ellipsis";
    public static readonly IReadOnlySet<string> All = new HashSet<string>([NoWrap, WordWrap, CharacterWrap, Ellipsis], StringComparer.Ordinal);
}

public static class TableOverflowModes
{
    public const string Clip = "clip";
    public const string Ellipsis = "ellipsis";
    public const string Visible = "visible";
    public const string Scroll = "scroll";
    public static readonly IReadOnlySet<string> All = new HashSet<string>([Clip, Ellipsis, Visible, Scroll], StringComparer.Ordinal);
}

public static class TableHorizontalOverflowModes
{
    public const string None = "none";
    public const string Auto = "auto";
    public const string Scroll = "scroll";
    public const string FitViewport = "fitViewport";
    public static readonly IReadOnlySet<string> All = new HashSet<string>([None, Auto, Scroll, FitViewport], StringComparer.Ordinal);
}

public static class TableRowHeightModes
{
    public const string Fixed = "fixed";
    public const string Auto = "auto";
    public const string Bounded = "bounded";
    public const string Ellipsis = "ellipsis";
    public static readonly IReadOnlySet<string> All = new HashSet<string>([Fixed, Auto, Bounded, Ellipsis], StringComparer.Ordinal);
}

public static class TableTopologyPolicies
{
    public const string PreserveTarget = "preserveTarget";
    public static readonly IReadOnlySet<string> All = new HashSet<string>([PreserveTarget], StringComparer.Ordinal);
}

public static class TableBoundaryResizePolicies
{
    public const string Independent = "independent";
    public const string AdjacentPreserveTotal = "adjacentPreserveTotal";
    public static readonly IReadOnlySet<string> All = new HashSet<string>([Independent, AdjacentPreserveTotal], StringComparer.Ordinal);
}

public sealed record TableBounds(double Left, double Top, double Width, double Height);

public sealed record TableColumnLayoutDefinition(
    string ColumnId,
    string DisplayName,
    string HeaderElementId,
    string DataCellTemplateId,
    double CurrentWidth,
    double MinimumWidth,
    double MaximumWidth,
    string WidthMode,
    bool Resizable,
    string WrapMode,
    string OverflowMode,
    string Alignment,
    bool Visibility,
    int Order,
    IReadOnlyList<string> LockedOps,
    string WidthSourceId,
    bool Flexible = false,
    int Priority = 0);

public sealed record TableLayoutDefinition(
    string TableId,
    string DisplayName,
    TableBounds Bounds,
    TableBounds ViewportBounds,
    TableBounds ContentBounds,
    string ParentId,
    IReadOnlyList<string> ColumnIds,
    string? RowTemplateId,
    string HorizontalOverflowMode,
    string VerticalOverflowMode,
    string WidthPolicy,
    double MinimumWidth,
    double MaximumWidth,
    double ReservedWidth,
    double ScrollbarWidth,
    string RowHeightMode,
    double MinimumRowHeight,
    double MaximumRowHeight,
    IReadOnlyList<TableColumnLayoutDefinition> Columns,
    string TopologyPolicy = TableTopologyPolicies.PreserveTarget,
    bool RequiresDedicatedWrapper = false,
    string BoundaryResizePolicy = TableBoundaryResizePolicies.Independent);

public sealed record TableLayoutMetrics(
    double ViewportWidth,
    double TableWidth,
    double ColumnWidth,
    double ReservedWidth,
    double ScrollbarWidth,
    double Overflow,
    IReadOnlyList<string> OverflowColumnIds)
{
    public bool HasHorizontalOverflow => Overflow > 0.5;
}

public sealed record TableFitPreview(
    bool FullyFitted,
    TableLayoutMetrics Before,
    TableLayoutMetrics After,
    IReadOnlyDictionary<string, double> ColumnWidths);

public sealed record TableElementLayoutState(
    string? TableId = null,
    string? ColumnId = null,
    string? WidthMode = null,
    string? WrapMode = null,
    string? OverflowMode = null,
    string? HorizontalOverflowMode = null,
    string? RowHeightMode = null,
    double? ViewportWidth = null,
    double? TableWidth = null,
    double? Overflow = null,
    IReadOnlyList<string>? OverflowColumnIds = null,
    double? LogicalWidth = null,
    double? EffectiveWidth = null,
    double? HeaderWidth = null,
    double? HeaderContentWidth = null,
    IReadOnlyList<double>? DataCellWidths = null,
    IReadOnlyList<double>? DataContentWidths = null,
    int? MountedDataCellCount = null,
    bool? RuntimeWidthValid = null,
    IReadOnlyList<string>? RuntimeWidthErrors = null);

public static class TableLayoutEngine
{
    public static IReadOnlyList<string> Validate(TableLayoutDefinition table)
    {
        ArgumentNullException.ThrowIfNull(table);
        var errors = new List<string>();
        if (string.IsNullOrWhiteSpace(table.TableId) || string.IsNullOrWhiteSpace(table.DisplayName) || string.IsNullOrWhiteSpace(table.ParentId))
            errors.Add("table_fields_missing");
        if (table.MinimumWidth <= 0 || table.MaximumWidth < table.MinimumWidth) errors.Add("table_width_limits_invalid");
        if (table.MinimumRowHeight <= 0 || table.MaximumRowHeight < table.MinimumRowHeight) errors.Add("table_row_height_limits_invalid");
        if (!TableHorizontalOverflowModes.All.Contains(table.HorizontalOverflowMode)) errors.Add("table_overflow_mode_invalid");
        if (!TableRowHeightModes.All.Contains(table.RowHeightMode)) errors.Add("table_row_height_mode_invalid");
        if (!TableTopologyPolicies.All.Contains(table.TopologyPolicy)) errors.Add("table_topology_policy_invalid");
        if (!TableBoundaryResizePolicies.All.Contains(table.BoundaryResizePolicy)) errors.Add("table_boundary_policy_invalid");
        if (table.RequiresDedicatedWrapper) errors.Add("table_wrapper_forbidden");
        if (table.ColumnIds.Count != table.Columns.Count || !table.ColumnIds.SequenceEqual(table.Columns.Select(column => column.ColumnId), StringComparer.Ordinal))
            errors.Add("table_column_order_invalid");
        if (table.Columns.Select(column => column.ColumnId).Distinct(StringComparer.Ordinal).Count() != table.Columns.Count)
            errors.Add("table_column_ids_invalid");
        foreach (var column in table.Columns)
        {
            if (string.IsNullOrWhiteSpace(column.ColumnId) || string.IsNullOrWhiteSpace(column.DisplayName) ||
                string.IsNullOrWhiteSpace(column.HeaderElementId) || string.IsNullOrWhiteSpace(column.DataCellTemplateId))
                errors.Add($"table_column_fields_missing:{column.ColumnId}");
            if (!string.Equals(column.ColumnId, column.WidthSourceId, StringComparison.Ordinal)) errors.Add($"table_column_width_source_invalid:{column.ColumnId}");
            if (column.MinimumWidth <= 0 || column.MaximumWidth < column.MinimumWidth || column.CurrentWidth < column.MinimumWidth || column.CurrentWidth > column.MaximumWidth)
                errors.Add($"table_column_width_limits_invalid:{column.ColumnId}");
            if (!TableWidthModes.All.Contains(column.WidthMode)) errors.Add($"table_column_width_mode_invalid:{column.ColumnId}");
            if (!TableWrapModes.All.Contains(column.WrapMode)) errors.Add($"table_column_wrap_mode_invalid:{column.ColumnId}");
            if (!TableOverflowModes.All.Contains(column.OverflowMode)) errors.Add($"table_column_overflow_mode_invalid:{column.ColumnId}");
        }
        return errors;
    }

    public static TableLayoutMetrics Measure(TableLayoutDefinition table)
    {
        var columns = table.Columns.Where(column => column.Visibility).ToArray();
        var columnWidth = columns.Sum(column => column.CurrentWidth);
        var tableWidth = Math.Max(table.ContentBounds.Width, columnWidth + table.ReservedWidth);
        var viewportWidth = Math.Max(0, table.ViewportBounds.Width - table.ScrollbarWidth);
        var overflow = Math.Max(0, tableWidth - viewportWidth);
        var remaining = overflow;
        var causes = new List<string>();
        foreach (var column in columns.OrderByDescending(column => column.CurrentWidth).ThenBy(column => column.Order))
        {
            if (remaining <= 0) break;
            if (column.CurrentWidth <= column.MinimumWidth) continue;
            causes.Add(column.ColumnId);
            remaining -= column.CurrentWidth - column.MinimumWidth;
        }
        return new(viewportWidth, tableWidth, columnWidth, table.ReservedWidth, table.ScrollbarWidth, overflow, causes);
    }

    public static TableFitPreview Fit(TableLayoutDefinition table, string? selectedColumnId = null)
    {
        var errors = Validate(table);
        if (errors.Count != 0) throw new InvalidOperationException(string.Join(",", errors));
        var before = Measure(table);
        var eligible = table.Columns.Where(column => column.Visibility && column.Resizable && column.CurrentWidth > column.MinimumWidth &&
            (string.IsNullOrWhiteSpace(selectedColumnId) || string.Equals(column.ColumnId, selectedColumnId, StringComparison.Ordinal))).ToArray();
        var flexible = eligible.Where(column => column.Flexible).ToArray();
        var flexibleCapacity = flexible.Sum(column => column.CurrentWidth - column.MinimumWidth);
        var candidates = string.IsNullOrWhiteSpace(selectedColumnId) && flexible.Length > 0 && flexibleCapacity >= before.Overflow
            ? flexible
            : eligible;
        var capacity = candidates.Sum(column => column.CurrentWidth - column.MinimumWidth);
        var shrink = Math.Min(before.Overflow, capacity);
        var widths = table.Columns.ToDictionary(column => column.ColumnId, column => column.CurrentWidth, StringComparer.Ordinal);
        var distributed = 0d;
        for (var index = 0; index < candidates.Length; index++)
        {
            var column = candidates[index];
            var available = column.CurrentWidth - column.MinimumWidth;
            var reduction = index == candidates.Length - 1 ? shrink - distributed : capacity > 0 ? shrink * available / capacity : 0;
            distributed += reduction;
            widths[column.ColumnId] = Math.Max(column.MinimumWidth, column.CurrentWidth - reduction);
        }
        var nextColumns = table.Columns.Select(column => column with { CurrentWidth = widths[column.ColumnId] }).ToArray();
        var next = table with
        {
            Columns = nextColumns,
            ContentBounds = table.ContentBounds with { Width = nextColumns.Where(column => column.Visibility).Sum(column => column.CurrentWidth) + table.ReservedWidth }
        };
        var after = Measure(next);
        return new(after.Overflow <= 0.5, before, after, widths);
    }

    public static TableLayoutDefinition ResizeBoundary(TableLayoutDefinition table, string leftColumnId, string rightColumnId, double delta)
    {
        var errors = Validate(table);
        if (errors.Count != 0) throw new InvalidOperationException(string.Join(",", errors));
        if (table.BoundaryResizePolicy != TableBoundaryResizePolicies.AdjacentPreserveTotal)
            throw new InvalidOperationException("Diese Tabelle erlaubt keine gekoppelte Spaltengrenzen-Änderung.");
        var columnIds = table.ColumnIds.ToArray();
        var leftIndex = Array.FindIndex(columnIds, id => string.Equals(id, leftColumnId, StringComparison.Ordinal));
        var rightIndex = Array.FindIndex(columnIds, id => string.Equals(id, rightColumnId, StringComparison.Ordinal));
        if (leftIndex < 0 || rightIndex != leftIndex + 1)
            throw new InvalidOperationException("Spaltengrenzen können nur zwischen zwei unmittelbar benachbarten Spalten verschoben werden.");
        if (!double.IsFinite(delta) || Math.Abs(delta) < 0.000001)
            throw new InvalidOperationException("Die Grenzverschiebung muss eine endliche Zahl ungleich null sein.");
        var left = table.Columns[leftIndex];
        var right = table.Columns[rightIndex];
        if (!left.Resizable || !right.Resizable || !left.Visibility || !right.Visibility)
            throw new InvalidOperationException("Beide Nachbarspalten müssen sichtbar und in der Breite veränderbar sein.");
        var nextLeft = left.CurrentWidth + delta;
        var nextRight = right.CurrentWidth - delta;
        if (nextLeft < left.MinimumWidth - 0.000001) throw new InvalidOperationException($"{left.DisplayName} kann nicht schmaler als {left.MinimumWidth:G} werden.");
        if (nextLeft > left.MaximumWidth + 0.000001) throw new InvalidOperationException($"{left.DisplayName} kann nicht breiter als {left.MaximumWidth:G} werden.");
        if (nextRight < right.MinimumWidth - 0.000001) throw new InvalidOperationException($"{right.DisplayName} kann nicht schmaler als {right.MinimumWidth:G} werden.");
        if (nextRight > right.MaximumWidth + 0.000001) throw new InvalidOperationException($"{right.DisplayName} kann nicht breiter als {right.MaximumWidth:G} werden.");
        var beforeTotal = table.Columns.Sum(column => column.CurrentWidth);
        var columns = table.Columns.Select((column, index) => index == leftIndex
            ? column with { CurrentWidth = nextLeft }
            : index == rightIndex
                ? column with { CurrentWidth = nextRight }
                : column).ToArray();
        if (Math.Abs(beforeTotal - columns.Sum(column => column.CurrentWidth)) > 0.000001)
            throw new InvalidOperationException("Die feste Tabellenbreite würde sich durch die Grenzverschiebung ändern.");
        return table with { Columns = columns, ContentBounds = table.ContentBounds with { Width = columns.Where(column => column.Visibility).Sum(column => column.CurrentWidth) + table.ReservedWidth } };
    }
}

public sealed class WpfTableColumnBinding
{
    public WpfTableColumnBinding(DataGrid owner, DataGridColumn column, TableColumnLayoutDefinition definition)
    {
        Owner = owner ?? throw new ArgumentNullException(nameof(owner));
        Column = column ?? throw new ArgumentNullException(nameof(column));
        Definition = definition ?? throw new ArgumentNullException(nameof(definition));
        BaselineDefinition = definition;
    }

    public DataGrid Owner { get; }
    public DataGridColumn Column { get; }
    public TableColumnLayoutDefinition Definition { get; private set; }
    public TableColumnLayoutDefinition BaselineDefinition { get; }
    public double CurrentWidth => Column.ActualWidth > 0 ? Column.ActualWidth : Definition.CurrentWidth;

    public void SetWidth(double width)
    {
        var clamped = Math.Clamp(width, Definition.MinimumWidth, Definition.MaximumWidth);
        Column.MinWidth = Definition.MinimumWidth;
        Column.MaxWidth = Definition.MaximumWidth;
        Column.Width = new DataGridLength(clamped, DataGridLengthUnitType.Pixel);
        Definition = Definition with { CurrentWidth = clamped, WidthMode = TableWidthModes.Fixed };
    }

    public void SetWidthMode(string mode)
    {
        if (!TableWidthModes.All.Contains(mode)) throw new ArgumentOutOfRangeException(nameof(mode));
        Column.Width = mode switch
        {
            TableWidthModes.Auto => DataGridLength.Auto,
            TableWidthModes.Proportional => new DataGridLength(Math.Max(0.001, Definition.CurrentWidth), DataGridLengthUnitType.Star),
            _ => new DataGridLength(Definition.CurrentWidth, DataGridLengthUnitType.Pixel),
        };
        Definition = Definition with { WidthMode = mode };
    }

    public void SetTextModes(string wrapMode, string overflowMode)
    {
        if (!TableWrapModes.All.Contains(wrapMode)) throw new ArgumentOutOfRangeException(nameof(wrapMode));
        if (!TableOverflowModes.All.Contains(overflowMode)) throw new ArgumentOutOfRangeException(nameof(overflowMode));
        if (Column is DataGridTextColumn textColumn)
        {
            var style = new Style(typeof(TextBlock), textColumn.ElementStyle);
            style.Setters.Add(new Setter(TextBlock.TextWrappingProperty, wrapMode is TableWrapModes.WordWrap or TableWrapModes.CharacterWrap ? TextWrapping.Wrap : TextWrapping.NoWrap));
            style.Setters.Add(new Setter(TextBlock.TextTrimmingProperty, wrapMode == TableWrapModes.Ellipsis || overflowMode == TableOverflowModes.Ellipsis ? TextTrimming.CharacterEllipsis : TextTrimming.None));
            style.Setters.Add(new Setter(FrameworkElement.MaxWidthProperty, Definition.MaximumWidth));
            textColumn.ElementStyle = style;
        }
        Definition = Definition with { WrapMode = wrapMode, OverflowMode = overflowMode };
    }

    public void Reset()
    {
        Definition = BaselineDefinition;
        SetWidth(BaselineDefinition.CurrentWidth);
        SetWidthMode(BaselineDefinition.WidthMode);
        SetTextModes(BaselineDefinition.WrapMode, BaselineDefinition.OverflowMode);
        Column.Visibility = BaselineDefinition.Visibility ? Visibility.Visible : Visibility.Collapsed;
    }
}

public sealed class WpfTableBinding
{
    public WpfTableBinding(DataGrid owner, TableLayoutDefinition definition, IReadOnlyList<WpfTableColumnBinding> columns)
    {
        Owner = owner ?? throw new ArgumentNullException(nameof(owner));
        Definition = definition ?? throw new ArgumentNullException(nameof(definition));
        BaselineDefinition = definition;
        Columns = columns ?? throw new ArgumentNullException(nameof(columns));
        if (TableLayoutEngine.Validate(definition).Count != 0) throw new ArgumentException("Tabellenvertrag ist ungültig.", nameof(definition));
        if (!definition.ColumnIds.SequenceEqual(columns.Select(column => column.Definition.ColumnId), StringComparer.Ordinal))
            throw new ArgumentException("WPF-Spaltenbindung stimmt nicht mit der Spaltenreihenfolge überein.", nameof(columns));
    }

    public DataGrid Owner { get; }
    public TableLayoutDefinition Definition { get; private set; }
    public TableLayoutDefinition BaselineDefinition { get; }
    public IReadOnlyList<WpfTableColumnBinding> Columns { get; }

    public TableLayoutDefinition Capture()
    {
        var viewportWidth = Owner.ActualWidth > 0 ? Owner.ActualWidth : Definition.ViewportBounds.Width;
        var columns = Columns.Select(binding => binding.Definition with { CurrentWidth = binding.CurrentWidth }).ToArray();
        Definition = Definition with
        {
            ViewportBounds = Definition.ViewportBounds with { Width = viewportWidth },
            ContentBounds = Definition.ContentBounds with { Width = columns.Where(column => column.Visibility).Sum(column => column.CurrentWidth) + Definition.ReservedWidth },
            Columns = columns,
        };
        return Definition;
    }

    public void ResizeBoundary(string leftColumnId, string rightColumnId, double delta)
    {
        var next = TableLayoutEngine.ResizeBoundary(Capture(), leftColumnId, rightColumnId, delta);
        foreach (var binding in Columns)
        {
            var column = next.Columns.Single(candidate => candidate.ColumnId == binding.Definition.ColumnId);
            binding.SetWidth(column.CurrentWidth);
            binding.SetWidthMode(column.WidthMode);
        }
        Capture();
    }

    public void Restore(TableLayoutDefinition definition)
    {
        foreach (var binding in Columns)
        {
            var column = definition.Columns.Single(candidate => candidate.ColumnId == binding.Definition.ColumnId);
            binding.SetWidth(column.CurrentWidth);
            binding.SetWidthMode(column.WidthMode);
            binding.SetTextModes(column.WrapMode, column.OverflowMode);
        }
        Definition = definition;
        SetHorizontalOverflowMode(definition.HorizontalOverflowMode);
        SetRowHeightMode(definition.RowHeightMode);
        Capture();
    }

    public TableFitPreview Fit(string? selectedColumnId = null)
    {
        var preview = TableLayoutEngine.Fit(Capture(), selectedColumnId);
        foreach (var binding in Columns) binding.SetWidth(preview.ColumnWidths[binding.Definition.ColumnId]);
        Capture();
        return preview;
    }

    public void SetHorizontalOverflowMode(string mode)
    {
        if (!TableHorizontalOverflowModes.All.Contains(mode)) throw new ArgumentOutOfRangeException(nameof(mode));
        ScrollViewer.SetHorizontalScrollBarVisibility(Owner, mode switch
        {
            TableHorizontalOverflowModes.None or TableHorizontalOverflowModes.FitViewport => ScrollBarVisibility.Disabled,
            TableHorizontalOverflowModes.Scroll => ScrollBarVisibility.Visible,
            _ => ScrollBarVisibility.Auto,
        });
        Definition = Definition with { HorizontalOverflowMode = mode };
    }

    public void SetRowHeightMode(string mode)
    {
        if (!TableRowHeightModes.All.Contains(mode)) throw new ArgumentOutOfRangeException(nameof(mode));
        Owner.MinRowHeight = Definition.MinimumRowHeight;
        Owner.RowHeight = mode == TableRowHeightModes.Fixed ? Definition.MinimumRowHeight : double.NaN;
        var rowStyle = Owner.RowStyle is null
            ? new Style(typeof(DataGridRow))
            : new Style(typeof(DataGridRow), Owner.RowStyle);
        rowStyle.Setters.Add(new Setter(FrameworkElement.MinHeightProperty, Definition.MinimumRowHeight));
        rowStyle.Setters.Add(new Setter(FrameworkElement.MaxHeightProperty,
            mode is TableRowHeightModes.Bounded or TableRowHeightModes.Ellipsis
                ? Definition.MaximumRowHeight
                : double.PositiveInfinity));
        Owner.RowStyle = rowStyle;
        Definition = Definition with { RowHeightMode = mode };
    }

    public void Reset()
    {
        foreach (var column in Columns) column.Reset();
        Definition = BaselineDefinition;
        SetHorizontalOverflowMode(BaselineDefinition.HorizontalOverflowMode);
        SetRowHeightMode(BaselineDefinition.RowHeightMode);
        Capture();
    }
}
