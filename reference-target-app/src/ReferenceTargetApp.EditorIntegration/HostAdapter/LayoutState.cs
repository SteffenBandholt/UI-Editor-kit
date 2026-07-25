using System.Collections.ObjectModel;

namespace ReferenceTargetApp.EditorIntegration.HostAdapter;

public sealed class LayoutState
{
    public LayoutState(string scopeId, DateTimeOffset capturedAt, IEnumerable<ElementLayoutState> elements)
    {
        ArgumentNullException.ThrowIfNull(elements);
        ScopeId = scopeId;
        CapturedAt = capturedAt;
        Elements = new ReadOnlyCollection<ElementLayoutState>(elements.ToList());
    }

    public string ScopeId { get; }
    public DateTimeOffset CapturedAt { get; }
    public IReadOnlyList<ElementLayoutState> Elements { get; }
}
