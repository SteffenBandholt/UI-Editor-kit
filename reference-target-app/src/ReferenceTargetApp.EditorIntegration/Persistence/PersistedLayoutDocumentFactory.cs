using ReferenceTargetApp.EditorIntegration.HostAdapter;
using ReferenceTargetApp.EditorIntegration.Registry;

namespace ReferenceTargetApp.EditorIntegration.Persistence;

public static class PersistedLayoutDocumentFactory
{
    public const int SchemaVersion = 1;

    public static PersistedLayoutDocument Create(
        LayoutPersistenceOptions options,
        IUiElementRegistry registry,
        LayoutState layoutState,
        DateTimeOffset savedAt)
    {
        ArgumentNullException.ThrowIfNull(options);
        ArgumentNullException.ThrowIfNull(registry);
        ArgumentNullException.ThrowIfNull(layoutState);

        var states = layoutState.Elements.ToDictionary(element => element.ElementId, StringComparer.Ordinal);
        var elements = registry.Entries
            .OrderBy(entry => entry.Order)
            .ThenBy(entry => entry.ElementId, StringComparer.Ordinal)
            .Select(entry => CreateElement(entry, states.GetValueOrDefault(entry.ElementId)
                ?? throw new InvalidOperationException($"LayoutState fehlt für '{entry.ElementId}'.")))
            .ToArray();

        return new PersistedLayoutDocument(
            SchemaVersion,
            options.ApplicationId,
            options.ProfileId,
            options.ScopeId,
            savedAt,
            RegistryFingerprint.Create(registry),
            new PersistedLayoutState(elements));
    }

    private static PersistedElementLayout CreateElement(UiRegistryEntry entry, ElementLayoutState state) => new(
        entry.ElementId,
        entry.ScopeId,
        entry.Capabilities.HasFlag(UiCapability.Position) ? state.X : null,
        entry.Capabilities.HasFlag(UiCapability.Position) ? state.Y : null,
        entry.Capabilities.HasFlag(UiCapability.Width) ? state.Width : null,
        entry.Capabilities.HasFlag(UiCapability.Height) ? state.Height : null,
        entry.Capabilities.HasFlag(UiCapability.TextPosition) ? state.TextOffsetX : null,
        entry.Capabilities.HasFlag(UiCapability.TextPosition) ? state.TextOffsetY : null,
        entry.Capabilities.HasFlag(UiCapability.FontSize) ? state.FontSize : null,
        entry.Capabilities.HasFlag(UiCapability.Visibility) ? state.Visible : null);
}
