using System.Windows;

namespace ReferenceTargetApp.EditorIntegration.Registry;

public sealed record UiRegistryEntry(
    string ElementId,
    string ScopeId,
    string? ParentId,
    UiElementKind Kind,
    string DisplayName,
    int Order,
    UiCapability Capabilities,
    FrameworkElement NativeElement);
