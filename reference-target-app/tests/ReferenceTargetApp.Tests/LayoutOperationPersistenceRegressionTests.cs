using System.IO;
using System.Windows.Controls;
using ReferenceTargetApp.EditorIntegration.HostAdapter;
using ReferenceTargetApp.EditorIntegration.Persistence;
using ReferenceTargetApp.EditorIntegration.Registry;

namespace ReferenceTargetApp.Tests;

[TestClass]
public sealed class LayoutOperationPersistenceRegressionTests
{
    [TestMethod]
    public void SaveCompletesMissingOperationMetadataOnlyForExplicitlyEditedElements()
    {
        StaTest.Run(() =>
        {
            var root = Path.Combine(
                Path.GetTempPath(),
                $"ui-editor-operation-persistence-{Guid.NewGuid():N}");

            Directory.CreateDirectory(root);

            try
            {
                var edited = new TextBox
                {
                    Width = 100,
                    Height = 24
                };

                var neighbor = new TextBox
                {
                    Width = 120,
                    Height = 24
                };

                var scope = new Grid
                {
                    Width = 600,
                    Height = 300
                };

                scope.Children.Add(edited);
                scope.Children.Add(neighbor);

                var registry = new UiElementRegistry([
                    new(
                        "scope",
                        "scope",
                        null,
                        UiElementKind.Scope,
                        "Bereich",
                        0,
                        UiCapability.None,
                        scope),

                    new(
                        "edited",
                        "scope",
                        "scope",
                        UiElementKind.InputField,
                        "Bearbeitet",
                        10,
                        UiCapability.Position | UiCapability.Width,
                        edited,
                        ProtocolType: "field",
                        AllowedOperations:
                        [
                            HostAdapterOperations.Move,
                            HostAdapterOperations.ResizeWidth
                        ]),

                    new(
                        "neighbor",
                        "scope",
                        "scope",
                        UiElementKind.InputField,
                        "Nachbar",
                        20,
                        UiCapability.Position | UiCapability.Width,
                        neighbor,
                        ProtocolType: "field",
                        AllowedOperations:
                        [
                            HostAdapterOperations.Move,
                            HostAdapterOperations.ResizeWidth
                        ])
                ]);

                var adapter = new WpfHostAdapter(registry);
                var baseline = adapter.GetCurrentLayoutState();

                var store = new AtomicJsonLayoutProfileStore(root, "test-app");

                var session = new LayoutProfileSession(
                    new Dictionary<string, IHostAdapter>(StringComparer.Ordinal)
                    {
                        ["scope"] = adapter
                    },
                    new Dictionary<string, LayoutState>(StringComparer.Ordinal)
                    {
                        ["scope"] = baseline
                    },
                    store,
                    new ActiveLayoutProfileStore(root),
                    LayoutProfileCatalog.StandardId);

                Resize(adapter, "edited", 148);
                Resize(adapter, "neighbor", 176);

                // Simuliert unvollständige Metadaten:
                // Das Element ist als Benutzeränderung bekannt,
                // resizeWidth fehlt jedoch.
                session.RecordExplicitOperation(
                    "scope",
                    "edited",
                    HostAdapterOperations.Move);

                session.ConfigureSaveAcknowledgement((snapshot, _) =>
                {
                    var persistedScope = snapshot.Document.Scopes.Single();

                    Assert.IsNotNull(persistedScope.ExplicitOperations);

                    var editedOperations =
                        persistedScope.ExplicitOperations!["edited"];

                    CollectionAssert.Contains(
                        editedOperations.ToArray(),
                        HostAdapterOperations.Move);

                    CollectionAssert.Contains(
                        editedOperations.ToArray(),
                        HostAdapterOperations.ResizeWidth);

                    Assert.IsFalse(
                        persistedScope.ExplicitOperations.ContainsKey("neighbor"),
                        "Ein nur indirekt verändertes Nachbarelement darf keine persistenten Operations-Metadaten erhalten.");

                    return Task.FromResult(
                        new LayoutSaveAcknowledgement(
                            true,
                            "layout_save_acknowledged",
                            "bestätigt"));
                });

                var result =
                    session.SaveAsync().GetAwaiter().GetResult();

                Assert.IsTrue(result.Success, result.Message);
            }
            finally
            {
                if (Directory.Exists(root))
                    Directory.Delete(root, recursive: true);
            }
        });
    }

    private static void Resize(
        WpfHostAdapter adapter,
        string elementId,
        double width)
    {
        var result = adapter.SubmitChangeRequest(
            new ChangeRequest(
                Guid.NewGuid().ToString("N"),
                elementId,
                HostAdapterOperations.ResizeWidth,
                new Dictionary<string, object?>
                {
                    ["width"] = width
                },
                DateTimeOffset.UtcNow,
                "operation-persistence-regression",
                "scope"));

        Assert.IsTrue(result.Success, result.Message);
    }
}