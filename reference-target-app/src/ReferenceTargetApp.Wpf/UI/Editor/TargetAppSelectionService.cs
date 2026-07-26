using System.Windows;
using System.Windows.Input;
using ReferenceTargetApp.EditorIntegration.Registry;

namespace ReferenceTargetApp.UI.Editor;

internal sealed class TargetAppSelectionService : IDisposable
{
    private readonly IReadOnlyList<UiRegistryEntry> entries;
    private readonly IReadOnlyList<UIElement> protectedControls;
    private readonly Func<CancellationToken, Task>? beginRemote;
    private readonly Func<CancellationToken, Task>? cancelRemote;
    private readonly Func<string, string, CancellationToken, Task>? highlightRemote;
    private bool disposed;

    internal TargetAppSelectionService(IEnumerable<IUiElementRegistry> registries, IEnumerable<UIElement>? protectedControls = null)
    {
        entries = registries.SelectMany(registry => registry.Entries).ToArray();
        this.protectedControls = entries.Select(entry => (UIElement)entry.NativeElement)
            .Concat(protectedControls ?? []).Distinct().ToArray();
        foreach (var control in this.protectedControls)
            control.AddHandler(UIElement.PreviewMouseDownEvent, new MouseButtonEventHandler(OnPreviewMouseDown), true);
    }

    internal TargetAppSelectionService(
        Func<CancellationToken, Task> beginRemote,
        Func<CancellationToken, Task> cancelRemote,
        Func<string, string, CancellationToken, Task> highlightRemote)
    {
        entries = [];
        protectedControls = [];
        this.beginRemote = beginRemote;
        this.cancelRemote = cancelRemote;
        this.highlightRemote = highlightRemote;
    }

    internal event EventHandler<TargetAppElementSelectedEventArgs>? ElementSelected;
    internal event EventHandler? SelectionRejected;
    internal bool IsActive { get; private set; }
    internal void Begin() { ObjectDisposedException.ThrowIf(disposed, this); IsActive = true; }
    internal void Cancel() { IsActive = false; }
    internal async Task BeginAsync(CancellationToken cancellationToken = default)
    {
        Begin();
        if (beginRemote is not null) await beginRemote(cancellationToken);
    }
    internal async Task CancelAsync(CancellationToken cancellationToken = default)
    {
        Cancel();
        if (cancelRemote is not null) await cancelRemote(cancellationToken);
    }
    internal Task HighlightAsync(string scopeId, string elementId, CancellationToken cancellationToken = default) =>
        highlightRemote is null ? Task.CompletedTask : highlightRemote(scopeId, elementId, cancellationToken);
    internal void NotifyRemoteSelection(string scopeId, string elementId)
    {
        if (!IsActive) return;
        IsActive = false;
        ElementSelected?.Invoke(this, new(scopeId, elementId));
    }

    public void Dispose()
    {
        if (disposed) return;
        Cancel();
        foreach (var control in protectedControls)
            control.RemoveHandler(UIElement.PreviewMouseDownEvent, new MouseButtonEventHandler(OnPreviewMouseDown));
        disposed = true;
    }

    private void OnPreviewMouseDown(object sender, MouseButtonEventArgs e)
    {
        if (!IsActive || sender is not UIElement element) return;
        e.Handled = true;
        var entry = ResolveEntry(element, e.OriginalSource as DependencyObject);
        if (entry is null)
        {
            SelectionRejected?.Invoke(this, EventArgs.Empty);
            return;
        }
        IsActive = false;
        ElementSelected?.Invoke(this, new(entry.ScopeId, entry.ElementId));
    }

    private UiRegistryEntry? ResolveEntry(UIElement sender, DependencyObject? originalSource)
    {
        var exact = entries.FirstOrDefault(candidate => ReferenceEquals(candidate.NativeElement, originalSource));
        if (exact is not null) return exact;
        var hovered = entries.Where(candidate => candidate.NativeElement.IsMouseOver)
            .OrderByDescending(candidate => Depth(candidate)).FirstOrDefault();
        return hovered ?? entries.FirstOrDefault(candidate => ReferenceEquals(candidate.NativeElement, sender));
    }

    private int Depth(UiRegistryEntry entry)
    {
        var depth = 0;
        var parentId = entry.ParentId;
        while (!string.IsNullOrWhiteSpace(parentId))
        {
            depth++;
            parentId = entries.FirstOrDefault(candidate => candidate.ElementId == parentId)?.ParentId;
        }
        return depth;
    }
}

internal sealed class TargetAppElementSelectedEventArgs(string scopeId, string elementId) : EventArgs
{
    internal string ScopeId { get; } = scopeId;
    internal string ElementId { get; } = elementId;
}
