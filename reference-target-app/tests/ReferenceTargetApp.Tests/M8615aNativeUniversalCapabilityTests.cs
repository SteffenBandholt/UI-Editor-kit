using System.IO;
using System.Reflection;
using System.Windows.Controls;
using ReferenceTargetApp.EditorIntegration.Electron;
using ReferenceTargetApp.EditorIntegration.Persistence;
using ReferenceTargetApp.EditorIntegration.Registry;

namespace ReferenceTargetApp.Tests;

[TestClass]
public sealed class M8615aNativeUniversalCapabilityTests
{
    private const UiCapability VisibleCapabilities =
        UiCapability.Position |
        UiCapability.Width |
        UiCapability.Height |
        UiCapability.Visibility;

    [TestMethod]
    public void ScopeAcceptsPosition()
    {
        StaTest.Run(() => AssertAccepted([
            Entry("scope", "scope", null, UiElementKind.Scope, VisibleCapabilities)
        ]));
    }

    [TestMethod]
    public void TableColumnAcceptsPositionAndHeight()
    {
        StaTest.Run(() => AssertAccepted([
            Entry("scope", "scope", null, UiElementKind.Scope),
            Entry("table", "scope", "scope", UiElementKind.Table),
            Entry("column", "scope", "table", UiElementKind.TableColumn,
                UiCapability.Position | UiCapability.Width | UiCapability.Height | UiCapability.Visibility)
        ]));
    }

    [TestMethod]
    public void TableHeaderBodyAndRowAcceptPosition()
    {
        StaTest.Run(() => AssertAccepted([
            Entry("scope", "scope", null, UiElementKind.Scope),
            Entry("table", "scope", "scope", UiElementKind.Table),
            Entry("header", "scope", "table", UiElementKind.TableHeader, VisibleCapabilities),
            Entry("body", "scope", "table", UiElementKind.TableBody, VisibleCapabilities),
            Entry("row", "scope", "body", UiElementKind.TableRow, VisibleCapabilities)
        ]));
    }

    [TestMethod]
    public void TableHeaderCellAcceptsPositionWidthAndHeight()
    {
        StaTest.Run(() => AssertAccepted(CellEntries(UiElementKind.TableHeaderCell)));
    }

    [TestMethod]
    public void TableDataCellAcceptsPositionWidthAndHeight()
    {
        StaTest.Run(() => AssertAccepted(CellEntries(UiElementKind.TableDataCell)));
    }

    [TestMethod]
    public void GroupWithVisibleTextAcceptsFontSize()
    {
        StaTest.Run(() => AssertAccepted([
            Entry("scope", "scope", null, UiElementKind.Scope),
            Entry("group", "scope", "scope", UiElementKind.Group, VisibleCapabilities | UiCapability.FontSize)
        ]));
    }

    [TestMethod]
    public void UnknownCapabilityRemainsRejected()
    {
        StaTest.Run(() => AssertInvalidCapability([
            Entry("scope", "scope", null, UiElementKind.Scope, (UiCapability)(1 << 20))
        ]));
    }

    [TestMethod]
    public void InvalidTableBindingRemainsBlocked()
    {
        var elements = new[]
        {
            RemoteEntry("scope", "root", null),
            RemoteEntry("table", "table", "scope"),
            RemoteEntry("column", "tableColumn", "table", ["resizeWidth"], "contentColumn")
        };
        var scope = new ElectronTargetSession.RemoteRegistryScope(
            "scope", "complete", elements.Select(element => element.Id).ToArray(), elements);

        var method = typeof(ElectronTargetSession).GetMethod("ValidateScope", BindingFlags.NonPublic | BindingFlags.Static);
        Assert.IsNotNull(method);
        var invocation = Assert.ThrowsExactly<TargetInvocationException>(() => method.Invoke(null, [scope]));
        var exception = Assert.IsInstanceOfType<ElectronEditorException>(invocation.InnerException);
        Assert.AreEqual(ElectronEditorErrorCodes.RegistryInvalid, exception.Code);
        StringAssert.Contains(exception.Message, "Spaltenbindung");
    }

    [TestMethod]
    public void WrongFingerprintRemainsBlocked()
    {
        StaTest.Run(() =>
        {
            var registry = new UiElementRegistry([
                Entry("scope", "scope", null, UiElementKind.Scope)
            ]);
            var options = new LayoutPersistenceOptions(Path.GetTempPath(), "app", "profile", "scope", "profile.json");
            var document = new PersistedLayoutDocument(
                PersistedLayoutDocumentFactory.SchemaVersion,
                options.ApplicationId,
                options.ProfileId,
                options.ScopeId,
                DateTimeOffset.UtcNow,
                $"sha256:{new string('0', 64)}",
                new PersistedLayoutState([
                    new PersistedElementLayout("scope", "scope", null, null, null, null, null, null, null)
                ]));

            var result = LayoutDocumentValidator.Validate(document, options, registry);

            Assert.IsFalse(result.Success);
            Assert.IsTrue(result.Errors.Any(error => error.Code == "incompatible_registry"));
        });
    }

    private static UiRegistryEntry[] CellEntries(UiElementKind kind) =>
    [
        Entry("scope", "scope", null, UiElementKind.Scope),
        Entry("table", "scope", "scope", UiElementKind.Table),
        Entry("column", "scope", "table", UiElementKind.TableColumn),
        Entry("cell", "scope", "column", kind, VisibleCapabilities | UiCapability.FontSize)
    ];

    private static UiRegistryEntry Entry(
        string id,
        string scopeId,
        string? parentId,
        UiElementKind kind,
        UiCapability capabilities = UiCapability.None) =>
        new(id, scopeId, parentId, kind, id, 0, capabilities, new Border());

    private static ElectronTargetSession.RemoteRegistrationEntry RemoteEntry(
        string id,
        string type,
        string? parentId,
        IReadOnlyList<string>? allowedOps = null,
        string? columnRole = null) =>
        new(
            id,
            id,
            type,
            type,
            parentId,
            0,
            true,
            allowedOps is { Count: > 0 },
            allowedOps ?? [],
            [],
            ColumnRole: columnRole,
            RefKey: $"ref:{id}",
            ReferenceResolved: true,
            Baseline: new(0, 0, 100, 30, 0, 0, 12, true, 10, 500, 10, 200),
            SemanticKey: id,
            RegistrationStatus: allowedOps is { Count: > 0 } ? "editorEnabled" : "editorContainer");

    private static void AssertAccepted(UiRegistryEntry[] entries)
    {
        var registry = new UiElementRegistry(entries);
        Assert.HasCount(entries.Length, registry.Entries);
    }

    private static void AssertInvalidCapability(UiRegistryEntry[] entries)
    {
        var exception = Assert.ThrowsExactly<UiRegistryValidationException>(() => new UiElementRegistry(entries));
        Assert.IsTrue(exception.Errors.Any(error => error.Code == UiRegistryValidationErrorCode.InvalidCapability));
    }
}
