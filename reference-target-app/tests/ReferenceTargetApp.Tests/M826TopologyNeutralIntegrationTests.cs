using ReferenceTargetApp.EditorIntegration.Tables;
using ReferenceTargetApp.EditorIntegration.Topology;

namespace ReferenceTargetApp.Tests;

[TestClass]
public sealed class M826TopologyNeutralIntegrationTests
{
    private static readonly UiTopologyNode[] Baseline =
    [
        new("Grid", "scope", null, 0),
        new("Border", "header", "scope", 0),
        new("DataGrid", "table", "scope", 1),
        new("Grid", "edit", "scope", 2),
    ];

    [TestMethod]
    public void WpfFingerprintUsesControlRegistryParentAndOrder()
    {
        Assert.AreEqual(UiTopologyFingerprint.Create(Baseline), UiTopologyFingerprint.Create(Baseline.Reverse()));
    }

    [TestMethod]
    public void WpfFingerprintDetectsEditorWrapper()
    {
        var changed = Baseline.Append(new UiTopologyNode("ScrollViewer", "editor-wrapper", "scope", 3));
        var comparison = UiTopologyFingerprint.Compare(Baseline, changed);
        Assert.IsFalse(comparison.Success);
        Assert.AreEqual("target_ui_topology_changed", comparison.ErrorCode);
    }

    [TestMethod]
    public void WpfFingerprintIgnoresDeclaredDynamicDomainRows()
    {
        var changed = Baseline.Append(new UiTopologyNode("DataGridRow", "domain-row", "table", 0, DynamicContent: true));
        Assert.IsTrue(UiTopologyFingerprint.Compare(Baseline, changed).Success);
    }

    [TestMethod]
    public void WpfTableContractForbidsDedicatedEditorWrapper()
    {
        var definition = M824TableLayoutTests.DefinitionForTopologyTest() with { RequiresDedicatedWrapper = true };
        CollectionAssert.Contains(TableLayoutEngine.Validate(definition).ToArray(), "table_wrapper_forbidden");
    }
}
