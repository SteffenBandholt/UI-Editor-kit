namespace ReferenceTargetApp.EditorIntegration.Registry;

public interface IUiElementRegistry
{
    IReadOnlyList<UiRegistryEntry> Entries { get; }
    UiRegistryEntry? FindById(string elementId);
    IReadOnlyList<UiRegistryEntry> GetChildren(string parentId);
    IReadOnlyList<UiRegistryEntry> GetByScope(string scopeId);
    UiRegistryDiagnostics GetDiagnostics();
}
