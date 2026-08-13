namespace ReferenceTargetApp.UI.ViewModels;

internal interface IPdfEditorWorkspace : IDisposable
{
    bool IsAvailable { get; }
    string UnavailableMessage { get; }
    bool IsDirty { get; }
    Task InitializeAsync();
    Task<bool> SaveAsync();
    Task<bool> DiscardAllForCloseAsync();
    void Cancel();
}

internal sealed class UnavailablePdfEditorWorkspaceViewModel(string message) : IPdfEditorWorkspace
{
    public bool IsAvailable => false;
    public string UnavailableMessage { get; } = message;
    public bool IsDirty => false;
    public Task InitializeAsync() => Task.CompletedTask;
    public Task<bool> SaveAsync() => Task.FromResult(true);
    public Task<bool> DiscardAllForCloseAsync() => Task.FromResult(true);
    public void Cancel() { }
    public void Dispose() { }
}
