using System.Collections.ObjectModel;
using System.Windows;

namespace ReferenceTargetApp.EditorIntegration.HostAdapter;

internal static class WpfSpacingState
{
    private static readonly DependencyProperty ValuesProperty = DependencyProperty.RegisterAttached(
        "Values", typeof(IReadOnlyDictionary<string, double>), typeof(WpfSpacingState), new PropertyMetadata(null));

    public static IReadOnlyDictionary<string, double> Read(DependencyObject element) =>
        element.GetValue(ValuesProperty) as IReadOnlyDictionary<string, double>
        ?? new ReadOnlyDictionary<string, double>(new Dictionary<string, double>(StringComparer.Ordinal));

    public static void Write(DependencyObject element, IReadOnlyDictionary<string, double> values) =>
        element.SetValue(ValuesProperty, new ReadOnlyDictionary<string, double>(values.ToDictionary(pair => pair.Key, pair => pair.Value, StringComparer.Ordinal)));

    public static void Clear(DependencyObject element) => element.ClearValue(ValuesProperty);
}
