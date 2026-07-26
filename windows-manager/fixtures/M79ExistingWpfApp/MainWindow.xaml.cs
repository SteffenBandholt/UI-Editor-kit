using System.Collections.ObjectModel;
using System.IO;
using System.Windows;
using System.Windows.Input;

namespace M79ExistingWpfApp;

public partial class MainWindow : Window
{
    private int businessSaveCount;
    public ObservableCollection<Row> Rows { get; } = [new("A-1", "Kontrollierter Testeintrag", true)];
    public ICommand ImportCommand { get; }
    public ICommand SendCommand { get; }

    public MainWindow()
    {
        InitializeComponent();
        ImportCommand = new LocalCommand(() => { MarkBusinessAction("import"); StatusText.Text = "Import-Fachaktion wurde ausgelöst"; });
        SendCommand = new LocalCommand(() => { MarkBusinessAction("send"); StatusText.Text = "Sende-Fachaktion wurde ausgelöst"; });
        DataContext = this;
    }

    private void ToggleButton_Click(object sender, RoutedEventArgs e) { MarkBusinessAction("toggle"); StatusText.Text = "Anzeige wurde gewechselt"; }

    private void SaveButton_Click(object sender, RoutedEventArgs e)
    {
        MarkBusinessAction("save");
        businessSaveCount++;
        StatusText.Text = $"Fachlich gespeichert: {businessSaveCount}";
    }

    private static void MarkBusinessAction(string action) =>
        File.WriteAllText(Path.Combine(Environment.CurrentDirectory, "business-action-executed.txt"), action);
}

public sealed record Row(string Code, string Description, bool Visible);

internal sealed class LocalCommand(Action execute) : ICommand
{
    public event EventHandler? CanExecuteChanged { add { } remove { } }
    public bool CanExecute(object? parameter) => true;
    public void Execute(object? parameter) => execute();
}
