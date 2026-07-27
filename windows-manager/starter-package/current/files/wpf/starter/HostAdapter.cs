namespace AppStarter.UiEditor;

public sealed class HostAdapter(ElementReferences references)
{
    public object GetRegistry() => Registry.Scopes;
    public object GetCurrentLayoutState()
    {
        _ = references;
        return Array.Empty<object>();
    }
    public object SubmitChangeRequest(object request) => throw new InvalidOperationException("Kein Scope ist im Entwicklungsgeruest freigegeben.");
}
