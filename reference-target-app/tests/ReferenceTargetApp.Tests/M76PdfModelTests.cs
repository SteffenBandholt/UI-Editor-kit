using System.IO;
using System.Text.Json.Nodes;
using ReferenceTargetApp.EditorIntegration.Pdf;
using ReferenceTargetApp.EditorIntegration.Persistence;
using ReferenceTargetApp.Infrastructure.SampleData;
using ReferenceTargetApp.PdfRendering;

namespace ReferenceTargetApp.Tests;

[TestClass]
[DoNotParallelize]
public sealed class M76PdfModelTests
{
    [TestMethod]
    public void TableColumnRegistryAllowsWholeUnitPositionWidthAndVisibility()
    {
        var registry = PdfOrderDocumentRegistryFactory.Create();
        var capabilities = PdfCapability.Position | PdfCapability.Width | PdfCapability.Visibility;
        var operations = new[] { PdfLayoutOperations.Inspect, PdfLayoutOperations.Move, PdfLayoutOperations.ResizeWidth, PdfLayoutOperations.SetVisibility };
        var entries = registry.Entries.Select(entry => entry.ElementId == PdfRegistryIds.TotalPriceColumn
            ? entry with
            {
                Capabilities = capabilities,
                AllowedOperations = operations,
                LockedOperations = entry.LockedOperations.Except(operations, StringComparer.Ordinal).ToArray(),
            }
            : entry).ToArray();
        var document = registry.Document;
        var candidate = new PdfDocumentDefinition(document.DocumentId, document.ApplicationId, document.DocumentType,
            document.PageFormat, document.Orientation, document.Unit, document.Margins, document.DefaultFont,
            document.PageTemplate, entries);

        var validation = PdfRegistryValidator.Validate(candidate);
        Assert.IsTrue(validation.Success, string.Join("; ", validation.Errors.Select(error => $"{error.ElementId}: {error.Message}")));
    }

    [TestMethod]
    public void RegistryIsNeutralCompleteAndCapabilitySafe()
    {
        var registry = PdfOrderDocumentRegistryFactory.Create();
        var validation = PdfRegistryValidator.Validate(registry.Document);
        Assert.IsTrue(validation.Success, string.Join("; ", validation.Errors.Select(error => error.Message)));
        Assert.AreEqual(PdfLayoutUnit.Millimeter, registry.Document.Unit);
        Assert.AreEqual(PdfPageFormat.A4, registry.Document.PageFormat);
        Assert.AreEqual(PdfPageOrientation.Portrait, registry.Document.Orientation);
        Assert.AreEqual(210d, registry.Document.PageTemplate.Width);
        Assert.AreEqual(297d, registry.Document.PageTemplate.Height);
        Assert.HasCount(26, registry.Entries);
        Assert.AreEqual(registry.Entries.Count, registry.Entries.Select(entry => entry.ElementId).Distinct(StringComparer.Ordinal).Count());
        Assert.IsTrue(registry.Entries.All(entry => entry.ElementId.StartsWith("pdf.", StringComparison.Ordinal)));
        Assert.IsFalse(registry.Entries.Any(entry => entry.ElementId.StartsWith("ui.", StringComparison.Ordinal)));
        Assert.IsTrue(registry.Entries.Where(entry => entry.ParentId is not null)
            .All(entry => registry.FindById(entry.ParentId!) is not null));
        Assert.HasCount(6, registry.Entries.Where(entry => entry.Kind == PdfElementKind.TableColumn));
        Assert.IsTrue(registry.Entries.Any(entry => entry.Kind == PdfElementKind.Image));
        Assert.IsTrue(registry.Entries.Any(entry => entry.Kind == PdfElementKind.Table));
        Assert.IsTrue(registry.Entries.Any(entry => entry.Kind == PdfElementKind.Header));
        Assert.IsTrue(registry.Entries.Any(entry => entry.Kind == PdfElementKind.Footer));
        Assert.IsTrue(registry.Entries.All(entry => !entry.AllowedOperations.Intersect(entry.LockedOperations, StringComparer.Ordinal).Any()));
        Assert.IsTrue(registry.Entries.Where(entry => entry.Kind == PdfElementKind.TableColumn)
            .All(entry => entry.Capabilities == PdfCapability.Width));
        Assert.IsTrue(registry.Entries.Where(entry => entry.Kind == PdfElementKind.Text)
            .All(entry => entry.Capabilities.HasFlag(PdfCapability.TextPosition) && entry.Capabilities.HasFlag(PdfCapability.FontSize)));

        var integrationAssembly = typeof(PdfElementRegistry).Assembly;
        Assert.IsFalse(integrationAssembly.GetReferencedAssemblies().Any(name => name.Name?.Contains("PdfSharp", StringComparison.OrdinalIgnoreCase) == true));
        var renderingAssembly = typeof(PdfOrderDocumentRenderer).Assembly;
        Assert.IsTrue(renderingAssembly.GetReferencedAssemblies().Any(name => name.Name?.Contains("PdfSharp", StringComparison.OrdinalIgnoreCase) == true));
        Assert.AreEqual(PdfRegistryFingerprint.Create(registry), PdfRegistryFingerprint.Create(PdfOrderDocumentRegistryFactory.Create()));

        var modifiedEntries = registry.Entries.Select(entry => entry.ElementId == PdfRegistryIds.Title
            ? entry with { Role = PdfElementRole.Meta }
            : entry).ToArray();
        var document = registry.Document;
        var modified = new PdfElementRegistry(new PdfDocumentDefinition(document.DocumentId, document.ApplicationId,
            document.DocumentType, document.PageFormat, document.Orientation, document.Unit, document.Margins,
            document.DefaultFont, document.PageTemplate, modifiedEntries));
        Assert.AreNotEqual(PdfRegistryFingerprint.Create(registry), PdfRegistryFingerprint.Create(modified));
    }

    [TestMethod]
    public void HostAdapterAppliesOnlyRegisteredCapabilityBoundedLayoutChanges()
    {
        var adapter = new PdfHostAdapter(PdfOrderDocumentRegistryFactory.Create());
        AssertSuccess(adapter, Request(PdfRegistryIds.Title, PdfLayoutOperations.Move, new() { ["x"] = 123d, ["y"] = 18d }));
        AssertSuccess(adapter, Request(PdfRegistryIds.Logo, PdfLayoutOperations.Resize,
            new() { ["width"] = 17d, ["height"] = 16d }));
        AssertSuccess(adapter, Request(PdfRegistryIds.DescriptionColumn, PdfLayoutOperations.ResizeWidth, new() { ["width"] = 65d }));
        AssertSuccess(adapter, Request(PdfRegistryIds.Sender, PdfLayoutOperations.TextMove,
            new() { ["text"] = new Dictionary<string, object?> { ["offsetX"] = 2d, ["offsetY"] = 1.5d } }));
        AssertSuccess(adapter, Request(PdfRegistryIds.Title, PdfLayoutOperations.TextResize,
            new() { ["text"] = new Dictionary<string, object?> { ["fontSize"] = 5.5d } }));

        AssertRejected(adapter, Request("pdf.unknown", PdfLayoutOperations.Move, new() { ["x"] = 1d }), PdfErrorCodes.UnknownElement);
        AssertRejected(adapter, Request(PdfRegistryIds.Logo, PdfLayoutOperations.TextResize,
            new() { ["text"] = new Dictionary<string, object?> { ["fontSize"] = 4d } }), PdfErrorCodes.OperationNotAllowed);
        AssertRejected(adapter, Request(PdfRegistryIds.Title, PdfLayoutOperations.Move, new() { ["x"] = double.NaN }), PdfErrorCodes.InvalidNumber);
        AssertRejected(adapter, Request(PdfRegistryIds.Title, PdfLayoutOperations.ResizeWidth, new() { ["width"] = 0d }), PdfErrorCodes.InvalidNumber);
        AssertRejected(adapter, Request(PdfRegistryIds.Title, PdfLayoutOperations.Move, new() { ["x"] = 200d }), PdfErrorCodes.OutOfPageBounds);
        AssertRejected(adapter, Request(PdfRegistryIds.Title, PdfLayoutOperations.Move, new() { ["y"] = 70d }), PdfErrorCodes.InvalidPageZone);
        AssertRejected(adapter, Request(PdfRegistryIds.DescriptionColumn, PdfLayoutOperations.ResizeWidth, new() { ["width"] = 4d }), PdfErrorCodes.InvalidColumnWidth);
        AssertRejected(adapter, Request(PdfRegistryIds.DescriptionColumn, PdfLayoutOperations.ResizeWidth, new() { ["width"] = 90d }), PdfErrorCodes.InvalidTableWidth);
        AssertRejected(adapter, Request(PdfRegistryIds.Table, PdfLayoutOperations.ResizeWidth, new() { ["width"] = 170d }), PdfErrorCodes.InvalidTableWidth);
        AssertRejected(adapter, Request(PdfRegistryIds.Header, PdfLayoutOperations.ResizeHeight, new() { ["height"] = 30d }), PdfErrorCodes.InvalidPageZone);
        AssertRejected(adapter, Request(PdfRegistryIds.Title, PdfLayoutOperations.Move,
            new() { ["x"] = 123d, ["orderNumber"] = "changed" }), PdfErrorCodes.ProfileInvalid);
    }

    [TestMethod]
    public async Task PdfBoundaryResizeIsAtomicPreservesTotalAndHasSingleUndoStep()
    {
        var root = NewRoot();
        try
        {
            var adapter = new PdfHostAdapter(PdfOrderDocumentRegistryFactory.Create());
            var session = new PdfLayoutSession(adapter, new AtomicJsonPdfLayoutProfileStore(root));
            var before = adapter.GetCurrentLayoutState();
            var beforeTotal = PdfRegistryIds.Columns.Sum(id => State(adapter, id).Width!.Value);
            var result = await session.ApplyBatchAsync([Request(PdfRegistryIds.Table, PdfLayoutOperations.ResizeColumnBoundary,
                new() { ["table"] = new Dictionary<string, object?>
                {
                    ["leftColumnId"] = PdfRegistryIds.DescriptionColumn,
                    ["rightColumnId"] = PdfRegistryIds.QuantityColumn,
                    ["delta"] = 5d
                } })]);
            Assert.IsTrue(result.Success, result.Message);
            Assert.AreEqual(75, State(adapter, PdfRegistryIds.DescriptionColumn).Width!.Value, 0.001);
            Assert.AreEqual(13, State(adapter, PdfRegistryIds.QuantityColumn).Width!.Value, 0.001);
            Assert.AreEqual(beforeTotal, PdfRegistryIds.Columns.Sum(id => State(adapter, id).Width!.Value), 0.001);
            Assert.IsTrue(session.CanUndo);
            var undoRequests = PdfLayoutSession.CreateRequests(adapter.GetCurrentLayoutState(), before, "pdf-undo", adapter.GetRegistry());
            Assert.HasCount(1, undoRequests);
            Assert.AreEqual(PdfLayoutOperations.ResizeColumnBoundary, undoRequests[0].Operation);
            Assert.AreEqual(PdfRegistryIds.Table, undoRequests[0].ElementId);
            Assert.IsTrue((await session.UndoAsync()).Success);
            Assert.AreEqual(70, State(adapter, PdfRegistryIds.DescriptionColumn).Width!.Value, 0.001);
            Assert.AreEqual(18, State(adapter, PdfRegistryIds.QuantityColumn).Width!.Value, 0.001);
            Assert.IsFalse(session.CanUndo);
        }
        finally { Delete(root); }
    }

    [TestMethod]
    public async Task PdfBoundarySaveAndReloadUsesAdjacentFlowPositions()
    {
        var root = NewRoot();
        try
        {
            var registry = PdfOrderDocumentRegistryFactory.Create();
            var adapter = new PdfHostAdapter(registry);
            var store = new AtomicJsonPdfLayoutProfileStore(root);
            var session = new PdfLayoutSession(adapter, store);
            var changed = await session.ApplyBatchAsync([Request(PdfRegistryIds.Table, PdfLayoutOperations.ResizeColumnBoundary,
                new() { ["table"] = new Dictionary<string, object?>
                {
                    ["leftColumnId"] = PdfRegistryIds.UnitPriceColumn,
                    ["rightColumnId"] = PdfRegistryIds.TotalPriceColumn,
                    ["delta"] = -5d
                } })]);
            Assert.IsTrue(changed.Success, changed.Message);
            Assert.AreEqual(23, State(adapter, PdfRegistryIds.UnitPriceColumn).Width!.Value, 0.001);
            Assert.AreEqual(37, State(adapter, PdfRegistryIds.TotalPriceColumn).Width!.Value, 0.001);

            var saved = await session.SaveAsync();
            Assert.IsTrue(saved.Success, saved.Message);

            var loaded = await store.LoadAsync(registry);
            Assert.IsTrue(loaded.Success, loaded.Message);
            Assert.IsTrue(loaded.Found);
            Assert.IsNotNull(loaded.Document);
            Assert.AreEqual(23, loaded.Document.LayoutState.Elements.Single(element => element.ElementId == PdfRegistryIds.UnitPriceColumn).Width!.Value, 0.001);
            Assert.AreEqual(37, loaded.Document.LayoutState.Elements.Single(element => element.ElementId == PdfRegistryIds.TotalPriceColumn).Width!.Value, 0.001);
        }
        finally { Delete(root); }
    }

    [TestMethod]
    public async Task PdfTableOriginalResetsCompleteTableAndHasOneUndoStep()
    {
        var root = NewRoot();
        try
        {
            var adapter = new PdfHostAdapter(PdfOrderDocumentRegistryFactory.Create());
            var session = new PdfLayoutSession(adapter, new AtomicJsonPdfLayoutProfileStore(root));
            Assert.IsTrue((await session.ApplyBatchAsync([Request(PdfRegistryIds.Table, PdfLayoutOperations.ResizeColumnBoundary,
                new() { ["table"] = new Dictionary<string, object?>
                {
                    ["leftColumnId"] = PdfRegistryIds.DescriptionColumn,
                    ["rightColumnId"] = PdfRegistryIds.QuantityColumn,
                    ["delta"] = 5d
                } })])).Success);

            Assert.IsTrue((await session.ResetTableAsync(PdfRegistryIds.Table)).Success);
            Assert.AreEqual(70, State(adapter, PdfRegistryIds.DescriptionColumn).Width!.Value, 0.001);
            Assert.AreEqual(18, State(adapter, PdfRegistryIds.QuantityColumn).Width!.Value, 0.001);
            Assert.IsTrue((await session.UndoAsync()).Success);
            Assert.AreEqual(75, State(adapter, PdfRegistryIds.DescriptionColumn).Width!.Value, 0.001);
            Assert.AreEqual(13, State(adapter, PdfRegistryIds.QuantityColumn).Width!.Value, 0.001);
        }
        finally { Delete(root); }
    }

    [TestMethod]
    public async Task PdfProfileHasIndependentSchemaAndSaveLoadDiscardResetSemantics()
    {
        var root = NewRoot();
        try
        {
            var registry = PdfOrderDocumentRegistryFactory.Create();
            var adapter = new PdfHostAdapter(registry);
            var store = new AtomicJsonPdfLayoutProfileStore(root);
            var session = new PdfLayoutSession(adapter, store);
            Assert.IsTrue((await session.ApplyBatchAsync([
                Request(PdfRegistryIds.Title, PdfLayoutOperations.Move, new() { ["x"] = 123d }),
                Request(PdfRegistryIds.DescriptionColumn, PdfLayoutOperations.ResizeWidth, new() { ["width"] = 65d })
            ])).Success);
            Assert.IsTrue(session.GetStatus().IsDirty);
            Assert.IsTrue((await session.SaveAsync()).Success);
            Assert.IsFalse(session.GetStatus().IsDirty);
            Assert.IsTrue(store.FilePath.EndsWith("pdf-layouts\\pdf-standard.pdf-layout.json", StringComparison.OrdinalIgnoreCase));
            var json = JsonNode.Parse(await File.ReadAllTextAsync(store.FilePath))!.AsObject();
            Assert.AreEqual(1, json["schemaVersion"]!.GetValue<int>());
            Assert.AreEqual("pdf-layout-profile", json["documentKind"]!.GetValue<string>());
            Assert.AreEqual("pdf-standard", json["profileId"]!.GetValue<string>());
            Assert.AreEqual(PdfRegistryIds.Scope, json["scopeId"]!.GetValue<string>());
            Assert.IsFalse(json.ToJsonString().Contains("ui.", StringComparison.Ordinal));
            Assert.IsEmpty(Directory.GetFiles(store.RootDirectory, "*.tmp"));

            AssertSuccess(adapter, Request(PdfRegistryIds.Title, PdfLayoutOperations.Move, new() { ["x"] = 121d }));
            Assert.IsTrue((await session.DiscardAsync()).Success);
            Assert.AreEqual(123d, State(adapter, PdfRegistryIds.Title).X);
            var persistedBeforeReset = await File.ReadAllTextAsync(store.FilePath);
            Assert.IsTrue((await session.ResetAsync()).Success);
            Assert.AreEqual(125d, State(adapter, PdfRegistryIds.Title).X);
            Assert.IsTrue(session.GetStatus().IsDirty);
            Assert.AreEqual(persistedBeforeReset, await File.ReadAllTextAsync(store.FilePath));
            Assert.IsTrue((await session.LoadAsync()).Success);
            Assert.AreEqual(123d, State(adapter, PdfRegistryIds.Title).X);
            Assert.IsFalse(session.GetStatus().IsDirty);
        }
        finally { Delete(root); }
    }

    [TestMethod]
    public async Task ProfileRejectsCorruptionWrongSchemaFingerprintAndUiProfileShape()
    {
        var root = NewRoot();
        try
        {
            var registry = PdfOrderDocumentRegistryFactory.Create();
            var store = new AtomicJsonPdfLayoutProfileStore(root);
            Assert.IsTrue((await store.SaveAsync(registry, PdfLayoutStateFactory.Baseline(registry))).Success);
            var original = await File.ReadAllTextAsync(store.FilePath);
            await Reject(document => document["schemaVersion"] = 99, PdfErrorCodes.ProfileInvalid);
            await Reject(document => document["applicationId"] = "other", PdfErrorCodes.ProfileInvalid);
            await Reject(document => document["profileId"] = "standard", PdfErrorCodes.ProfileInvalid);
            await Reject(document => document["scopeId"] = "ui.order", PdfErrorCodes.ProfileInvalid);
            await Reject(document => document["registryFingerprint"] = "wrong", PdfErrorCodes.LayoutIncompatible);
            await Reject(document => document["layoutState"]!["elements"]!.AsArray().RemoveAt(0), PdfErrorCodes.ProfileInvalid);
            await File.WriteAllTextAsync(store.FilePath, "{not-json");
            Assert.AreEqual(PdfErrorCodes.ProfileInvalid, (await store.LoadAsync(registry)).Code);
            await File.WriteAllTextAsync(store.FilePath, "{\"schemaVersion\":2,\"profileId\":\"standard\",\"scopes\":[]}");
            Assert.AreEqual(PdfErrorCodes.ProfileInvalid, (await store.LoadAsync(registry)).Code);

            await File.WriteAllTextAsync(store.FilePath, original);
            var uiStore = new AtomicJsonLayoutProfileStore(root);
            await File.WriteAllTextAsync(uiStore.GetFilePath(LayoutProfileCatalog.StandardId), original);
            var uiLoad = await uiStore.LoadAsync(LayoutProfileCatalog.StandardId,
                new Dictionary<string, ReferenceTargetApp.EditorIntegration.HostAdapter.IHostAdapter>());
            Assert.IsFalse(uiLoad.Success);

            async Task Reject(Action<JsonObject> mutate, string code)
            {
                var document = JsonNode.Parse(original)!.AsObject();
                mutate(document);
                await File.WriteAllTextAsync(store.FilePath, document.ToJsonString());
                var loaded = await store.LoadAsync(registry);
                Assert.IsFalse(loaded.Success);
                Assert.AreEqual(code, loaded.Code);
            }
        }
        finally { Delete(root); }
    }

    [TestMethod]
    public async Task FailedProfileWritePreservesPreviousFileAndDirtyWorkingState()
    {
        var root = NewRoot();
        try
        {
            var adapter = new PdfHostAdapter(PdfOrderDocumentRegistryFactory.Create());
            var store = new AtomicJsonPdfLayoutProfileStore(root);
            var session = new PdfLayoutSession(adapter, store);
            Assert.IsTrue((await session.SaveAsync()).Success);
            var original = await File.ReadAllBytesAsync(store.FilePath);
            AssertSuccess(adapter, Request(PdfRegistryIds.Title, PdfLayoutOperations.Move, new() { ["x"] = 123d }));
            using (new FileStream(store.FilePath, FileMode.Open, FileAccess.Read, FileShare.Read))
            {
                var failed = await session.SaveAsync();
                Assert.IsFalse(failed.Success);
                Assert.AreEqual(PdfErrorCodes.SaveFailed, failed.Code);
            }
            CollectionAssert.AreEqual(original, await File.ReadAllBytesAsync(store.FilePath));
            Assert.IsTrue(session.GetStatus().IsDirty);
            Assert.IsEmpty(Directory.GetFiles(store.RootDirectory, "*.tmp"));
        }
        finally { Delete(root); }
    }

    [TestMethod]
    public async Task FailedBatchRollsBackAllEarlierPdfChanges()
    {
        var root = NewRoot();
        try
        {
            var inner = new PdfHostAdapter(PdfOrderDocumentRegistryFactory.Create());
            var before = inner.GetCurrentLayoutState();
            var adapter = new FailingAdapter(inner, PdfRegistryIds.Logo);
            var session = new PdfLayoutSession(adapter, new AtomicJsonPdfLayoutProfileStore(root));
            var result = await session.ApplyBatchAsync([
                Request(PdfRegistryIds.Title, PdfLayoutOperations.Move, new() { ["x"] = 123d }),
                Request(PdfRegistryIds.Logo, PdfLayoutOperations.ResizeWidth, new() { ["width"] = 17d })
            ]);
            Assert.IsFalse(result.Success);
            Assert.AreEqual(PdfErrorCodes.BatchFailed, result.Code);
            Assert.IsTrue(result.RollbackSucceeded);
            Assert.IsTrue(Equivalent(before, inner.GetCurrentLayoutState()));
        }
        finally { Delete(root); }
    }

    [TestMethod]
    public async Task SingleRejectedPdfRequestPreservesConcreteHostError()
    {
        var root = NewRoot();
        try
        {
            var adapter = new PdfHostAdapter(PdfOrderDocumentRegistryFactory.Create());
            var session = new PdfLayoutSession(adapter, new AtomicJsonPdfLayoutProfileStore(root));
            var result = await session.ApplyBatchAsync([
                Request(PdfRegistryIds.DescriptionColumn, PdfLayoutOperations.ResizeWidth, new() { ["width"] = 90d })
            ]);
            Assert.IsFalse(result.Success);
            Assert.AreEqual(PdfErrorCodes.InvalidTableWidth, result.Code);
            Assert.AreEqual("Spaltensumme überschreitet die Tabellenbreite.", result.Message);
        }
        finally { Delete(root); }
    }

    [TestMethod]
    public async Task RollbackFailureIsReportedStructurally()
    {
        var root = NewRoot();
        try
        {
            var inner = new PdfHostAdapter(PdfOrderDocumentRegistryFactory.Create());
            var adapter = new RollbackFailingAdapter(inner);
            var session = new PdfLayoutSession(adapter, new AtomicJsonPdfLayoutProfileStore(root));
            var result = await session.ApplyBatchAsync([
                Request(PdfRegistryIds.Title, PdfLayoutOperations.Move, new() { ["x"] = 123d }),
                Request(PdfRegistryIds.Logo, PdfLayoutOperations.ResizeWidth, new() { ["width"] = 17d })
            ]);
            Assert.IsFalse(result.Success);
            Assert.AreEqual(PdfErrorCodes.RollbackFailed, result.Code);
            Assert.IsFalse(result.RollbackSucceeded);
            Assert.IsTrue(result.Failures!.Any(failure => failure.Code == PdfErrorCodes.RollbackFailed));
        }
        finally { Delete(root); }
    }

    [TestMethod]
    public async Task RendererCreatesInspectableRepeatedMultiPagePdfAndPreservesOutputOnFailure()
    {
        var root = NewRoot();
        try
        {
            var registry = PdfOrderDocumentRegistryFactory.Create();
            var adapter = new PdfHostAdapter(registry);
            var order = new ReferenceOrderFactory().CreatePdfDiagnosticOrder();
            var output = Path.Combine(root, "order.pdf");
            var renderer = new PdfOrderDocumentRenderer();
            var baseline = await renderer.RenderAsync(registry, adapter.GetCurrentLayoutState(), order, output);
            Assert.IsTrue(baseline.Success, baseline.Message);
            Assert.IsGreaterThanOrEqualTo(2, baseline.PageCount);
            Assert.IsGreaterThan(1024L, baseline.FileSize);
            Assert.AreEqual(baseline.PageCount, baseline.Traces.Count(trace => trace.Marker == "header"));
            Assert.AreEqual(baseline.PageCount, baseline.Traces.Count(trace => trace.Marker == "footer"));
            Assert.AreEqual(baseline.PageCount, baseline.Traces.Count(trace => trace.Marker == "table-header"));
            Assert.IsTrue(baseline.Traces.Any(trace => trace.Marker == "logo"));
            Assert.IsTrue(baseline.Traces.Any(trace => trace.Marker == "summary"));
            var inspection = PdfTechnicalInspector.Inspect(output);
            Assert.IsTrue(inspection.Success, inspection.Message);
            Assert.AreEqual(baseline.PageCount, inspection.PageCount);
            Assert.AreEqual(210d, inspection.FirstPageWidthMm, 0.1);
            Assert.AreEqual(297d, inspection.FirstPageHeightMm, 0.1);

            AssertSuccess(adapter, Request(PdfRegistryIds.Title, PdfLayoutOperations.Move, new() { ["x"] = 123d, ["y"] = 18d }));
            AssertSuccess(adapter, Request(PdfRegistryIds.Title, PdfLayoutOperations.TextResize,
                new() { ["text"] = new Dictionary<string, object?> { ["fontSize"] = 5.5d } }));
            AssertSuccess(adapter, Request(PdfRegistryIds.Sender, PdfLayoutOperations.TextMove,
                new() { ["text"] = new Dictionary<string, object?> { ["offsetX"] = 2d, ["offsetY"] = 1.5d } }));
            AssertSuccess(adapter, Request(PdfRegistryIds.Logo, PdfLayoutOperations.ResizeHeight, new() { ["height"] = 16d }));
            AssertSuccess(adapter, Request(PdfRegistryIds.DescriptionColumn, PdfLayoutOperations.ResizeWidth, new() { ["width"] = 65d }));
            AssertSuccess(adapter, Request(PdfRegistryIds.Header, PdfLayoutOperations.ResizeHeight, new() { ["height"] = 48d }));
            AssertSuccess(adapter, Request(PdfRegistryIds.Footer, PdfLayoutOperations.ResizeHeight, new() { ["height"] = 19d }));
            var changed = await renderer.RenderAsync(registry, adapter.GetCurrentLayoutState(), order, Path.Combine(root, "changed.pdf"));
            Assert.IsTrue(changed.Success, changed.Message);
            Assert.AreEqual(baseline.PageCount, changed.PageCount);
            Assert.AreNotEqual(baseline.Traces.First(t => t.ElementId == PdfRegistryIds.Title).Box.X,
                changed.Traces.First(t => t.ElementId == PdfRegistryIds.Title).Box.X);
            Assert.AreNotEqual(baseline.Traces.First(t => t.ElementId == PdfRegistryIds.Title).Box.FontSize,
                changed.Traces.First(t => t.ElementId == PdfRegistryIds.Title).Box.FontSize);
            Assert.AreNotEqual(baseline.Traces.First(t => t.ElementId == PdfRegistryIds.Sender).Box.X,
                changed.Traces.First(t => t.ElementId == PdfRegistryIds.Sender).Box.X);
            Assert.AreNotEqual(baseline.Traces.First(t => t.ElementId == PdfRegistryIds.Logo).Box.Height,
                changed.Traces.First(t => t.ElementId == PdfRegistryIds.Logo).Box.Height);
            Assert.AreNotEqual(baseline.Traces.First(t => t.ElementId == PdfRegistryIds.Header).Box.Height,
                changed.Traces.First(t => t.ElementId == PdfRegistryIds.Header).Box.Height);
            Assert.AreNotEqual(baseline.Traces.First(t => t.ElementId == PdfRegistryIds.Footer).Box.Height,
                changed.Traces.First(t => t.ElementId == PdfRegistryIds.Footer).Box.Height);
            Assert.IsTrue(changed.Traces.Any(t => t.Marker == "table-header" && t.Box.Width < 180));

            var original = await File.ReadAllBytesAsync(output);
            var failed = await renderer.RenderAsync(registry, adapter.GetCurrentLayoutState(), order, output, new ThrowingFault());
            Assert.IsFalse(failed.Success);
            Assert.AreEqual(PdfErrorCodes.RenderFailed, failed.Code);
            CollectionAssert.AreEqual(original, await File.ReadAllBytesAsync(output));
            using (new FileStream(output, FileMode.Open, FileAccess.Read, FileShare.Read))
            {
                var writeFailed = await renderer.RenderAsync(registry, adapter.GetCurrentLayoutState(), order, output);
                Assert.IsFalse(writeFailed.Success);
                Assert.AreEqual(PdfErrorCodes.OutputWriteFailed, writeFailed.Code);
            }
            CollectionAssert.AreEqual(original, await File.ReadAllBytesAsync(output));
            Assert.IsEmpty(Directory.GetFiles(root, "*.tmp"));
            Assert.IsEmpty(Directory.GetFiles(root, "*.backup"));
        }
        finally { Delete(root); }
    }

    [TestMethod]
    public async Task DiagnosticRunnerProvesFullLifecycleAndCleansEveryArtifact()
    {
        var root = NewRoot();
        var result = await new PdfModelDiagnosticRunner().RunAsync(root, new ReferenceOrderFactory().CreatePdfDiagnosticOrder());
        Assert.IsTrue(result.Success, $"{result.Code}: {result.Message}");
        Assert.IsGreaterThanOrEqualTo(2, result.BaselinePages);
        Assert.AreEqual(result.BaselinePages, result.ChangedPages);
        Assert.AreEqual(result.BaselinePages, result.LoadedPages);
        Assert.IsTrue(result.LayoutChangesProven);
        Assert.IsTrue(result.RollbackProven);
        Assert.IsTrue(result.BusinessDataUnchanged);
        Assert.IsTrue(result.CleanupSucceeded);
        Assert.IsFalse(Directory.Exists(root));
    }

    private static PdfChangeRequest Request(string element, string operation, Dictionary<string, object?> payload) =>
        new(Guid.NewGuid().ToString("N"), element, operation, payload, DateTimeOffset.UtcNow, "m76-test", PdfRegistryIds.Scope);

    private static PdfElementLayoutState State(IPdfHostAdapter adapter, string id) =>
        adapter.GetCurrentLayoutState().Elements.Single(element => element.ElementId == id);

    private static void AssertSuccess(IPdfHostAdapter adapter, PdfChangeRequest request)
    {
        var result = adapter.SubmitChangeRequest(request);
        Assert.IsTrue(result.Success, $"{result.ErrorCode}: {result.Message}");
    }

    private static void AssertRejected(IPdfHostAdapter adapter, PdfChangeRequest request, string code)
    {
        var result = adapter.SubmitChangeRequest(request);
        Assert.IsFalse(result.Success);
        Assert.AreEqual(code, result.ErrorCode);
    }

    private static bool Equivalent(PdfLayoutState left, PdfLayoutState right) =>
        left.Elements.SequenceEqual(right.Elements);

    private static string NewRoot() => Path.Combine(Path.GetTempPath(), "ui-editor-kit-m76-tests", Guid.NewGuid().ToString("N"));
    private static void Delete(string root)
    {
        if (Directory.Exists(root)) Directory.Delete(root, true);
    }

    private sealed class FailingAdapter(IPdfHostAdapter inner, string elementId) : IPdfHostAdapter
    {
        private bool failed;
        public PdfElementRegistry GetRegistry() => inner.GetRegistry();
        public PdfLayoutState GetCurrentLayoutState() => inner.GetCurrentLayoutState();
        public PdfChangeResult SubmitChangeRequest(PdfChangeRequest request)
        {
            if (!failed && request.ElementId == elementId && !request.Source.EndsWith("rollback", StringComparison.Ordinal))
            {
                failed = true;
                return PdfChangeResult.Reject(request, PdfErrorCodes.BatchFailed, "controlled failure");
            }
            return inner.SubmitChangeRequest(request);
        }
    }

    private sealed class ThrowingFault : IPdfRenderFaultInjector
    {
        public void BeforeSerialization(int pageCount) => throw new InvalidOperationException("controlled failure");
    }

    private sealed class RollbackFailingAdapter(IPdfHostAdapter inner) : IPdfHostAdapter
    {
        public PdfElementRegistry GetRegistry() => inner.GetRegistry();
        public PdfLayoutState GetCurrentLayoutState() => inner.GetCurrentLayoutState();
        public PdfChangeResult SubmitChangeRequest(PdfChangeRequest request)
        {
            if (request.ElementId == PdfRegistryIds.Logo && !request.Source.EndsWith("rollback", StringComparison.Ordinal))
                return PdfChangeResult.Reject(request, PdfErrorCodes.BatchFailed, "controlled batch failure");
            if (request.Source.EndsWith("rollback", StringComparison.Ordinal))
                return PdfChangeResult.Reject(request, PdfErrorCodes.RollbackFailed, "controlled rollback failure");
            return inner.SubmitChangeRequest(request);
        }
    }
}
