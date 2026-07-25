using System.Windows.Input;
using System.Windows.Threading;

namespace ReferenceTargetApp.UI.ViewModels;

internal sealed class AsyncCommand(Func<object?, Task> execute, Func<object?, bool>? canExecute = null) : ICommand
{
    private bool executing;
    private readonly Dispatcher dispatcher = Dispatcher.CurrentDispatcher;

    public event EventHandler? CanExecuteChanged;

    public bool CanExecute(object? parameter) => !executing && (canExecute?.Invoke(parameter) ?? true);

    public async void Execute(object? parameter)
    {
        if (!CanExecute(parameter)) return;
        executing = true;
        RaiseCanExecuteChanged();
        try { await execute(parameter); }
        finally
        {
            executing = false;
            RaiseCanExecuteChanged();
        }
    }

    public void RaiseCanExecuteChanged()
    {
        if (dispatcher.HasShutdownStarted || dispatcher.HasShutdownFinished) return;
        if (dispatcher.CheckAccess()) CanExecuteChanged?.Invoke(this, EventArgs.Empty);
        else _ = dispatcher.BeginInvoke(new Action(() => CanExecuteChanged?.Invoke(this, EventArgs.Empty)), DispatcherPriority.DataBind);
    }
}
