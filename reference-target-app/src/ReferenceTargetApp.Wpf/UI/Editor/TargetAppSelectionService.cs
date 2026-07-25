using System.Windows;
using System.Windows.Input;
using ReferenceTargetApp.EditorIntegration.Registry;

namespace ReferenceTargetApp.UI.Editor;

internal sealed class TargetAppSelectionService : IDisposable
{
    private readonly IReadOnlyList<UiRegistryEntry> entries;
    private readonly IReadOnlyList<UIElement> protectedControls;
    private bool disposed;

    internal TargetAppSelectionService(IEnumerable<IUiElementRegistry> registries, IEnumerable<UIElement>? protectedControls = null)
    {
        entries = registries.SelectMany(registry => registry.Entries).ToArray();
        this.protectedControls = entries.Select(entry => (UIElement)entry.NativeElement)
            .Concat(protectedControls ?? []).Distinct().ToArray();
        foreach (var control in this.protectedControls)
            control.AddHandler(UIElement.PreviewMouseDownEvent, new MouseButtonEventHandler(OnPreviewMouseDown), true);
    }

    internal event EventHandler<TargetAppElementSelectedEventArgs>? ElementSelected;
    internal event EventHandler? SelectionRejected;
    internal bool IsActive { get; private set; }
    internal void Begin() { ObjectDisposedException.ThrowIf(disposed, this); IsActive = true; }
    internal void Cancel() { IsActive = false; }

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
