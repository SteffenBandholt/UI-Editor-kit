using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Media;
using ReferenceTargetApp.EditorIntegration.Registry;

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
            entry.NativeElement.ReadLocalValue(UIElement.RenderTransformProperty),
            paddingProperty,
            paddingProperty is null ? null : entry.NativeElement.ReadLocalValue(paddingProperty),
            fontSizeProperty,
            fontSizeProperty is null ? null : entry.NativeElement.ReadLocalValue(fontSizeProperty),
            entry.NativeElement.ReadLocalValue(UIElement.VisibilityProperty));
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
            ReadEffectiveSize(element.Width, element.ActualWidth),
            ReadEffectiveSize(element.Height, element.ActualHeight),
            padding?.Left,
            padding?.Top,
            fontSize,
            element.Visibility == Visibility.Visible);
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
                element.Width = change.Width!.Value;
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
        RestoreLocalValue(element, UIElement.RenderTransformProperty, snapshot.RenderTransform);
        if (snapshot.PaddingProperty is not null && snapshot.Padding is not null)
            RestoreLocalValue(element, snapshot.PaddingProperty, snapshot.Padding);
        if (snapshot.FontSizeProperty is not null && snapshot.FontSize is not null)
            RestoreLocalValue(element, snapshot.FontSizeProperty, snapshot.FontSize);
        RestoreLocalValue(element, UIElement.VisibilityProperty, snapshot.Visibility);
    }

    private static (double X, double Y) ReadPosition(FrameworkElement element)
    {
        if (element.RenderTransform is TranslateTransform translation) return (translation.X, translation.Y);
        if (element.RenderTransform is null || element.RenderTransform.Value.IsIdentity) return (0, 0);
        throw new InvalidOperationException("Vorhandener RenderTransform ist keine reine Translation.");
    }

    private static double ReadEffectiveSize(double configured, double actual) =>
        double.IsNaN(configured) ? actual : configured;

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
