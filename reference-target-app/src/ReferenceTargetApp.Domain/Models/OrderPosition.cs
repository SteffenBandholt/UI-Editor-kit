namespace ReferenceTargetApp.Domain.Models;

public sealed record OrderPosition(
    int PositionNumber,
    string Description,
    decimal Quantity,
    string Unit,
    decimal UnitPrice)
{
    public decimal NetAmount => decimal.Round(Quantity * UnitPrice, 2, MidpointRounding.AwayFromZero);
}
