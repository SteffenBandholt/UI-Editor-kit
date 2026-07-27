namespace AppStarter.UiEditor;

public sealed class ElementReferences
{
    private readonly Dictionary<string, WeakReference<object>> references = new(StringComparer.Ordinal);
    public void Register(string id, object element) => references[id] = new(element);
    public bool TryResolve(string id, out object? element)
    {
        element = null;
        return references.TryGetValue(id, out var value) && value.TryGetTarget(out element);
    }
}
