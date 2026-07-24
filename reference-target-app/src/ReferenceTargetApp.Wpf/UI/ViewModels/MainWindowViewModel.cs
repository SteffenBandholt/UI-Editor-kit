using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using ReferenceTargetApp.Domain.Models;
using ReferenceTargetApp.Infrastructure.SampleData;

namespace ReferenceTargetApp.UI.ViewModels;

public sealed class MainWindowViewModel : INotifyPropertyChanged
{
    private readonly ReferenceOrderFactory orderFactory;
    private Order order;
    private string activityMessage = "Referenzauftrag geladen";

    public MainWindowViewModel(ReferenceOrderFactory orderFactory)
    {
        this.orderFactory = orderFactory ?? throw new ArgumentNullException(nameof(orderFactory));
        order = orderFactory.Create();
        Positions = new ObservableCollection<OrderPosition>(order.Positions);
        LoadEditableFields();
    }

    public event PropertyChangedEventHandler? PropertyChanged;

    public ObservableCollection<OrderPosition> Positions { get; }
    public string OrderNumber { get; set; } = string.Empty;
    public string OrderDate { get; set; } = string.Empty;
    public string DueDate { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string ResponsiblePerson { get; set; } = string.Empty;
    public string CompanyName { get; set; } = string.Empty;
    public string ContactName { get; set; } = string.Empty;
    public string Street { get; set; } = string.Empty;
    public string PostalCity { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string StatusLabel => order.Status switch
    {
        OrderStatus.Draft => "Entwurf",
        OrderStatus.InReview => "In Prüfung",
        OrderStatus.Approved => "Freigegeben",
        _ => order.Status.ToString()
    };
    public decimal NetTotal => Positions.Sum(position => position.NetAmount);
    public decimal TaxAmount => decimal.Round(NetTotal * order.TaxRate, 2, MidpointRounding.AwayFromZero);
    public decimal GrossTotal => NetTotal + TaxAmount;
    public string TaxLabel => $"Umsatzsteuer ({order.TaxRate:P0})";
    public string ActivityMessage
    {
        get => activityMessage;
        private set
        {
            if (activityMessage == value) return;
            activityMessage = value;
            OnPropertyChanged();
        }
    }

    public void CreateNewSampleOrder()
    {
        order = orderFactory.Create();
        LoadEditableFields();
        Positions.Clear();
        foreach (var position in order.Positions) Positions.Add(position);
        RaiseOrderProperties();
        ActivityMessage = "Neuer Beispielauftrag wurde angelegt";
    }

    public void AddSamplePosition()
    {
        var nextNumber = Positions.Count == 0 ? 10 : Positions.Max(position => position.PositionNumber) + 10;
        Positions.Add(new OrderPosition(nextNumber, "Zusätzliche Abstimmung", 1m, "Std.", 98m));
        RaiseTotals();
        ActivityMessage = $"Position {nextNumber} wurde ergänzt";
    }

    public void MarkAsChecked()
    {
        ActivityMessage = "Plausibilitätsprüfung ohne Beanstandung abgeschlossen";
    }

    public void SaveInMemory()
    {
        ActivityMessage = "Beispielauftrag wurde im Arbeitsspeicher gesichert";
    }

    private void RaiseOrderProperties()
    {
        foreach (var property in new[] { nameof(OrderNumber), nameof(OrderDate), nameof(DueDate), nameof(Subject), nameof(ResponsiblePerson), nameof(CompanyName), nameof(ContactName), nameof(Street), nameof(PostalCity), nameof(Email), nameof(StatusLabel), nameof(TaxLabel) })
            OnPropertyChanged(property);
        RaiseTotals();
    }

    private void LoadEditableFields()
    {
        OrderNumber = order.OrderNumber;
        OrderDate = order.OrderDate.ToString("dd.MM.yyyy");
        DueDate = order.DueDate.ToString("dd.MM.yyyy");
        Subject = order.Subject;
        ResponsiblePerson = order.ResponsiblePerson;
        CompanyName = order.Customer.CompanyName;
        ContactName = order.Customer.ContactName;
        Street = order.Customer.Street;
        PostalCity = $"{order.Customer.PostalCode} {order.Customer.City}";
        Email = order.Customer.Email;
    }

    private void RaiseTotals()
    {
        OnPropertyChanged(nameof(NetTotal));
        OnPropertyChanged(nameof(TaxAmount));
        OnPropertyChanged(nameof(GrossTotal));
    }

    private void OnPropertyChanged([CallerMemberName] string? propertyName = null)
    {
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
    }
}
