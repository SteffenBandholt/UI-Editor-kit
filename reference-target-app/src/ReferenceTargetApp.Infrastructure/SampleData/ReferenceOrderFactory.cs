using ReferenceTargetApp.Domain.Models;

namespace ReferenceTargetApp.Infrastructure.SampleData;

public sealed class ReferenceOrderFactory
{
    public Order Create()
    {
        var customer = new Customer(
            "Nordlicht Anlagenbau GmbH",
            "Mara Hoffmann",
            "Am Technologiepark 18",
            "24118",
            "Kiel",
            "mara.hoffmann@nordlicht.example");

        var positions = new[]
        {
            new OrderPosition(10, "Planung und technische Abstimmung", 12m, "Std.", 98m),
            new OrderPosition(20, "Steuerungseinheit NX-400", 2m, "Stk.", 1_485m),
            new OrderPosition(30, "Montage und Inbetriebnahme", 1m, "Pausch.", 2_240m),
            new OrderPosition(40, "Dokumentation und Einweisung", 6m, "Std.", 86m),
        };

        return new Order(
            "AU-2026-0471",
            new DateOnly(2026, 7, 24),
            new DateOnly(2026, 8, 14),
            "Erweiterung der Fertigungslinie Nord",
            "Daniel Krüger",
            customer,
            positions,
            OrderStatus.InReview,
            0.19m);
    }
}
