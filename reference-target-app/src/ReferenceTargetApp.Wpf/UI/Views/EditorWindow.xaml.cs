using System.ComponentModel;
using System.Windows;
using ReferenceTargetApp.UI.Editor;
using ReferenceTargetApp.UI.ViewModels;

namespace ReferenceTargetApp.UI.Views;

public partial class EditorWindow : Window
{
    private readonly EditorWindowCoordinator lifecycle;
    private bool closeAllowed;

    internal EditorWindow(EditorWindowViewModel viewModel, EditorWindowCoordinator lifecycle)
    {
        InitializeComponent();
        DataContext = viewModel;
        this.lifecycle = lifecycle;
        Closing += EditorWindow_Closing;
    }

    internal void CompleteClose()
    {
        closeAllowed = true;
        Close();
    }

    private async void EditorWindow_Closing(object? sender, CancelEventArgs e)
    {
        if (closeAllowed) return;
        e.Cancel = true;
        await lifecycle.CloseAsync();
    }

    private async void ElementTree_SelectedItemChanged(object sender, RoutedPropertyChangedEventArgs<object> e)
    {
        if (DataContext is EditorWindowViewModel viewModel && e.NewValue is EditorTreeNodeViewModel node)
            await viewModel.SelectElementAsync(node.Id);
    }
}
