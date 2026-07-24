using System.Windows;
using System.Windows.Controls;
using ReferenceTargetApp.EditorIntegration.OrderHeader;
using ReferenceTargetApp.EditorIntegration.Registry;
using ReferenceTargetApp.UI.Views;

namespace ReferenceTargetApp.Tests;

[TestClass]
[DoNotParallelize]
public sealed class OrderHeaderRegistryIntegrationTests
{
    private static readonly string[] ExpectedIds =
    [
        OrderHeaderRegistryIds.Scope,
        OrderHeaderRegistryIds.CoreGroup,
        OrderHeaderRegistryIds.OrderNumber,
        OrderHeaderRegistryIds.OrderDate,
        OrderHeaderRegistryIds.DueDate,
        OrderHeaderRegistryIds.Subject,
        OrderHeaderRegistryIds.ResponsiblePerson,
        OrderHeaderRegistryIds.Status
    ];

    [TestMethod]
    public void LoadedWindowRegistersExactlyTheOrderHeaderWithoutSideEffects()
    {
        StaTest.Run(() =>
        {
            var application = new ReferenceTargetApp.App();
            application.InitializeComponent();
            var window = new MainWindow();
            try
            {
                Assert.IsNull(window.UiRegistry, "Registry must not be built before the WPF Loaded event.");
                var activityBeforeRegistration = window.ViewModel.ActivityMessage;
                var layoutBeforeRegistration = CaptureLayout(window);

                window.RaiseEvent(new RoutedEventArgs(FrameworkElement.LoadedEvent));

                var registry = window.UiRegistry;
                Assert.IsNotNull(registry);
                CollectionAssert.AreEqual(ExpectedIds, registry.Entries.Select(entry => entry.ElementId).ToArray());
                Assert.AreEqual(activityBeforeRegistration, window.ViewModel.ActivityMessage, "Registry creation must not trigger a business action.");
                CollectionAssert.AreEqual(layoutBeforeRegistration, CaptureLayout(window), "Registry creation must not change WPF layout properties.");

                Assert.AreSame(window.OrderHeaderScope, registry.FindById(OrderHeaderRegistryIds.Scope)?.NativeElement);
                Assert.AreSame(window.OrderHeaderCoreGroup, registry.FindById(OrderHeaderRegistryIds.CoreGroup)?.NativeElement);
                Assert.AreSame(window.OrderNumberInput, registry.FindById(OrderHeaderRegistryIds.OrderNumber)?.NativeElement);
                Assert.AreSame(window.OrderDateInput, registry.FindById(OrderHeaderRegistryIds.OrderDate)?.NativeElement);
                Assert.AreSame(window.DueDateInput, registry.FindById(OrderHeaderRegistryIds.DueDate)?.NativeElement);
                Assert.AreSame(window.SubjectInput, registry.FindById(OrderHeaderRegistryIds.Subject)?.NativeElement);
                Assert.AreSame(window.ResponsiblePersonInput, registry.FindById(OrderHeaderRegistryIds.ResponsiblePerson)?.NativeElement);
                Assert.AreSame(window.OrderStatusIndicator, registry.FindById(OrderHeaderRegistryIds.Status)?.NativeElement);

                CollectionAssert.AreEqual(
                    new[] { OrderHeaderRegistryIds.CoreGroup, OrderHeaderRegistryIds.Status },
                    registry.GetChildren(OrderHeaderRegistryIds.Scope).Select(entry => entry.ElementId).ToArray());
                CollectionAssert.AreEqual(
                    new[]
                    {
                        OrderHeaderRegistryIds.OrderNumber,
                        OrderHeaderRegistryIds.OrderDate,
                        OrderHeaderRegistryIds.DueDate,
                        OrderHeaderRegistryIds.Subject,
                        OrderHeaderRegistryIds.ResponsiblePerson
                    },
                    registry.GetChildren(OrderHeaderRegistryIds.CoreGroup).Select(entry => entry.ElementId).ToArray());
                Assert.HasCount(ExpectedIds.Length, registry.GetByScope(OrderHeaderRegistryIds.Scope));

                var nativeReferences = registry.Entries.Select(entry => entry.NativeElement).ToArray();
                Assert.IsFalse(nativeReferences.Contains(window.CustomerDataGroup));
                Assert.IsFalse(nativeReferences.Contains(window.PositionsTable));
                Assert.IsFalse(nativeReferences.Contains(window.TotalsGroup));
                Assert.IsFalse(nativeReferences.Contains(window.BusinessActionsGroup));
                Assert.IsFalse(nativeReferences.Contains(window.NewOrderButton));
                Assert.IsFalse(nativeReferences.Contains(window.AddPositionButton));
                Assert.IsFalse(nativeReferences.Contains(window.CheckOrderButton));
                Assert.IsFalse(nativeReferences.Contains(window.SaveOrderButton));

                var diagnostics = window.RegistryDiagnostics;
                Assert.IsNotNull(diagnostics);
                Assert.AreEqual(ExpectedIds.Length, diagnostics.Count);
                Assert.IsTrue(diagnostics.Entries.All(entry => entry.HasNativeReference));

                window.CheckOrderButton.RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
                Assert.AreEqual("Plausibilitätsprüfung ohne Beanstandung abgeschlossen", window.ViewModel.ActivityMessage,
                    "Business buttons must remain ordinary WPF actions independent from the registry.");
            }
            finally
            {
                window.Close();
                application.Shutdown();
            }
        });
    }

    private static object[] CaptureLayout(MainWindow window) =>
    [
        window.OrderHeaderScope.Width,
        window.OrderHeaderScope.Height,
        window.OrderHeaderScope.Margin,
        window.OrderHeaderCoreGroup.Width,
        window.OrderHeaderCoreGroup.Height,
        window.OrderHeaderCoreGroup.Margin,
        window.OrderNumberInput.Width,
        window.OrderNumberInput.Height,
        window.OrderNumberInput.Margin,
        window.OrderStatusIndicator.Width,
        window.OrderStatusIndicator.Height,
        window.OrderStatusIndicator.Margin
    ];
}
