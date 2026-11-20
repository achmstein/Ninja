namespace Ninja.Sales.UnitTests.Domain;

using Ninja.Sales.Domain.AggregatesModel.TicketAggregate;
using Ninja.Sales.Domain.Exceptions;

/// <summary>
/// Cash pressed, InstaPay sent: a paid bill's payment is put right between
/// cash, card and InstaPay, the change goes with the cash, and the bill says
/// what it was, who changed it and when.
/// </summary>
[TestClass]
public class PaymentTenderChangeTest
{
    private static Ticket Bill(decimal price = 150)
    {
        var ticket = Ticket.OpenForTable(3, new LocalizedText("Table 3", null), branchId: 1);
        ticket.AppendOrder(41, [new TicketLine(TicketLineSource.Order, new LocalizedText("Latte", null), 1, price)], loyaltyDiscount: 0);
        ticket.ClearDomainEvents();
        return ticket;
    }

    private static Payment Paid(PaymentTender tender, decimal amount, int id, string? customerId = null)
    {
        var payment = new Payment(tender, amount, "cashier", customerId, customerId is null ? null : "Ahmed");
        typeof(Payment).BaseType!.GetProperty("Id")!.SetValue(payment, id);
        return payment;
    }

    [TestMethod]
    public void Cash_that_took_change_becomes_the_exact_due_on_instapay_and_the_change_goes()
    {
        var ticket = Bill();
        ticket.Settle([Paid(PaymentTender.Cash, 200, 1)], "cashier");
        Assert.AreEqual(50m, ticket.ChangeGiven);

        ticket.CorrectPaymentTender(1, PaymentTender.InstaPay, "mona");

        var payment = ticket.Payments.Single();
        Assert.AreEqual(PaymentTender.InstaPay, payment.Tender);
        Assert.AreEqual(150m, payment.Amount);
        Assert.AreEqual(0m, ticket.ChangeGiven);
        Assert.AreEqual(PaymentTender.Cash, payment.TenderChangedFrom);
        Assert.AreEqual("mona", payment.TenderChangedBy);
        Assert.IsNotNull(payment.TenderChangedAt);
    }

    [TestMethod]
    public void Instapay_becomes_cash_for_the_same_amount_and_keeps_its_first_tender()
    {
        var ticket = Bill();
        ticket.Settle([Paid(PaymentTender.InstaPay, 150, 1)], "cashier");

        ticket.CorrectPaymentTender(1, PaymentTender.Card, "mona");
        ticket.CorrectPaymentTender(1, PaymentTender.Cash, "karim");

        var payment = ticket.Payments.Single();
        Assert.AreEqual(PaymentTender.Cash, payment.Tender);
        Assert.AreEqual(150m, payment.Amount);
        Assert.AreEqual(PaymentTender.InstaPay, payment.TenderChangedFrom, "what it was first");
        Assert.AreEqual("karim", payment.TenderChangedBy);
    }

    [TestMethod]
    public void One_payment_of_a_split_changes_alone()
    {
        var ticket = Bill();
        ticket.Settle([Paid(PaymentTender.Cash, 100, 1), Paid(PaymentTender.Card, 50, 2)], "cashier");

        ticket.CorrectPaymentTender(1, PaymentTender.InstaPay, "mona");

        Assert.AreEqual(PaymentTender.InstaPay, ticket.Payments.Single(p => p.Id == 1).Tender);
        Assert.AreEqual(PaymentTender.Card, ticket.Payments.Single(p => p.Id == 2).Tender);
        Assert.IsNull(ticket.Payments.Single(p => p.Id == 2).TenderChangedFrom);
    }

    [TestMethod]
    public void A_tab_payment_an_open_bill_and_the_same_method_are_refused()
    {
        var tab = Bill();
        tab.Settle([Paid(PaymentTender.Account, 150, 1, customerId: "c1")], "cashier");
        Assert.ThrowsExactly<SalesDomainException>(() => tab.CorrectPaymentTender(1, PaymentTender.Cash, "mona"));

        var cash = Bill();
        cash.Settle([Paid(PaymentTender.Cash, 150, 1)], "cashier");
        Assert.ThrowsExactly<SalesDomainException>(() => cash.CorrectPaymentTender(1, PaymentTender.Cash, "mona"));
        Assert.ThrowsExactly<SalesDomainException>(() => cash.CorrectPaymentTender(1, PaymentTender.Account, "mona"));
        Assert.ThrowsExactly<SalesDomainException>(() => cash.CorrectPaymentTender(9, PaymentTender.Card, "mona"));

        Assert.ThrowsExactly<SalesDomainException>(() => Bill().CorrectPaymentTender(1, PaymentTender.Card, "mona"));
    }
}
