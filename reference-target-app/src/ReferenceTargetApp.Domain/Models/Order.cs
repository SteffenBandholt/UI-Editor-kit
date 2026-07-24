namespace ReferenceTargetApp.Domain.Models;

public sealed class Order
{
    private readonly IReadOnlyList<OrderPosition> positions;

    public Order(
        string orderNumber,
        DateOnly orderDate,
        DateOnly dueDate,
        string subject,
        string responsiblePerson,
        Customer customer,
        IEnumerable<OrderPosition> positions,
        OrderStatus status,
        decimal taxRate)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(orderNumber);
        ArgumentException.ThrowIfNullOrWhiteSpace(subject);
        ArgumentException.ThrowIfNullOrWhiteSpace(responsiblePerson);
        ArgumentNullException.ThrowIfNull(customer);
        ArgumentNullException.ThrowIfNull(positions);

        if (dueDate < orderDate) throw new ArgumentOutOfRangeException(nameof(dueDate), "The due date must not precede the order date.");
        if (taxRate is < 0 or > 1) throw new ArgumentOutOfRangeException(nameof(taxRate), "The tax rate must be between zero and one.");

        OrderNumber = orderNumber;
        OrderDate = orderDate;
        DueDate = dueDate;
        Subject = subject;
        ResponsiblePerson = responsiblePerson;
        Customer = customer;
        this.positions = positions.ToArray();
        Status = status;
        TaxRate = taxRate;
    }

    public string OrderNumber { get; }
    public DateOnly OrderDate { get; }
    public DateOnly DueDate { get; }
    public string Subject { get; }
    public string ResponsiblePerson { get; }
    public Customer Customer { get; }
    public IReadOnlyList<OrderPosition> Positions => positions;
    public OrderStatus Status { get; }
    public decimal TaxRate { get; }
    public decimal NetTotal => positions.Sum(position => position.NetAmount);
    public decimal TaxAmount => decimal.Round(NetTotal * TaxRate, 2, MidpointRounding.AwayFromZero);
    public decimal GrossTotal => NetTotal + TaxAmount;
}
