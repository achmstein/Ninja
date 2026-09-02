namespace Chillax.Sales.UnitTests.Domain;

using Chillax.Sales.Domain.AggregatesModel.TicketAggregate;
using Chillax.Sales.Domain.Exceptions;
using Chillax.Sales.Domain.SeedWork;

[TestClass]
public class TicketAggregateTest
{
    [TestMethod]
    public void Appending_an_order_is_idempotent_by_order_id()
    {
        var ticket = Ticket.OpenForTable(3, new LocalizedText("Table 3"), branchId: 1);

        ticket.AppendOrder(41, [Line("Latte", 2, 50)], loyaltyDiscount: 0);
        ticket.AppendOrder(41, [Line("Latte", 2, 50)], loyaltyDiscount: 0);

        Assert.AreEqual(1, ticket.Lines.Count);
        Assert.AreEqual(100m, ticket.GetTotal());
    }

    [TestMethod]
    public void Loyalty_discount_lands_as_its_own_negative_line()
    {
        var ticket = Ticket.OpenForCounter(branchId: 1);

        ticket.AppendOrder(41, [Line("Latte", 2, 50)], loyaltyDiscount: 25);

        Assert.AreEqual(2, ticket.Lines.Count);
        Assert.AreEqual(75m, ticket.GetTotal());
    }

    [TestMethod]
    public void Session_time_lands_exactly_once_and_skips_empty_modes()
    {
        var ticket = Ticket.OpenForSession(7, 2, new LocalizedText("VIP"), branchId: 1, customerId: "u1", customerName: "Nadia");

        ticket.AppendSessionTime(singleHours: 2.5m, singleCost: 125, multiHours: 0, multiCost: 0);
        ticket.AppendSessionTime(singleHours: 2.5m, singleCost: 125, multiHours: 0, multiCost: 0);

        Assert.AreEqual(1, ticket.Lines.Count);
        Assert.AreEqual(125m, ticket.GetTotal());
        Assert.AreEqual(2.5m, ticket.Lines.First().Qty);
    }

    [TestMethod]
    public void Settle_requires_payments_to_cover_the_total()
    {
        var ticket = TicketWith(total: 100);

        Assert.ThrowsExactly<SalesDomainException>(() =>
            ticket.Settle([new Payment(PaymentTender.Cash, 60, "cashier")], "cashier"));
    }

    [TestMethod]
    public void Cash_overpayment_is_returned_as_change()
    {
        var ticket = TicketWith(total: 100);

        var change = ticket.Settle([new Payment(PaymentTender.Cash, 150, "cashier")], "cashier");

        Assert.AreEqual(50m, change);
        Assert.AreEqual(TicketStatus.Settled, ticket.Status);
    }

    [TestMethod]
    public void Card_payments_cannot_overpay()
    {
        var ticket = TicketWith(total: 100);

        Assert.ThrowsExactly<SalesDomainException>(() =>
            ticket.Settle([new Payment(PaymentTender.Card, 150, "cashier")], "cashier"));
    }

    [TestMethod]
    public void Split_payment_settles_when_the_parts_cover_the_total()
    {
        var ticket = TicketWith(total: 100);

        var change = ticket.Settle(
            [new Payment(PaymentTender.Card, 60, "cashier"), new Payment(PaymentTender.Cash, 40, "cashier")],
            "cashier");

        Assert.AreEqual(0m, change);
        Assert.AreEqual(2, ticket.Payments.Count);
    }

    [TestMethod]
    public void A_settled_ticket_is_frozen()
    {
        var ticket = TicketWith(total: 100);
        ticket.Settle([new Payment(PaymentTender.Cash, 100, "cashier")], "cashier");

        Assert.ThrowsExactly<SalesDomainException>(() =>
            ticket.AddManualLine(new LocalizedText("Extra"), 1, 10, 0, "cashier"));
        Assert.ThrowsExactly<SalesDomainException>(() =>
            ticket.AppendOrder(99, [Line("Latte", 1, 50)], 0));
    }

    [TestMethod]
    public void An_empty_ticket_cannot_be_settled()
    {
        var ticket = Ticket.OpenForCounter(branchId: 1);

        Assert.ThrowsExactly<SalesDomainException>(() =>
            ticket.Settle([new Payment(PaymentTender.Cash, 10, "cashier")], "cashier"));
    }

    [TestMethod]
    public void Room_tickets_cannot_be_split_by_moving_lines()
    {
        var ticket = Ticket.OpenForSession(7, 2, new LocalizedText("VIP"), branchId: 1, customerId: "u1", customerName: null);
        ticket.AppendOrder(41, [Line("Latte", 1, 50), Line("Mocha", 1, 60)], 0);

        Assert.ThrowsExactly<SalesDomainException>(() => ticket.MoveLines([1]));
    }

    [TestMethod]
    public void Voiding_needs_a_reason_and_freezes_the_ticket()
    {
        var ticket = TicketWith(total: 100);

        Assert.ThrowsExactly<SalesDomainException>(() => ticket.Void(" ", "owner"));

        ticket.Void("Rang up the wrong table", "owner");

        Assert.AreEqual(TicketStatus.Voided, ticket.Status);
        Assert.AreEqual("Rang up the wrong table", ticket.VoidReason);
        Assert.ThrowsExactly<SalesDomainException>(() =>
            ticket.AddManualLine(new LocalizedText("Extra"), 1, 10, 0, "cashier"));
    }

    [TestMethod]
    public void A_settled_ticket_cannot_be_voided()
    {
        var ticket = TicketWith(total: 100);
        ticket.Settle([new Payment(PaymentTender.Cash, 100, "cashier")], "cashier");

        // Money was taken — undoing that is a refund, not a void
        Assert.ThrowsExactly<SalesDomainException>(() => ticket.Void("mistake", "owner"));
    }

    [TestMethod]
    public void Settle_records_the_shift_and_the_change_given()
    {
        var ticket = TicketWith(total: 100);

        ticket.Settle([new Payment(PaymentTender.Cash, 150, "cashier")], "cashier", shiftId: 7);

        Assert.AreEqual(7, ticket.ShiftId);
        Assert.AreEqual(50m, ticket.ChangeGiven);
    }

    [TestMethod]
    public void Settling_without_an_open_shift_goes_unattributed()
    {
        var ticket = TicketWith(total: 100);

        ticket.Settle([new Payment(PaymentTender.Cash, 100, "cashier")], "cashier");

        Assert.IsNull(ticket.ShiftId);
    }

    [TestMethod]
    public void Account_tender_requires_an_attached_customer()
    {
        var anonymous = TicketWith(total: 100);

        Assert.ThrowsExactly<SalesDomainException>(() =>
            anonymous.Settle([new Payment(PaymentTender.Account, 100, "cashier")], "cashier"));
    }

    [TestMethod]
    public void Account_tender_settles_a_customer_ticket()
    {
        var ticket = Ticket.OpenForCounter(branchId: 1, customerId: "u1", customerName: "Nadia");
        ticket.AppendOrder(1, [Line("Item", 1, 100)], 0);

        var change = ticket.Settle(
            [new Payment(PaymentTender.Account, 60, "cashier"), new Payment(PaymentTender.Cash, 40, "cashier")],
            "cashier");

        Assert.AreEqual(0m, change);
        Assert.AreEqual(TicketStatus.Settled, ticket.Status);
    }

    [TestMethod]
    public void Non_cash_tenders_can_never_exceed_the_total()
    {
        // Account 150 + cash 10 on a 100 ticket would hand back 60 "change"
        // paid for out of the customer's own tab
        var ticket = Ticket.OpenForCounter(branchId: 1, customerId: "u1", customerName: "Nadia");
        ticket.AppendOrder(1, [Line("Item", 1, 100)], 0);

        Assert.ThrowsExactly<SalesDomainException>(() =>
            ticket.Settle(
                [new Payment(PaymentTender.Account, 150, "cashier"), new Payment(PaymentTender.Cash, 10, "cashier")],
                "cashier"));
    }

    private static TicketLine Line(string name, int qty, decimal unitPrice)
        => new(TicketLineSource.Order, new LocalizedText(name), qty, unitPrice, orderId: null);

    private static Ticket TicketWith(decimal total)
    {
        var ticket = Ticket.OpenForCounter(branchId: 1);
        ticket.AppendOrder(1, [Line("Item", 1, total)], 0);
        return ticket;
    }
}
