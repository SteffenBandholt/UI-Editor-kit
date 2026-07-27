using System.Windows.Controls;
using ReferenceTargetApp.EditorIntegration.Registry;

namespace ReferenceTargetApp.Tests;

[TestClass]
public sealed class UiElementRegistryTests
{
    private const UiCapability TextCapabilities =
        UiCapability.Position |
        UiCapability.Width |
        UiCapability.Height |
        UiCapability.TextPosition |
        UiCapability.FontSize;

    [TestMethod]
    public void ValidRegistrySupportsStableReadOnlyQueriesAndDiagnostics()
    {
        StaTest.Run(() =>
        {
            var scopeReference = new GroupBox();
            var groupReference = new Grid();
            var fieldReference = new TextBox();
            var registry = new UiElementRegistry([
                Scope("scope", scopeReference),
                new("group", "scope", "scope", UiElementKind.Group, "Group", 10, UiCapability.Position | UiCapability.Width | UiCapability.Height, groupReference),
                new("field", "scope", "group", UiElementKind.InputField, "Field", 20, TextCapabilities, fieldReference)
            ]);

            Assert.HasCount(3, registry.Entries);
            Assert.AreSame(fieldReference, registry.FindById("field")?.NativeElement);
            Assert.IsNull(registry.FindById("unknown"));
            CollectionAssert.AreEqual(new[] { "group" }, registry.GetChildren("scope").Select(entry => entry.ElementId).ToArray());
            CollectionAssert.AreEqual(new[] { "scope", "group", "field" }, registry.GetByScope("scope").Select(entry => entry.ElementId).ToArray());

            var diagnostics = registry.GetDiagnostics();
            Assert.AreEqual(3, diagnostics.Count);
            Assert.IsTrue(diagnostics.Entries.All(entry => entry.HasNativeReference));
            Assert.AreEqual("group", diagnostics.Entries.Single(entry => entry.ElementId == "field").ParentId);
            Assert.AreEqual(TextCapabilities, diagnostics.Entries.Single(entry => entry.ElementId == "field").Capabilities);
        });
    }

    [TestMethod]
    public void InvalidIdsReferencesAndHierarchiesAreRejected()
    {
        StaTest.Run(() =>
        {
            AssertInvalid(UiRegistryValidationErrorCode.EmptyElementId, [Scope(string.Empty, new Border())]);
            AssertInvalid(UiRegistryValidationErrorCode.DuplicateElementId, [Scope("scope", new Border()), Scope("scope", new Border())]);
            AssertInvalid(UiRegistryValidationErrorCode.MissingNativeReference, [Scope("scope", null!)]);
            AssertInvalid(UiRegistryValidationErrorCode.UnknownParent, [
                Scope("scope", new Border()),
                Group("group", "scope", "missing", new Border())
            ]);
            AssertInvalid(UiRegistryValidationErrorCode.SelfParent, [
                Scope("scope", new Border()),
                Group("group", "scope", "group", new Border())
            ]);
            AssertInvalid(UiRegistryValidationErrorCode.ScopeMismatch, [
                Scope("scope-a", new Border()),
                Scope("scope-b", new Border()),
                Group("group", "scope-a", "scope-b", new Border())
            ]);
        });
    }

    [TestMethod]
    public void ParentCyclesAreRejected()
    {
        StaTest.Run(() => AssertInvalid(UiRegistryValidationErrorCode.ParentCycle, [
            Scope("scope", new Border()),
            Group("group-a", "scope", "group-b", new Border()),
            Group("group-b", "scope", "group-a", new Border())
        ]));
    }

    [TestMethod]
    public void CapabilitiesAreConstrainedByElementKind()
    {
        StaTest.Run(() =>
        {
            var editableScope = new UiElementRegistry([
                new("scope", "scope", null, UiElementKind.Scope, "Scope", 0,
                    UiCapability.Width | UiCapability.Height | UiCapability.Visibility, new Border())
            ]);
            Assert.AreEqual(
                UiCapability.Width | UiCapability.Height | UiCapability.Visibility,
                editableScope.FindById("scope")?.Capabilities);
            AssertInvalid(UiRegistryValidationErrorCode.InvalidCapability, [
                new("scope", "scope", null, UiElementKind.Scope, "Scope", 0, UiCapability.Position, new Border())
            ]);
            AssertInvalid(UiRegistryValidationErrorCode.InvalidCapability, [
                Scope("scope", new Border()),
                new("group", "scope", "scope", UiElementKind.Group, "Group", 10, UiCapability.FontSize, new Border())
            ]);
        });
    }

    private static UiRegistryEntry Scope(string id, System.Windows.FrameworkElement nativeElement) =>
        new(id, id, null, UiElementKind.Scope, "Scope", 0, UiCapability.None, nativeElement);

    private static UiRegistryEntry Group(
        string id,
        string scopeId,
        string parentId,
        System.Windows.FrameworkElement nativeElement) =>
        new(id, scopeId, parentId, UiElementKind.Group, "Group", 10, UiCapability.Position | UiCapability.Width | UiCapability.Height, nativeElement);

    private static void AssertInvalid(UiRegistryValidationErrorCode expectedCode, UiRegistryEntry[] entries)
    {
        var exception = Assert.ThrowsExactly<UiRegistryValidationException>(() => new UiElementRegistry(entries));
        Assert.IsTrue(exception.Errors.Any(error => error.Code == expectedCode),
            $"Expected validation error {expectedCode}, got: {string.Join(", ", exception.Errors.Select(error => error.Code))}");
    }
}
