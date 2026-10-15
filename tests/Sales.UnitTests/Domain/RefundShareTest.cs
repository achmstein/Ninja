namespace Ninja.Sales.UnitTests.Domain;

using Ninja.Sales.Domain.AggregatesModel.TicketAggregate;
using Ninja.Sales.Domain.Exceptions;

/// <summary>
/// A refunded line gives back what the customer paid for it: its share of the
/// bill's money off (the bill discount, loyalty and promo alike), service and
/// VAT. The delivery fee is its own amount, and the refunds of a bill never
/// come to more, or less, than what it was paid when everything goes back.
/// </summary>
[TestClass]
public class RefundShareTest
{
    [TestMethod]
    public void A_loyalty_discount_thins_every_item_alike()
    {
        // Two items at 50, 20 off in points, paid 80: one comes back at 40, not 50
        var ticket = Ticket.OpenForCounter(branchId: 1);
        ticket.AppendOrder(1, [Item(1, "Latte", 1, 50), Item(2, "Tea", 1, 50)], loyaltyDiscount: 20);
        Settle(ticket, PricingRules.None);
        Assert.AreEqual(80m, ticket.Total);

        var first = Issue(ticket, [], (1, 1));
        Assert.AreEqual(40m, first.Amount);

        var second = Issue(ticket, [first], (2, 1));
        Assert.AreEqual(40m, second.Amount);
    }

    [TestMethod]
    public void A_percent_bill_discount_comes_back_off_each_item()
    {
        var ticket = Ticket.OpenForCounter(branchId: 1);
        ticket.AppendOrder(1, [Item(1, "Latte", 1, 60), Item(2, "Tea", 1, 40)], loyaltyDiscount: 0);
        ticket.ApplyDiscount(0.10m, null, "Regular", "owner", null);
        Settle(ticket, PricingRules.None);

        var first = Issue(ticket, [], (1, 1));
        var second = Issue(ticket, [first], (2, 1));

        Assert.AreEqual(54m, first.Amount);
        Assert.AreEqual(36m, second.Amount);
    }

    [TestMethod]
    public void A_fixed_bill_discount_comes_back_off_each_item_in_proportion()
    {
        var ticket = Ticket.OpenForCounter(branchId: 1);
        ticket.AppendOrder(1, [Item(1, "Latte", 1, 60), Item(2, "Tea", 1, 40)], loyaltyDiscount: 0);
        ticket.ApplyDiscount(null, 30m, "Complaint", "owner", null);
        Settle(ticket, PricingRules.None);
        Assert.AreEqual(70m, ticket.Total);

        var first = Issue(ticket, [], (1, 1));
        var second = Issue(ticket, [first], (2, 1));

        Assert.AreEqual(42m, first.Amount);
        Assert.AreEqual(28m, second.Amount);
    }

    [TestMethod]
    public void Service_and_VAT_added_on_top_come_back_with_the_item()
    {
        // 200 of items, 12% service (24), 14% VAT on 224 (31.36): 255.36
        var ticket = Ticket.OpenForTable(3, new LocalizedText("Table 3", null), branchId: 1);
        ticket.AppendOrder(1, [Item(1, "Latte", 2, 50), Item(2, "Cake", 1, 100)], loyaltyDiscount: 0);
        Settle(ticket, new PricingRules(0.14m, pricesIncludeVat: false, serviceChargeRate: 0.12m));
        Assert.AreEqual(255.36m, ticket.Total);

        var latte = Issue(ticket, [], (1, 1));
        var cake = Issue(ticket, [latte], (2, 1));
        var lastLatte = Issue(ticket, [latte, cake], (1, 1));

        Assert.AreEqual(63.84m, latte.Amount);
        Assert.AreEqual(127.68m, cake.Amount);
        Assert.AreEqual(63.84m, lastLatte.Amount);
    }

    [TestMethod]
    public void The_delivery_fee_is_its_own_amount_and_items_never_carry_it()
    {
        // Two lattes at 47.50, a 20 fee, 15 off in points: paid 100. The fee
        // is paid in full; the points thin the lattes only
        var ticket = Ticket.OpenForDelivery(branchId: 1);
        ticket.AppendOrder(1, [Item(1, "Latte", 2, 47.50m), Fee(2, 20)], loyaltyDiscount: 15);
        Settle(ticket, PricingRules.None);
        Assert.AreEqual(100m, ticket.Total);

        var latte = Issue(ticket, [], (1, 1));
        var fee = Issue(ticket, [latte], (2, 1));
        var lastLatte = Issue(ticket, [latte, fee], (1, 1));

        Assert.AreEqual(40m, latte.Amount);
        Assert.AreEqual(20m, fee.Amount);
        Assert.AreEqual(40m, lastLatte.Amount);
    }

    [TestMethod]
    public void The_delivery_fee_comes_back_with_the_VAT_it_was_charged()
    {
        // 95 of lattes and a 20 fee with 14% VAT added: 131.10, the fee 22.80 of it
        var ticket = Ticket.OpenForDelivery(branchId: 1);
        ticket.AppendOrder(1, [Item(1, "Latte", 2, 47.50m), Fee(2, 20)], loyaltyDiscount: 0);
        Settle(ticket, new PricingRules(0.14m, pricesIncludeVat: false, serviceChargeRate: 0m));
        Assert.AreEqual(131.10m, ticket.Total);

        var shares = ticket.GetPaidShares();
        Assert.AreEqual(22.80m, shares.DeliveryFeePaid);

        var fee = Issue(ticket, [], (2, 1));
        var latte = Issue(ticket, [fee], (1, 1));
        Assert.AreEqual(22.80m, fee.Amount);
        Assert.AreEqual(54.15m, latte.Amount);
    }

    [TestMethod]
    public void Refunding_every_line_one_unit_at_a_time_gives_back_exactly_the_total()
    {
        // Awkward prices, a percent discount, loyalty, service and VAT added:
        // rounding must not strand a piastre on either side
        var ticket = Ticket.OpenForTable(3, new LocalizedText("Table 3", null), branchId: 1);
        ticket.AppendOrder(1, [Item(1, "Latte", 3, 33.33m), Item(2, "Water", 2, 12.50m), Item(3, "Cake", 1, 41.17m)], loyaltyDiscount: 7.35);
        ticket.ApplyDiscount(0.07m, null, "Regular", "owner", null);
        Settle(ticket, new PricingRules(0.14m, pricesIncludeVat: false, serviceChargeRate: 0.12m));

        var refunds = new List<Refund>();
        foreach (var (line, qty) in new[] { (1, 3), (2, 2), (3, 1) })
        {
            for (var i = 0; i < qty; i++)
                refunds.Add(Issue(ticket, refunds, (line, 1)));
        }

        Assert.AreEqual(ticket.Total, refunds.Sum(r => r.Amount));
        Assert.ThrowsExactly<SalesDomainException>(() => Issue(ticket, refunds, (1, 1)), "nothing is left");
    }

    [TestMethod]
    public void Refunding_a_delivery_in_steps_gives_back_exactly_the_total()
    {
        var ticket = Ticket.OpenForDelivery(branchId: 1);
        ticket.AppendOrder(1, [Item(1, "Latte", 3, 33.33m), Fee(2, 17.5m)], loyaltyDiscount: 9.99);
        ticket.ApplyDiscount(null, 5m, "Late", "owner", null);
        Settle(ticket, new PricingRules(0.14m, pricesIncludeVat: true, serviceChargeRate: 0m));

        var refunds = new List<Refund>();
        refunds.Add(Issue(ticket, refunds, (2, 1)));
        for (var i = 0; i < 3; i++)
            refunds.Add(Issue(ticket, refunds, (1, 1)));

        Assert.AreEqual(ticket.Total, refunds.Sum(r => r.Amount));
    }

    [TestMethod]
    public void A_loyalty_line_still_cannot_be_refunded_on_its_own()
    {
        var ticket = Ticket.OpenForCounter(branchId: 1);
        ticket.AppendOrder(1, [Item(1, "Latte", 1, 50)], loyaltyDiscount: 10);
        Settle(ticket, PricingRules.None);
        var loyalty = ticket.Lines.Single(l => l.Total < 0);

        Assert.ThrowsExactly<SalesDomainException>(() => Issue(ticket, [], (loyalty.Id, 1)));
    }

    private static void Settle(Ticket ticket, PricingRules rules)
    {
        var total = ticket.GetBill(rules).Total;
        ticket.Settle([new Payment(PaymentTender.Cash, total, "cashier")], "cashier", rules: rules);
    }

    private static Refund Issue(Ticket ticket, IReadOnlyCollection<Refund> earlier, params (int LineId, decimal Qty)[] lines)
        => Refund.Issue(
            earlier.Count + 1, ticket, 1, earlier,
            lines.Select(l => new RefundRequestLine(l.LineId, l.Qty)).ToList(),
            "Cold", PaymentTender.Cash, null, null, "owner", null);

    private static TicketLine Item(int id, string name, decimal qty, decimal unitPrice)
        => new IdLine(id, TicketLineSource.Order, name, qty, unitPrice);

    private static TicketLine Fee(int id, decimal fee)
        => new IdLine(id, TicketLineSource.DeliveryFee, "Delivery fee", 1, fee);

    private sealed class IdLine : TicketLine
    {
        public IdLine(int id, TicketLineSource source, string name, decimal qty, decimal unitPrice)
            : base(source, new LocalizedText(name, null), qty, unitPrice)
        {
            Id = id;
        }
    }
}
