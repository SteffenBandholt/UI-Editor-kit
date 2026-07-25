using System.Windows;
using ReferenceTargetApp.EditorIntegration.OrderHeader;
using ReferenceTargetApp.EditorIntegration.Registry;
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
        Loaded += MainWindow_Loaded;
    }

    public IUiElementRegistry? UiRegistry { get; private set; }
    public UiRegistryDiagnostics? RegistryDiagnostics => UiRegistry?.GetDiagnostics();
    internal MainWindowViewModel ViewModel => viewModel;

    private void MainWindow_Loaded(object sender, RoutedEventArgs e)
    {
        if (UiRegistry is not null) return;

        UiRegistry = new OrderHeaderRegistryFactory().Create(new OrderHeaderElementReferences(
            OrderHeaderScope,
            OrderHeaderCoreGroup,
            OrderNumberInput,
            OrderDateInput,
            DueDateInput,
            SubjectInput,
            ResponsiblePersonInput,
            OrderStatusIndicator));
    }

    private void NewOrder_Click(object sender, RoutedEventArgs e) => viewModel.CreateNewSampleOrder();
    private void AddPosition_Click(object sender, RoutedEventArgs e) => viewModel.AddSamplePosition();
    private void CheckOrder_Click(object sender, RoutedEventArgs e) => viewModel.MarkAsChecked();
    private void SaveOrder_Click(object sender, RoutedEventArgs e) => viewModel.SaveInMemory();
}
