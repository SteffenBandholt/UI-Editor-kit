using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Media;
using ReferenceTargetApp.EditorIntegration.Registry;
using ReferenceTargetApp.EditorIntegration.Geometry;

namespace ReferenceTargetApp.EditorIntegration.HostAdapter;

internal sealed class WpfLayoutAccess : IWpfLayoutAccess
{
    public WpfElementSnapshot Capture(UiRegistryEntry entry)
    {
        EnsureUiThread(entry.NativeElement);
        var paddingProperty = GetPaddingProperty(entry.NativeElement);
        var fontSizeProperty = GetFontSizeProperty(entry.NativeElement);
        return new WpfElementSnapshot(
            entry.NativeElement.ReadLocalValue(FrameworkElement.WidthProperty),
            entry.NativeElement.ReadLocalValue(FrameworkElement.HeightProperty),
            entry.NativeElement.ReadLocalValue(FrameworkElement.MarginProperty),
            entry.NativeElement.ReadLocalValue(UIElement.RenderTransformProperty),
            paddingProperty,
            paddingProperty is null ? null : entry.NativeElement.ReadLocalValue(paddingProperty),
            fontSizeProperty,
            fontSizeProperty is null ? null : entry.NativeElement.ReadLocalValue(fontSizeProperty),
            entry.NativeElement.ReadLocalValue(UIElement.VisibilityProperty),
            WpfSpacingState.Read(entry.NativeElement),
            entry.WpfTableColumnBinding?.Column.Width,
            entry.WpfTableColumnBinding?.Definition,
            entry.WpfTableBinding?.Capture());
    }

    public ElementLayoutState Read(UiRegistryEntry entry)
    {
        var element = entry.NativeElement;
        EnsureUiThread(element);
        var (x, y) = ReadPosition(element);
        var padding = entry.Capabilities.HasFlag(UiCapability.TextPosition) ? ReadPadding(element) : null;
        var fontSize = entry.Capabilities.HasFlag(UiCapability.FontSize) ? ReadFontSize(element) : null;
        return new ElementLayoutState(
            entry.ElementId,
            entry.ScopeId,
            x,
            y,
            entry.WpfTableColumnBinding?.CurrentWidth ?? ReadEffectiveSize(element.Width, element.ActualWidth),
            ReadEffectiveSize(element.Height, element.ActualHeight),
            padding?.Left,
            padding?.Top,
            fontSize,
            element.Visibility == Visibility.Visible,
            new Dictionary<string, double>(WpfSpacingState.Read(element), StringComparer.Ordinal),
            ReadTableState(entry));
    }

    public void Apply(UiRegistryEntry entry, ValidatedLayoutChange change)
    {
        var element = entry.NativeElement;
        EnsureUiThread(element);
        switch (change.Operation)
        {
            case HostAdapterOperations.Move:
                var position = ReadPosition(element);
                element.RenderTransform = new TranslateTransform(change.X ?? position.X, change.Y ?? position.Y);
                break;
            case HostAdapterOperations.ResizeWidth:
                if (entry.WpfTableColumnBinding is not null) entry.WpfTableColumnBinding.SetWidth(change.Width!.Value);
                else element.Width = change.Width!.Value;
                break;
            case HostAdapterOperations.ResizeHeight:
                element.Height = change.Height!.Value;
                break;
            case HostAdapterOperations.Resize:
                if (change.Width is not null) element.Width = change.Width.Value;
                if (change.Height is not null) element.Height = change.Height.Value;
                break;
            case HostAdapterOperations.TextMove:
                var padding = ReadPadding(element) ?? throw new InvalidOperationException("Element unterstützt keine Textposition.");
                SetPadding(element, new Thickness(
                    change.TextOffsetX ?? padding.Left,
                    change.TextOffsetY ?? padding.Top,
                    padding.Right,
                    padding.Bottom));
                break;
            case HostAdapterOperations.TextResize:
                SetFontSize(element, change.FontSize!.Value);
                break;
            case HostAdapterOperations.SetVisibility:
                element.Visibility = change.Visible == true ? Visibility.Visible : Visibility.Collapsed;
                break;
            case HostAdapterOperations.SpacingIncrease:
            case HostAdapterOperations.SpacingDecrease:
            case HostAdapterOperations.SpacingSet:
            case HostAdapterOperations.SpacingReset:
                ApplySpacing(element, change);
                break;
            case HostAdapterOperations.FitTableToViewport:
                entry.WpfTableBinding?.Fit(change.TableIntent?.GetValueOrDefault("selectedColumnId") as string);
                break;
            case HostAdapterOperations.ResizeColumnsProportionally:
                entry.WpfTableBinding?.Fit();
                break;
            case HostAdapterOperations.SetHorizontalOverflowMode:
                entry.WpfTableBinding?.SetHorizontalOverflowMode((string)change.TableIntent!["horizontalOverflowMode"]!);
                break;
            case HostAdapterOperations.SetColumnWidthMode:
                entry.WpfTableColumnBinding?.SetWidthMode((string)change.TableIntent!["widthMode"]!);
                break;
            case HostAdapterOperations.SetColumnWrapMode:
                entry.WpfTableColumnBinding?.SetTextModes((string)change.TableIntent!["wrapMode"]!, entry.WpfTableColumnBinding.Definition.OverflowMode);
                break;
            case HostAdapterOperations.SetColumnOverflowMode:
                entry.WpfTableColumnBinding?.SetTextModes(entry.WpfTableColumnBinding.Definition.WrapMode, (string)change.TableIntent!["overflowMode"]!);
                break;
            case HostAdapterOperations.SetRowHeightMode:
                entry.WpfTableBinding?.SetRowHeightMode((string)change.TableIntent!["rowHeightMode"]!);
                break;
            case HostAdapterOperations.ResetTableColumn:
                entry.WpfTableColumnBinding?.Reset();
                break;
            case HostAdapterOperations.ResetTable:
                entry.WpfTableBinding?.Reset();
                break;
            default:
                throw new InvalidOperationException($"Operation '{change.Operation}' ist nicht implementiert.");
        }
    }

    public void Restore(UiRegistryEntry entry, WpfElementSnapshot snapshot)
    {
        var element = entry.NativeElement;
        EnsureUiThread(element);
        RestoreLocalValue(element, FrameworkElement.WidthProperty, snapshot.Width);
        RestoreLocalValue(element, FrameworkElement.HeightProperty, snapshot.Height);
        RestoreLocalValue(element, FrameworkElement.MarginProperty, snapshot.Margin);
        RestoreLocalValue(element, UIElement.RenderTransformProperty, snapshot.RenderTransform);
        if (snapshot.PaddingProperty is not null && snapshot.Padding is not null)
            RestoreLocalValue(element, snapshot.PaddingProperty, snapshot.Padding);
        if (snapshot.FontSizeProperty is not null && snapshot.FontSize is not null)
            RestoreLocalValue(element, snapshot.FontSizeProperty, snapshot.FontSize);
        RestoreLocalValue(element, UIElement.VisibilityProperty, snapshot.Visibility);
        if (snapshot.Spacing.Count == 0) WpfSpacingState.Clear(element); else WpfSpacingState.Write(element, snapshot.Spacing);
        if (entry.WpfTableColumnBinding is not null && snapshot.TableColumnLayout is not null)
        {
            entry.WpfTableColumnBinding.SetWidth(snapshot.TableColumnLayout.CurrentWidth);
            entry.WpfTableColumnBinding.SetWidthMode(snapshot.TableColumnLayout.WidthMode);
            entry.WpfTableColumnBinding.SetTextModes(snapshot.TableColumnLayout.WrapMode, snapshot.TableColumnLayout.OverflowMode);
        }
        if (entry.WpfTableBinding is not null && snapshot.TableLayout is not null)
        {
            entry.WpfTableBinding.SetHorizontalOverflowMode(snapshot.TableLayout.HorizontalOverflowMode);
            entry.WpfTableBinding.SetRowHeightMode(snapshot.TableLayout.RowHeightMode);
        }
    }

    private static void ApplySpacing(FrameworkElement element, ValidatedLayoutChange change)
    {
        var target = change.SpacingTarget ?? throw new InvalidOperationException("Abstandsziel fehlt.");
        var previous = WpfSpacingState.Read(element);
        var values = previous.ToDictionary(pair => pair.Key, pair => pair.Value, StringComparer.Ordinal);
        var oldValue = values.GetValueOrDefault(target);
        var requested = change.SpacingValue ?? 0;
        var nextValue = change.Operation switch
        {
            HostAdapterOperations.SpacingIncrease => oldValue + requested,
            HostAdapterOperations.SpacingDecrease => Math.Max(0, oldValue - requested),
            HostAdapterOperations.SpacingSet => requested,
            HostAdapterOperations.SpacingReset => 0,
            _ => throw new InvalidOperationException("Abstandsoperation ist nicht implementiert."),
        };
        if (nextValue == 0) values.Remove(target); else values[target] = nextValue;

        var margin = element.Margin;
        var oldLeft = previous.GetValueOrDefault(SpacingTargets.BeforeElement);
        var oldRight = previous.GetValueOrDefault(SpacingTargets.AfterElement) + previous.GetValueOrDefault(SpacingTargets.ReservedWidth);
        var oldBottom = previous.GetValueOrDefault(SpacingTargets.ReservedHeight);
        var newLeft = values.GetValueOrDefault(SpacingTargets.BeforeElement);
        var newRight = values.GetValueOrDefault(SpacingTargets.AfterElement) + values.GetValueOrDefault(SpacingTargets.ReservedWidth);
        var newBottom = values.GetValueOrDefault(SpacingTargets.ReservedHeight);
        element.Margin = new(Math.Max(0, margin.Left - oldLeft + newLeft), margin.Top,
            Math.Max(0, margin.Right - oldRight + newRight), Math.Max(0, margin.Bottom - oldBottom + newBottom));

        var padding = ReadPadding(element);
        if (padding is not null)
        {
            var oldPadding = new Thickness(previous.GetValueOrDefault(SpacingTargets.GroupPaddingLeft), previous.GetValueOrDefault(SpacingTargets.GroupPaddingTop),
                previous.GetValueOrDefault(SpacingTargets.GroupPaddingRight), previous.GetValueOrDefault(SpacingTargets.GroupPaddingBottom));
            var newPadding = new Thickness(values.GetValueOrDefault(SpacingTargets.GroupPaddingLeft), values.GetValueOrDefault(SpacingTargets.GroupPaddingTop),
                values.GetValueOrDefault(SpacingTargets.GroupPaddingRight), values.GetValueOrDefault(SpacingTargets.GroupPaddingBottom));
            SetPadding(element, new(Math.Max(0, padding.Value.Left - oldPadding.Left + newPadding.Left), Math.Max(0, padding.Value.Top - oldPadding.Top + newPadding.Top),
                Math.Max(0, padding.Value.Right - oldPadding.Right + newPadding.Right), Math.Max(0, padding.Value.Bottom - oldPadding.Bottom + newPadding.Bottom)));
        }
        WpfSpacingState.Write(element, values);
    }

    private static (double X, double Y) ReadPosition(FrameworkElement element)
    {
        if (element.RenderTransform is TranslateTransform translation) return (translation.X, translation.Y);
        if (element.RenderTransform is null || element.RenderTransform.Value.IsIdentity) return (0, 0);
        throw new InvalidOperationException("Vorhandener RenderTransform ist keine reine Translation.");
    }

    private static double ReadEffectiveSize(double configured, double actual) =>
        double.IsNaN(configured) ? actual : configured;

    private static ReferenceTargetApp.EditorIntegration.Tables.TableElementLayoutState? ReadTableState(UiRegistryEntry entry)
    {
        if (entry.WpfTableColumnBinding is { } column)
            return new(entry.TableBinding?.GetValueOrDefault("tableId") ?? entry.ParentId ?? string.Empty,
                column.Definition.ColumnId, column.Definition.WidthMode, column.Definition.WrapMode, column.Definition.OverflowMode);
        if (entry.WpfTableBinding is { } table)
        {
            var definition = table.Capture();
            var metrics = ReferenceTargetApp.EditorIntegration.Tables.TableLayoutEngine.Measure(definition);
            return new(definition.TableId, HorizontalOverflowMode: definition.HorizontalOverflowMode,
                RowHeightMode: definition.RowHeightMode, ViewportWidth: metrics.ViewportWidth,
                TableWidth: metrics.TableWidth, Overflow: metrics.Overflow, OverflowColumnIds: metrics.OverflowColumnIds);
        }
        return null;
    }

    private static Thickness? ReadPadding(FrameworkElement element)
    {
        var property = GetPaddingProperty(element);
        return property is null ? null : (Thickness)element.GetValue(property);
    }

    private static void SetPadding(FrameworkElement element, Thickness padding)
    {
        var property = GetPaddingProperty(element) ?? throw new InvalidOperationException("Element besitzt keine Padding-Eigenschaft.");
        element.SetValue(property, padding);
    }

    private static double? ReadFontSize(FrameworkElement element)
    {
        var property = GetFontSizeProperty(element);
        return property is null ? null : (double)element.GetValue(property);
    }

    private static void SetFontSize(FrameworkElement element, double fontSize)
    {
        var property = GetFontSizeProperty(element) ?? throw new InvalidOperationException("Element besitzt keine Schriftgrößen-Eigenschaft.");
        element.SetValue(property, fontSize);
    }

    private static DependencyProperty? GetPaddingProperty(FrameworkElement element) => element switch
    {
        Control => Control.PaddingProperty,
        Border => Border.PaddingProperty,
        _ => null
    };

    private static DependencyProperty? GetFontSizeProperty(FrameworkElement element) => element switch
    {
        Control => Control.FontSizeProperty,
        Border => TextElement.FontSizeProperty,
        _ => null
    };

    private static void RestoreLocalValue(DependencyObject element, DependencyProperty property, object value)
    {
        if (ReferenceEquals(value, DependencyProperty.UnsetValue)) element.ClearValue(property);
        else element.SetValue(property, value);
    }

    private static void EnsureUiThread(FrameworkElement element)
    {
        if (!element.Dispatcher.CheckAccess())
            throw new InvalidOperationException("Nativer WPF-Zugriff muss auf dem UI-Dispatcher erfolgen.");
    }
}
