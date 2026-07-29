using System.Windows;
using ReferenceTargetApp.EditorIntegration.Tables;

namespace ReferenceTargetApp.EditorIntegration.Registry;

public sealed record UiRegistryEntry(
    string ElementId,
    string ScopeId,
    string? ParentId,
    UiElementKind Kind,
    string DisplayName,
    int Order,
    UiCapability Capabilities,
    FrameworkElement NativeElement,
    string? ProtocolType = null,
    string? ProtocolRole = null,
    IReadOnlyList<string>? AllowedOperations = null,
    IReadOnlyList<string>? LockedOperations = null,
    string? ColumnRole = null,
    string? FieldKind = null,
    string? ActionKind = null,
    string? ComponentKind = null,
    string? SelectionKind = null,
    IReadOnlyList<string>? SelectionLevels = null,
    IReadOnlyDictionary<string, string>? OperationEffects = null,
    IReadOnlyDictionary<string, IReadOnlyList<string>>? OperationAffectedIds = null,
    IReadOnlyList<string>? SpacingTargets = null,
    TableLayoutDefinition? TableLayout = null,
    TableColumnLayoutDefinition? TableColumnLayout = null,
    IReadOnlyDictionary<string, string>? TableBinding = null,
    IReadOnlyDictionary<string, object?>? RowLayout = null,
    WpfTableColumnBinding? WpfTableColumnBinding = null,
    WpfTableBinding? WpfTableBinding = null);
