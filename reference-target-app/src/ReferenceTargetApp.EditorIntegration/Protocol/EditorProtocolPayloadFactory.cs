using System.Text.Json.Serialization;
using ReferenceTargetApp.EditorIntegration.HostAdapter;
using ReferenceTargetApp.EditorIntegration.Registry;

namespace ReferenceTargetApp.EditorIntegration.Protocol;

internal static class EditorProtocolPayloadFactory
{
    public static object CreateRegistryPayload(IUiElementRegistry registry) => new
    {
        elements = registry.Entries.Select(entry => new ProtocolRegistryElement(
            entry.ElementId,
            entry.DisplayName,
            MapType(entry.Kind),
            MapRole(entry.Kind),
            entry.ParentId,
            entry.Order,
            true,
            entry.Capabilities != UiCapability.None,
            AllowedOperations(entry.Capabilities),
            Array.Empty<string>())).ToArray()
    };

    public static object CreateLayoutStatePayload(LayoutState state)
    {
        var elements = state.Elements.ToDictionary(
            element => element.ElementId,
            element => new ProtocolLayoutEntry(
                new ProtocolElementLayout(element.X, element.Y, element.Width, element.Height),
                element.TextOffsetX is null && element.TextOffsetY is null && element.FontSize is null
                    ? null
                    : new ProtocolTextLayout(element.TextOffsetX, element.TextOffsetY, element.FontSize)),
            StringComparer.Ordinal);

        return new
        {
            layoutState = new
            {
                schemaVersion = 1,
                targetAppId = "reference-target-app",
                uiScope = state.ScopeId,
                layoutScope = state.ScopeId,
                layoutProfileId = "runtime",
                version = 1,
                source = "default",
                updatedAt = state.CapturedAt,
                elements
            }
        };
    }

    private static string MapType(UiElementKind kind) => kind switch
    {
        UiElementKind.Scope => "root",
        UiElementKind.Group => "group",
        UiElementKind.StaticText => "label",
        UiElementKind.InputField => "field",
        UiElementKind.StatusIndicator => "statusIndicator",
        _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, null)
    };

    private static string MapRole(UiElementKind kind) => kind switch
    {
        UiElementKind.Scope or UiElementKind.Group => "layout",
        UiElementKind.StatusIndicator => "status",
        _ => "content"
    };

    private static string[] AllowedOperations(UiCapability capabilities)
    {
        var operations = new List<string>();
        if (capabilities.HasFlag(UiCapability.Position)) operations.Add(HostAdapterOperations.Move);
        if (capabilities.HasFlag(UiCapability.Width) && capabilities.HasFlag(UiCapability.Height)) operations.Add(HostAdapterOperations.Resize);
        if (capabilities.HasFlag(UiCapability.Width)) operations.Add(HostAdapterOperations.ResizeWidth);
        if (capabilities.HasFlag(UiCapability.Height)) operations.Add(HostAdapterOperations.ResizeHeight);
        if (capabilities.HasFlag(UiCapability.TextPosition)) operations.Add(HostAdapterOperations.TextMove);
        if (capabilities.HasFlag(UiCapability.FontSize)) operations.Add(HostAdapterOperations.TextResize);
        return operations.ToArray();
    }

    private sealed record ProtocolRegistryElement(
        string Id,
        string Name,
        string Type,
        string Role,
        [property: JsonIgnore(Condition = JsonIgnoreCondition.Never)] string? ParentId,
        int Order,
        bool Visible,
        bool Editable,
        string[] AllowedOps,
        string[] LockedOps);

    private sealed record ProtocolElementLayout(double X, double Y, double Width, double Height);
    private sealed record ProtocolTextLayout(double? OffsetX, double? OffsetY, double? FontSize);
    private sealed record ProtocolLayoutEntry(ProtocolElementLayout Element, ProtocolTextLayout? Text);
}
