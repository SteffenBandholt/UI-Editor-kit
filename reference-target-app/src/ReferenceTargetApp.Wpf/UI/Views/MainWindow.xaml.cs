using System.Windows;
using ReferenceTargetApp.EditorIntegration.HostAdapter;
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
    public IHostAdapter? HostAdapter { get; private set; }
    public ChangeResult? DiagnosticChangeResult { get; private set; }
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

        HostAdapter = new WpfHostAdapter(UiRegistry);
        if (Environment.GetCommandLineArgs().Contains("--host-adapter-diagnostic", StringComparer.Ordinal))
            DiagnosticChangeResult = RunHostAdapterDiagnostic();
    }

    private ChangeResult RunHostAdapterDiagnostic()
    {
        var currentState = HostAdapter!.GetCurrentLayoutState().Elements
            .Single(element => element.ElementId == OrderHeaderRegistryIds.OrderNumber);
        var fontSize = (currentState.FontSize ?? OrderNumberInput.FontSize) + 4;
        return HostAdapter.SubmitChangeRequest(new ChangeRequest(
            "m73.3-visible-diagnostic",
            OrderHeaderRegistryIds.OrderNumber,
            HostAdapterOperations.TextResize,
            new Dictionary<string, object?>
            {
                ["text"] = new Dictionary<string, object?> { ["fontSize"] = fontSize }
            },
            DateTimeOffset.UtcNow,
            "reference-target-app-diagnostic",
            OrderHeaderRegistryIds.Scope,
            reason: "Programmgesteuerter Sichtnachweis M73.3"));
    }

    private void NewOrder_Click(object sender, RoutedEventArgs e) => viewModel.CreateNewSampleOrder();
    private void AddPosition_Click(object sender, RoutedEventArgs e) => viewModel.AddSamplePosition();
    private void CheckOrder_Click(object sender, RoutedEventArgs e) => viewModel.MarkAsChecked();
    private void SaveOrder_Click(object sender, RoutedEventArgs e) => viewModel.SaveInMemory();
}
