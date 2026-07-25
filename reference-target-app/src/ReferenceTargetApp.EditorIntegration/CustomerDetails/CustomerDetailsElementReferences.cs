using System.Windows;

namespace ReferenceTargetApp.EditorIntegration.CustomerDetails;

public sealed record CustomerDetailsElementReferences(
    FrameworkElement Scope,
    FrameworkElement CoreGroup,
    FrameworkElement CompanyName,
    FrameworkElement ContactName,
    FrameworkElement Email,
    FrameworkElement Street,
    FrameworkElement PostalCity,
    FrameworkElement CheckCustomer);
