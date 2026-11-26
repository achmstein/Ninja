namespace Ninja.Sales.UnitTests.Domain;

using Ninja.Sales.Domain.AggregatesModel.OnlinePaymentAggregate;
using Ninja.Sales.Domain.AggregatesModel.PartPaymentAggregate;
using Ninja.Sales.Domain.AggregatesModel.TicketAggregate;
using Ninja.Sales.Domain.Exceptions;

[TestClass]
public class PartPaymentTest
{
    private static PartPayment Take(
        PaymentTender tender = PaymentTender.Cash,
        decimal amount = 40,
        string? payerName = "Mona Ali",
        int[]? lineIds = null,
        string recordedBy = "cashier",
        int? shiftId = 5)
        => PartPayment.Take(ticketId: 9, branchId: 1, shiftId, tender, amount, payerName, lineIds, recordedBy);

    [TestMethod]
    public void Takes_money_for_part_of_a_bill_on_the_open_shift()
    {
        var part = Take(amount: 40.005m, payerName: "  Mona Ali ", lineIds: [3, 4, 3]);

        Assert.AreEqual(9, part.TicketId);
        Assert.AreEqual(1, part.BranchId);
        Assert.AreEqual(5, part.ShiftId);
        Assert.AreEqual(PaymentTender.Cash, part.Tender);
        Assert.AreEqual(40.01m, part.Amount);
        Assert.AreEqual("Mona Ali", part.PayerName);
        CollectionAssert.AreEqual(new[] { 3, 4 }, part.LineIds, "a line is named once");
        Assert.IsTrue(part.IsActive);
        Assert.IsNull(part.ReturnedAt);
    }

    [TestMethod]
    public void An_amount_on_account_of_the_bill_names_no_lines_and_may_go_unattributed()
    {
        var part = Take(payerName: " ", lineIds: null, shiftId: null);

        Assert.AreEqual(0, part.LineIds.Count);
        Assert.IsNull(part.PayerName);
        Assert.IsNull(part.ShiftId, "a missing shift never blocks taking money");
    }

    [TestMethod]
    [DataRow(PaymentTender.Cash)]
    [DataRow(PaymentTender.Card)]
    [DataRow(PaymentTender.InstaPay)]
    public void Cash_card_and_InstaPay_are_taken(PaymentTender tender)
        => Assert.AreEqual(tender, Take(tender).Tender);

    [TestMethod]
    [DataRow(PaymentTender.Account)]
    [DataRow(PaymentTender.Online)]
    [DataRow(PaymentTender.Talabat)]
    [DataRow(PaymentTender.Courier)]
    public void Any_other_tender_is_refused(PaymentTender tender)
        => Assert.ThrowsExactly<SalesDomainException>(() => Take(tender));

    [TestMethod]
    public void Nothing_and_nobody_are_refused()
    {
        Assert.ThrowsExactly<SalesDomainException>(() => Take(amount: 0));
        Assert.ThrowsExactly<SalesDomainException>(() => Take(amount: -5));
        Assert.ThrowsExactly<SalesDomainException>(() => Take(recordedBy: " "));
        Assert.ThrowsExactly<SalesDomainException>(() => Take(payerName: new string('m', PartPayment.PayerNameLength + 1)));
    }

    [TestMethod]
    public void Given_back_once_from_the_drawer_open_then()
    {
        var part = Take();
        var at = new DateTime(2026, 11, 26, 20, 0, 0, DateTimeKind.Utc);

        part.Return("owner", shiftId: 8, at);

        Assert.IsFalse(part.IsActive);
        Assert.AreEqual(at, part.ReturnedAt);
        Assert.AreEqual("owner", part.ReturnedBy);
        Assert.AreEqual(8, part.ReturnedShiftId);
        Assert.AreEqual(5, part.ShiftId, "the shift that took it still took it");

        Assert.ThrowsExactly<SalesDomainException>(() => part.Return("owner", 8));
    }

    [TestMethod]
    public void What_was_given_back_no_longer_counts_towards_the_bill()
    {
        var kept = Take(amount: 40, lineIds: [1]);
        var returned = Take(amount: 25, lineIds: [2]);
        returned.Return("owner", null);

        var paid = PartPaid.Of([kept, returned]);

        Assert.AreEqual(40m, paid.Amount);
        Assert.IsTrue(paid.LineIds.SetEquals([1]));
        Assert.AreEqual(60m, OnlineShares.Remaining(100m, [], DateTime.UtcNow, paid), "a guest paying online is left the rest");
        Assert.IsTrue(OnlineShares.ClaimedLines([], DateTime.UtcNow, paid).Contains(1), "and cannot pick the item paid at the till");
    }

    [TestMethod]
    public void A_payment_that_was_a_part_payment_keeps_its_method_and_gives_no_change()
    {
        var ticket = Ticket.OpenForCounter(1);
        ticket.AddManualLine(new("Latte", "Latte"), 1, 100, 0, "cashier");
        var early = new Payment(PaymentTender.Cash, 40, "cashier", recordedAt: DateTime.UtcNow.AddHours(-2), partPaymentId: 77);
        var now = new Payment(PaymentTender.Cash, 70, "cashier");

        var change = ticket.Settle([early, now], "cashier");

        Assert.AreEqual(10m, change);
        Assert.AreEqual(77, ticket.Payments.Single(p => p.Amount == 40).PartPaymentId);
        Assert.ThrowsExactly<SalesDomainException>(() => ticket.CorrectPaymentTender(early.Id, PaymentTender.Card, "cashier"));
    }
}
