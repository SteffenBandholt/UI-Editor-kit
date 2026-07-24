using ReferenceTargetApp.Domain.Models;
using ReferenceTargetApp.Infrastructure.SampleData;

namespace ReferenceTargetApp.Tests;

[TestClass]
public sealed class ReferenceOrderFactoryTests
{
    [TestMethod]
    public void FactoryCreatesCompleteRealisticExampleData()
    {
        var order = new ReferenceOrderFactory().Create();

        Assert.AreEqual("AU-2026-0471", order.OrderNumber);
        Assert.AreEqual("Nordlicht Anlagenbau GmbH", order.Customer.CompanyName);
        Assert.AreEqual(OrderStatus.InReview, order.Status);
        Assert.HasCount(4, order.Positions);
        Assert.IsTrue(order.Positions.All(position => position.PositionNumber > 0));
        Assert.IsTrue(order.Positions.All(position => !string.IsNullOrWhiteSpace(position.Description)));
    }

    [TestMethod]
    public void OrderCalculatesTotalsWithoutUiTypes()
    {
        var order = new ReferenceOrderFactory().Create();

        Assert.AreEqual(6_902m, order.NetTotal);
        Assert.AreEqual(1_311.38m, order.TaxAmount);
        Assert.AreEqual(8_213.38m, order.GrossTotal);
    }

    [TestMethod]
    public void InvalidDueDateIsRejectedByDomainModel()
    {
        var customer = new Customer("Example", "Contact", "Street 1", "12345", "City", "contact@example.test");

        Assert.ThrowsExactly<ArgumentOutOfRangeException>(() => new Order(
            "A-1",
            new DateOnly(2026, 7, 24),
            new DateOnly(2026, 7, 23),
            "Subject",
            "Owner",
            customer,
            Array.Empty<OrderPosition>(),
            OrderStatus.Draft,
            0.19m));
    }
}
