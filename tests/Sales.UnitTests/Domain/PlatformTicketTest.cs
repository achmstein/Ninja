namespace Ninja.Sales.UnitTests.Domain;

using Ninja.Sales.Domain.AggregatesModel.TicketAggregate;
using Ninja.Sales.Domain.SeedWork;

[TestClass]
public class PlatformTicketTest
{
    private static TicketLine Line(string name, int qty, decimal unitPrice)
        => new(TicketLineSource.Order, new LocalizedText(name), qty, unitPrice, orderId: null);

    [TestMethod]
    public void A_platform_bill_is_named_by_its_code_and_is_a_counter_sale()
    {
        var ticket = Ticket.OpenForPlatform(1, "Talabat", "42");

        Assert.AreEqual("Talabat 42", ticket.Label);
        Assert.AreEqual("Talabat", ticket.Platform);
        Assert.AreEqual(TicketType.Counter, ticket.Type);
    }

    [TestMethod]
    public void The_platforms_price_holds_the_vat_even_where_the_cafe_adds_it_on_top()
    {
        var ticket = Ticket.OpenForPlatform(1, "Talabat", "42");
        ticket.AppendOrder(7, [Line("Latte", 2, 57)], loyaltyDiscount: 0);

        // The café adds 14% VAT and 12% service to its own bills
        var bill = ticket.GetBill(new PricingRules(0.14m, pricesIncludeVat: false, serviceChargeRate: 0.12m));

        Assert.AreEqual(114m, bill.Total, "exactly what Talabat charged");
        Assert.AreEqual(0m, bill.ServiceCharge);
        Assert.IsTrue(bill.VatIncluded);
        Assert.AreEqual(14m, bill.Vat, "shown out of the price");
    }

    [TestMethod]
    public void The_cafes_own_counter_bill_still_has_vat_added()
    {
        var ticket = Ticket.OpenForCounter(1, "Walk-in");
        ticket.AppendOrder(7, [Line("Latte", 2, 57)], loyaltyDiscount: 0);

        Assert.AreEqual(129.96m, ticket.GetBill(new PricingRules(0.14m, pricesIncludeVat: false, serviceChargeRate: 0.12m)).Total);
    }
}
