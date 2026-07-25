using ReferenceTargetApp.EditorIntegration.Registry;

namespace ReferenceTargetApp.EditorIntegration.CustomerDetails;

public sealed class CustomerDetailsRegistryFactory
{
    private const UiCapability FieldCapabilities = UiCapability.Position | UiCapability.Width |
        UiCapability.Height | UiCapability.TextPosition | UiCapability.FontSize;

    public UiElementRegistry Create(CustomerDetailsElementReferences elements)
    {
        ArgumentNullException.ThrowIfNull(elements);
        return new UiElementRegistry([
            Entry(CustomerDetailsRegistryIds.Scope, null, UiElementKind.Scope, "Kundendaten", 0, UiCapability.None, elements.Scope),
            Entry(CustomerDetailsRegistryIds.CoreGroup, CustomerDetailsRegistryIds.Scope, UiElementKind.Group, "Kundendaten", 10,
                UiCapability.Position | UiCapability.Width | UiCapability.Height, elements.CoreGroup),
            Entry(CustomerDetailsRegistryIds.CompanyName, CustomerDetailsRegistryIds.CoreGroup, UiElementKind.InputField, "Unternehmen", 20, FieldCapabilities, elements.CompanyName),
            Entry(CustomerDetailsRegistryIds.ContactName, CustomerDetailsRegistryIds.CoreGroup, UiElementKind.InputField, "Ansprechperson", 30, FieldCapabilities, elements.ContactName),
            Entry(CustomerDetailsRegistryIds.Email, CustomerDetailsRegistryIds.CoreGroup, UiElementKind.InputField, "E-Mail", 40, FieldCapabilities, elements.Email),
            Entry(CustomerDetailsRegistryIds.Street, CustomerDetailsRegistryIds.CoreGroup, UiElementKind.InputField, "Straße", 50, FieldCapabilities, elements.Street),
            Entry(CustomerDetailsRegistryIds.PostalCity, CustomerDetailsRegistryIds.CoreGroup, UiElementKind.InputField, "PLZ / Ort", 60, FieldCapabilities, elements.PostalCity),
            Entry(CustomerDetailsRegistryIds.CheckCustomer, CustomerDetailsRegistryIds.CoreGroup, UiElementKind.Button, "Kundendaten prüfen", 70, FieldCapabilities, elements.CheckCustomer)
        ]);
    }

    private static UiRegistryEntry Entry(string id, string? parentId, UiElementKind kind, string name, int order,
        UiCapability capabilities, System.Windows.FrameworkElement element) =>
        new(id, CustomerDetailsRegistryIds.Scope, parentId, kind, name, order, capabilities, element);
}
