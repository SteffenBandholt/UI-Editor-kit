using System.Windows;
using ReferenceTargetApp.Infrastructure.SampleData;
using ReferenceTargetApp.UI.ViewModels;

namespace ReferenceTargetApp.UI.Views;

public partial class MainWindow : Window
{
    private readonly MainWindowViewModel viewModel;

    public MainWindow()
    {
        InitializeComponent();
        viewModel = new MainWindowViewModel(new ReferenceOrderFactory());
        DataContext = viewModel;
    }

    private void NewOrder_Click(object sender, RoutedEventArgs e) => viewModel.CreateNewSampleOrder();
    private void AddPosition_Click(object sender, RoutedEventArgs e) => viewModel.AddSamplePosition();
    private void CheckOrder_Click(object sender, RoutedEventArgs e) => viewModel.MarkAsChecked();
    private void SaveOrder_Click(object sender, RoutedEventArgs e) => viewModel.SaveInMemory();
}
