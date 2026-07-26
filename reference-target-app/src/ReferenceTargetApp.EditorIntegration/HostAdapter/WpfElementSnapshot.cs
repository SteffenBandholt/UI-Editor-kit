using System.Windows;

namespace ReferenceTargetApp.EditorIntegration.HostAdapter;

internal sealed record WpfElementSnapshot(
    object Width,
    object Height,
    object RenderTransform,
    DependencyProperty? PaddingProperty,
    object? Padding,
    DependencyProperty? FontSizeProperty,
    object? FontSize,
    object Visibility);
