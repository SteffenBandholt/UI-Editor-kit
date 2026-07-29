using ReferenceTargetApp.EditorIntegration.Registry;
using ReferenceTargetApp.EditorIntegration.Geometry;

namespace ReferenceTargetApp.EditorIntegration.OrderHeader;

public sealed class OrderHeaderRegistryFactory
{
    private const UiCapability TextCapabilities =
        UiCapability.Position |
        UiCapability.Width |
        UiCapability.Height |
        UiCapability.TextPosition |
        UiCapability.FontSize;

    public IUiElementRegistry Create(OrderHeaderElementReferences elements)
    {
        ArgumentNullException.ThrowIfNull(elements);

        return new UiElementRegistry([
            new(OrderHeaderRegistryIds.Scope, OrderHeaderRegistryIds.Scope, null, UiElementKind.Scope, "Auftragskopf", 0, UiCapability.None, elements.Scope),
            new(OrderHeaderRegistryIds.CoreGroup, OrderHeaderRegistryIds.Scope, OrderHeaderRegistryIds.Scope, UiElementKind.Group, "Kerndaten", 10, UiCapability.Position | UiCapability.Width | UiCapability.Height | UiCapability.Spacing, elements.CoreGroup,
                SpacingTargets: [SpacingTargets.GroupPaddingLeft, SpacingTargets.GroupPaddingRight]),
            new(OrderHeaderRegistryIds.OrderNumber, OrderHeaderRegistryIds.Scope, OrderHeaderRegistryIds.CoreGroup, UiElementKind.InputField, "Auftragsnummer", 20, TextCapabilities | UiCapability.Spacing, elements.OrderNumber,
                SpacingTargets: [SpacingTargets.BeforeElement, SpacingTargets.AfterElement, SpacingTargets.ReservedWidth]),
            new(OrderHeaderRegistryIds.OrderDate, OrderHeaderRegistryIds.Scope, OrderHeaderRegistryIds.CoreGroup, UiElementKind.InputField, "Auftragsdatum", 30, TextCapabilities, elements.OrderDate),
            new(OrderHeaderRegistryIds.DueDate, OrderHeaderRegistryIds.Scope, OrderHeaderRegistryIds.CoreGroup, UiElementKind.InputField, "Fällig am", 40, TextCapabilities, elements.DueDate),
            new(OrderHeaderRegistryIds.Subject, OrderHeaderRegistryIds.Scope, OrderHeaderRegistryIds.CoreGroup, UiElementKind.InputField, "Betreff", 50, TextCapabilities, elements.Subject),
            new(OrderHeaderRegistryIds.ResponsiblePerson, OrderHeaderRegistryIds.Scope, OrderHeaderRegistryIds.CoreGroup, UiElementKind.InputField, "Verantwortlich", 60, TextCapabilities, elements.ResponsiblePerson),
            new(OrderHeaderRegistryIds.Status, OrderHeaderRegistryIds.Scope, OrderHeaderRegistryIds.Scope, UiElementKind.StatusIndicator, "Status", 70, TextCapabilities, elements.Status)
        ]);
    }
}
