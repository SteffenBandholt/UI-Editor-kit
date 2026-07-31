using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using ReferenceTargetApp.EditorIntegration.Tables;

namespace ReferenceTargetApp.EditorIntegration.HostAdapter;

internal sealed record WpfElementSnapshot(
    object Width,
    object Height,
    object Margin,
    object RenderTransform,
    DependencyProperty? PaddingProperty,
    object? Padding,
    DependencyProperty? FontSizeProperty,
    object? FontSize,
    BindingBase? FontSizeBinding,
    object Visibility,
    IReadOnlyDictionary<string, double> Spacing,
    DataGridLength? TableColumnWidth = null,
    TableColumnLayoutDefinition? TableColumnLayout = null,
    TableLayoutDefinition? TableLayout = null);
