using System.Windows.Controls;

namespace ReferenceTargetApp.EditorIntegration.OrderHeader;

public sealed record OrderHeaderElementReferences(
    GroupBox Scope,
    Grid CoreGroup,
    TextBox OrderNumber,
    TextBox OrderDate,
    TextBox DueDate,
    TextBox Subject,
    TextBox ResponsiblePerson,
    Border Status);
