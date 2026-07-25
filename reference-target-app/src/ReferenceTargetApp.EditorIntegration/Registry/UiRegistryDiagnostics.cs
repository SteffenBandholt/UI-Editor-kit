using System.Collections.ObjectModel;

namespace ReferenceTargetApp.EditorIntegration.Registry;

public sealed record UiRegistryEntryDiagnostic(
    string ElementId,
    string ScopeId,
    string? ParentId,
    UiElementKind Kind,
    bool HasNativeReference,
    UiCapability Capabilities);

public sealed class UiRegistryDiagnostics
{
    public UiRegistryDiagnostics(IEnumerable<UiRegistryEntryDiagnostic> entries)
    {
        ArgumentNullException.ThrowIfNull(entries);
        Entries = new ReadOnlyCollection<UiRegistryEntryDiagnostic>(entries.ToList());
    }

    public int Count => Entries.Count;
    public IReadOnlyList<UiRegistryEntryDiagnostic> Entries { get; }
}
