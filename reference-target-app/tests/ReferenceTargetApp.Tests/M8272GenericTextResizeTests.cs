using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using ReferenceTargetApp.EditorIntegration.HostAdapter;
using ReferenceTargetApp.EditorIntegration.Persistence;
using ReferenceTargetApp.EditorIntegration.Registry;

namespace ReferenceTargetApp.Tests;

[TestClass]
public sealed class M8272GenericTextResizeTests
{
    [TestMethod]
    public void RegisteredControlReportsTheActualAppliedDipValue()
    {
        StaTest.Run(() =>
        {
            var field = new TextBox { FontSize = 14 };
            var adapter = Adapter(field, UiCapability.FontSize);

            var result = adapter.SubmitChangeRequest(Request(16, expectedCurrent: 14));

            Assert.IsTrue(result.Success, result.Message);
            Assert.AreEqual(16, field.FontSize, 0.001);
            Assert.IsNotNull(result.TextResize);
            Assert.AreEqual("dip", result.TextResize.Unit);
            Assert.AreEqual(14, result.TextResize.PreviousFontSize!.Value, 0.001);
            Assert.AreEqual(16, result.TextResize.AppliedFontSize!.Value, 0.001);
            Assert.IsTrue(result.TextResize.Changed);
            Assert.IsTrue(result.TextResize.MatchesRequested);
        });
    }

    [TestMethod]
    public void UnchangedValueIsRejectedAndDoesNotPretendSuccess()
    {
        StaTest.Run(() =>
        {
            var field = new TextBox { FontSize = 14 };
            var result = Adapter(field, UiCapability.FontSize).SubmitChangeRequest(Request(14, expectedCurrent: 14));

            Assert.IsFalse(result.Success);
            Assert.AreEqual("text_resize_no_effect", result.ErrorCode);
            Assert.AreEqual(14, field.FontSize, 0.001);
            Assert.IsNotNull(result.TextResize);
            Assert.IsFalse(result.TextResize.Changed);
        });
    }

    [TestMethod]
    public void StaleExpectedValueIsRejectedBeforeNativeApply()
    {
        StaTest.Run(() =>
        {
            var field = new TextBox { FontSize = 15 };
            var result = Adapter(field, UiCapability.FontSize).SubmitChangeRequest(Request(16, expectedCurrent: 14));

            Assert.IsFalse(result.Success);
            Assert.AreEqual("text_resize_expected_value_conflict", result.ErrorCode);
            Assert.AreEqual(15, field.FontSize, 0.001);
        });
    }

    [TestMethod]
    public void TextBlockUsesTheSameGenericDependencyPropertyPath()
    {
        StaTest.Run(() =>
        {
            var label = new TextBlock { FontSize = 13 };
            var result = Adapter(label, UiCapability.FontSize).SubmitChangeRequest(Request(12.5, expectedCurrent: 13));

            Assert.IsTrue(result.Success, result.Message);
            Assert.AreEqual(12.5, label.FontSize, 0.001);
            Assert.AreEqual(12.5, result.TextResize!.AppliedFontSize!.Value, 0.001);
        });
    }

    [TestMethod]
    public void ExistingBindingIsPreservedWhileTheEffectiveValueChanges()
    {
        StaTest.Run(() =>
        {
            var source = new FontSizeSource { Value = 14 };
            var label = new TextBlock { DataContext = source };
            BindingOperations.SetBinding(label, TextBlock.FontSizeProperty,
                new Binding(nameof(FontSizeSource.Value)) { Mode = BindingMode.OneWay });
            Assert.AreEqual(14, label.FontSize, 0.001);

            var result = Adapter(label, UiCapability.FontSize).SubmitChangeRequest(Request(16, expectedCurrent: 14));

            Assert.IsTrue(result.Success, result.Message);
            Assert.AreEqual(16, label.FontSize, 0.001);
            Assert.AreEqual(16, result.TextResize!.AppliedFontSize!.Value, 0.001);
            Assert.IsNotNull(BindingOperations.GetBindingBase(label, TextBlock.FontSizeProperty));
        });
    }

    [TestMethod]
    public void CapabilityStillControlsWhetherTextResizeIsAllowed()
    {
        StaTest.Run(() =>
        {
            var field = new TextBox { FontSize = 14 };
            var result = Adapter(field, UiCapability.None).SubmitChangeRequest(Request(16, expectedCurrent: 14));

            Assert.IsFalse(result.Success);
            Assert.AreEqual(HostAdapterErrorCodes.OperationNotAllowed, result.ErrorCode);
            Assert.AreEqual(14, field.FontSize, 0.001);
        });
    }

    [TestMethod]
    public void UndoSkipsAnAlreadySatisfiedTrackedTextResizeAndRestoresTheChangedTarget()
    {
        StaTest.Run(() =>
        {
            var root = Path.Combine(Path.GetTempPath(), $"ui-editor-m82-7-2-{Guid.NewGuid():N}");
            Directory.CreateDirectory(root);
            try
            {
                var savedField = new TextBox { FontSize = 14 };
                var changedField = new TextBox { FontSize = 14 };
                var scope = new Grid();
                scope.Children.Add(savedField);
                scope.Children.Add(changedField);
                var adapter = new WpfHostAdapter(new UiElementRegistry([
                    new("scope", "scope", null, UiElementKind.Scope, "Bereich", 0, UiCapability.None, scope),
                    TextEntry("saved", "Gespeichert", 10, savedField),
                    TextEntry("changed", "Geaendert", 20, changedField),
                ]));
                var baseline = adapter.GetCurrentLayoutState();
                var session = new LayoutProfileSession(
                    new Dictionary<string, IHostAdapter>(StringComparer.Ordinal) { ["scope"] = adapter },
                    new Dictionary<string, LayoutState>(StringComparer.Ordinal) { ["scope"] = baseline },
                    new AtomicJsonLayoutProfileStore(root, "app"), new ActiveLayoutProfileStore(root),
                    LayoutProfileCatalog.StandardId);

                ApplyTextResize(session, adapter, "saved", 15, 14, "Gespeichertes Ziel");
                var save = session.SaveAsync().GetAwaiter().GetResult();
                Assert.IsTrue(save.Success, save.Message);
                session.ClearUndoHistory();

                ApplyTextResize(session, adapter, "changed", 16, 14, "Zweites Ziel");
                var undo = session.UndoAsync().GetAwaiter().GetResult();

                Assert.IsTrue(undo.Success, undo.Message);
                Assert.AreEqual(15, savedField.FontSize, 0.001, "Das bereits passende Ziel darf keinen No-effect-Fehler verursachen.");
                Assert.AreEqual(14, changedField.FontSize, 0.001, "Das tatsaechlich geaenderte Ziel muss wiederhergestellt werden.");
                Assert.IsFalse(session.GetUndoStatus().CanUndo);
            }
            finally
            {
                if (Directory.Exists(root)) Directory.Delete(root, recursive: true);
            }
        });
    }

    private static WpfHostAdapter Adapter(FrameworkElement target, UiCapability capability)
    {
        var scope = new Grid();
        scope.Children.Add(target);
        return new WpfHostAdapter(new UiElementRegistry([
            new("scope", "scope", null, UiElementKind.Scope, "Bereich", 0, UiCapability.None, scope),
            new("target", "scope", "scope", UiElementKind.StaticText, "Textziel", 10, capability, target,
                AllowedOperations: capability.HasFlag(UiCapability.FontSize) ? [HostAdapterOperations.TextResize] : []),
        ]));
    }

    private static ChangeRequest Request(double fontSize, double? expectedCurrent = null)
    {
        var text = new Dictionary<string, object?> { ["fontSize"] = fontSize, ["unit"] = "dip" };
        if (expectedCurrent.HasValue) text["expectedCurrentFontSize"] = expectedCurrent.Value;
        return new ChangeRequest(Guid.NewGuid().ToString("N"), "target", HostAdapterOperations.TextResize,
            new Dictionary<string, object?> { ["text"] = text }, DateTimeOffset.UtcNow, "m82-7-2-test", "scope");
    }

    private static UiRegistryEntry TextEntry(string id, string label, int order, FrameworkElement target) =>
        new(id, "scope", "scope", UiElementKind.InputField, label, order, UiCapability.FontSize, target,
            AllowedOperations: [HostAdapterOperations.TextResize]);

    private static void ApplyTextResize(
        LayoutProfileSession session,
        WpfHostAdapter adapter,
        string elementId,
        double fontSize,
        double expectedCurrent,
        string description)
    {
        session.BeginUndoFrame(description);
        var text = new Dictionary<string, object?>
        {
            ["fontSize"] = fontSize,
            ["unit"] = "dip",
            ["expectedCurrentFontSize"] = expectedCurrent,
        };
        var result = adapter.SubmitChangeRequest(new ChangeRequest(Guid.NewGuid().ToString("N"), elementId,
            HostAdapterOperations.TextResize, new Dictionary<string, object?> { ["text"] = text },
            DateTimeOffset.UtcNow, "m82-7-2-session-test", "scope"));
        Assert.IsTrue(result.Success, result.Message);
        session.RecordExplicitOperation("scope", elementId, HostAdapterOperations.TextResize);
        session.CommitUndoFrame();
    }

    private sealed class FontSizeSource
    {
        public double Value { get; init; }
    }
}
