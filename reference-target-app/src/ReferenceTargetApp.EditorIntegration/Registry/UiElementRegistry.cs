using System.Collections.ObjectModel;

namespace ReferenceTargetApp.EditorIntegration.Registry;

public sealed class UiElementRegistry : IUiElementRegistry
{
    private readonly IReadOnlyDictionary<string, UiRegistryEntry> entriesById;

    public UiElementRegistry(IEnumerable<UiRegistryEntry> entries)
    {
        ArgumentNullException.ThrowIfNull(entries);
        var materializedEntries = entries.ToList();
        var errors = UiRegistryValidator.Validate(materializedEntries);
        if (errors.Count > 0) throw new UiRegistryValidationException(errors);

        var orderedEntries = materializedEntries
            .OrderBy(entry => entry.Order)
            .ThenBy(entry => entry.ElementId, StringComparer.Ordinal)
            .ToList();

        Entries = new ReadOnlyCollection<UiRegistryEntry>(orderedEntries);
        entriesById = new ReadOnlyDictionary<string, UiRegistryEntry>(
            orderedEntries.ToDictionary(entry => entry.ElementId, StringComparer.Ordinal));
    }

    public IReadOnlyList<UiRegistryEntry> Entries { get; }

    public UiRegistryEntry? FindById(string elementId)
    {
        if (string.IsNullOrWhiteSpace(elementId)) return null;
        return entriesById.GetValueOrDefault(elementId);
    }

    public IReadOnlyList<UiRegistryEntry> GetChildren(string parentId)
    {
        if (string.IsNullOrWhiteSpace(parentId)) return Array.Empty<UiRegistryEntry>();
        return new ReadOnlyCollection<UiRegistryEntry>(
            Entries.Where(entry => string.Equals(entry.ParentId, parentId, StringComparison.Ordinal)).ToList());
    }

    public IReadOnlyList<UiRegistryEntry> GetByScope(string scopeId)
    {
        if (string.IsNullOrWhiteSpace(scopeId)) return Array.Empty<UiRegistryEntry>();
        return new ReadOnlyCollection<UiRegistryEntry>(
            Entries.Where(entry => string.Equals(entry.ScopeId, scopeId, StringComparison.Ordinal)).ToList());
    }

    public UiRegistryDiagnostics GetDiagnostics() => new(
        Entries.Select(entry => new UiRegistryEntryDiagnostic(
            entry.ElementId,
            entry.ScopeId,
            entry.ParentId,
            entry.Kind,
            entry.NativeElement is not null,
            entry.Capabilities)));
}
