namespace Chillax.Sales.UnitTests.Domain;

using Chillax.Sales.Domain.AggregatesModel.TicketAggregate;
using Chillax.Sales.Domain.Exceptions;
using Chillax.Sales.Domain.SeedWork;

[TestClass]
public class TicketDiscountTest
{
    private const decimal CashierCap = 0.10m;

    [TestMethod]
    public void A_percent_discount_follows_the_lines_while_open()
    {
        var ticket = Counter(100);

        ticket.ApplyDiscount(rate: 0.10m, amount: null, "Regular", "Sara", CashierCap);
        Assert.AreEqual(90m, ticket.GetBill(PricingRules.None).Total);

        ticket.AppendOrder(2, [Line("Tea", 1, 100)], loyaltyDiscount: 0);
        var bill = ticket.GetBill(PricingRules.None);

        Assert.AreEqual(200m, bill.Subtotal);
        Assert.AreEqual(20m, bill.Discount);
        Assert.AreEqual(180m, bill.Total);
    }

    [TestMethod]
    public void A_fixed_discount_is_the_money_entered()
    {
        var ticket = Counter(100);

        ticket.ApplyDiscount(rate: null, amount: 7.5m, "Complaint", "Sara", CashierCap);
        var bill = ticket.GetBill(PricingRules.None);

        Assert.AreEqual(7.5m, bill.Discount);
        Assert.AreEqual(92.5m, bill.Total);
    }

    [TestMethod]
    public void Discount_is_exactly_one_shape()
    {
        var ticket = Counter(100);

        Assert.ThrowsExactly<SalesDomainException>(() => ticket.ApplyDiscount(0.1m, 5m, "Both", "Sara", CashierCap));
        Assert.ThrowsExactly<SalesDomainException>(() => ticket.ApplyDiscount(null, null, "Neither", "Sara", CashierCap));
        Assert.ThrowsExactly<SalesDomainException>(() => ticket.ApplyDiscount(1.5m, null, "Too much", "Sara", CashierCap));
        Assert.ThrowsExactly<SalesDomainException>(() => ticket.ApplyDiscount(null, 150m, "More than the bill", "Sara", null));
        Assert.IsFalse(ticket.HasDiscount);
    }

    [TestMethod]
    public void A_reason_is_optional_and_a_blank_one_is_none()
    {
        var ticket = Counter(100);

        ticket.ApplyDiscount(0.1m, null, " ", "Sara", CashierCap);

        Assert.IsTrue(ticket.HasDiscount);
        Assert.IsNull(ticket.DiscountReason);
    }

    [TestMethod]
    public void A_cashier_is_held_to_the_cap_an_owner_is_not()
    {
        var ticket = Counter(100);

        Assert.ThrowsExactly<SalesDomainException>(() => ticket.ApplyDiscount(0.25m, null, "Friend", "Sara", CashierCap));
        Assert.ThrowsExactly<SalesDomainException>(() => ticket.ApplyDiscount(null, 25m, "Friend", "Sara", CashierCap));

        ticket.ApplyDiscount(0.25m, null, "Friend", "Owner", maxRate: null);

        Assert.AreEqual(75m, ticket.GetBill(PricingRules.None).Total);
    }

    [TestMethod]
    public void The_cap_allows_exactly_the_cap()
    {
        var ticket = Counter(100);

        ticket.ApplyDiscount(null, 10m, "Regular", "Sara", CashierCap);

        Assert.AreEqual(90m, ticket.GetBill(PricingRules.None).Total);
    }

    [TestMethod]
    public void Given_again_the_discount_is_replaced_and_it_can_be_removed()
    {
        var ticket = Counter(100);

        ticket.ApplyDiscount(0.05m, null, "Regular", "Sara", CashierCap);
        ticket.ApplyDiscount(null, 10m, "Complaint", "Sara", CashierCap);

        Assert.IsNull(ticket.DiscountRate);
        Assert.AreEqual(10m, ticket.GetBill(PricingRules.None).Discount);
        Assert.AreEqual("Complaint", ticket.DiscountReason);

        ticket.RemoveDiscount();

        Assert.IsFalse(ticket.HasDiscount);
        Assert.AreEqual(100m, ticket.GetBill(PricingRules.None).Total);
    }

    [TestMethod]
    public void Service_and_vat_follow_the_discounted_money()
    {
        var ticket = Ticket.OpenForTable(3, new LocalizedText("Table 3"), branchId: 1);
        ticket.AppendOrder(1, [Line("Latte", 2, 50)], loyaltyDiscount: 0);
        ticket.ApplyDiscount(0.10m, null, "Regular", "Sara", CashierCap);

        // 12% service on the discounted 90, then 14% VAT on top
        var bill = ticket.GetBill(new PricingRules(vatRate: 0.14m, pricesIncludeVat: false, serviceChargeRate: 0.12m));

        Assert.AreEqual(100m, bill.Subtotal);
        Assert.AreEqual(10m, bill.Discount);
        Assert.AreEqual(10.8m, bill.ServiceCharge);
        Assert.AreEqual(14.11m, bill.Vat);
        Assert.AreEqual(114.91m, bill.Total);
    }

    [TestMethod]
    public void Settle_freezes_the_discount_and_a_refund_gives_back_what_was_paid()
    {
        var ticket = Counter(100);
        ticket.ApplyDiscount(0.10m, null, "Regular", "Sara", CashierCap);

        ticket.Settle([new Payment(PaymentTender.Cash, 90m, "Sara")], "Sara");

        Assert.AreEqual(10m, ticket.Discount);
        Assert.AreEqual(90m, ticket.Total);
        Assert.ThrowsExactly<SalesDomainException>(() => ticket.ApplyDiscount(0.10m, null, "Late", "Sara", CashierCap));
        Assert.ThrowsExactly<SalesDomainException>(() => ticket.RemoveDiscount());

        // Refunding the whole line gives back the 90 the customer paid, not the 100 on the menu
        var line = ticket.Lines.Single();
        var refund = Refund.Issue(1, ticket, 1, [], [new RefundRequestLine(line.Id, line.Qty)], "Cold", PaymentTender.Cash, null, null, "Owner", null);

        Assert.AreEqual(90m, refund.Amount);
    }

    [TestMethod]
    public void A_fixed_discount_never_exceeds_the_bill_after_lines_leave()
    {
        var ticket = Ticket.OpenForTable(3, new LocalizedText("Table 3"), branchId: 1);
        ticket.AppendOrder(1, [new IdLine(1, "Latte", 1, 50), new IdLine(2, "Tea", 1, 50)], loyaltyDiscount: 0);
        ticket.ApplyDiscount(null, 60m, "Comp", "Owner", null);

        var kept = ticket.MoveLines([1]);

        Assert.AreEqual(50m, ticket.GetBill(PricingRules.None).Discount);
        Assert.AreEqual(0m, ticket.GetBill(PricingRules.None).Total);
        Assert.AreEqual(50m, kept.GetBill(PricingRules.None).Total);
    }

    private static Ticket Counter(decimal amount)
    {
        var ticket = Ticket.OpenForCounter(branchId: 1);
        ticket.AppendOrder(1, [Line("Latte", 1, amount)], loyaltyDiscount: 0);
        return ticket;
    }

    private static TicketLine Line(string name, decimal qty, decimal unitPrice)
        => new(TicketLineSource.Order, new LocalizedText(name), qty, unitPrice);

    /// <summary>A line with the id the database would have given it, so moves can name it.</summary>
    private sealed class IdLine : TicketLine
    {
        public IdLine(int id, string name, decimal qty, decimal unitPrice)
            : base(TicketLineSource.Order, new LocalizedText(name), qty, unitPrice)
        {
            Id = id;
        }
    }
}
