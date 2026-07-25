using ReferenceTargetApp.EditorIntegration.Registry;

namespace ReferenceTargetApp.EditorIntegration.HostAdapter;

internal interface IWpfLayoutAccess
{
    WpfElementSnapshot Capture(UiRegistryEntry entry);
    ElementLayoutState Read(UiRegistryEntry entry);
    void Apply(UiRegistryEntry entry, ValidatedLayoutChange change);
    void Restore(UiRegistryEntry entry, WpfElementSnapshot snapshot);
}
