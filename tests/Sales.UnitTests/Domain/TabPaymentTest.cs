namespace Chillax.Sales.UnitTests.Domain;

using Chillax.Sales.Domain.AggregatesModel.TabPaymentAggregate;
using Chillax.Sales.Domain.AggregatesModel.TicketAggregate;
using Chillax.Sales.Domain.Exceptions;

[TestClass]
public class TabPaymentTest
{
    private static TabPayment Record(
        int number = 1,
        string customerId = "u1",
        string? customerName = "Ahmed",
        PaymentTender tender = PaymentTender.Cash,
        decimal amount = 100,
        string recordedBy = "cashier",
        int? shiftId = 5)
        => TabPayment.Record(number, branchId: 1, customerId, customerName, tender, amount, recordedBy, shiftId);

    [TestMethod]
    public void Records_a_slip_against_the_customers_tab_on_the_open_shift()
    {
        var slip = Record(number: 3, amount: 120.005m);

        Assert.AreEqual(3, slip.Number);
        Assert.AreEqual(1, slip.BranchId);
        Assert.AreEqual("u1", slip.CustomerId);
        Assert.AreEqual("Ahmed", slip.CustomerName);
        Assert.AreEqual(PaymentTender.Cash, slip.Tender);
        Assert.AreEqual(120.01m, slip.Amount);
        Assert.AreEqual("cashier", slip.RecordedBy);
        Assert.AreEqual(5, slip.ShiftId);
    }

    [TestMethod]
    public void Goes_unattributed_when_no_shift_is_open()
    {
        // A missing shift never blocks taking money — same rule as settling
        Assert.IsNull(Record(shiftId: null).ShiftId);
    }

    [TestMethod]
    public void A_blank_name_is_no_name()
    {
        Assert.IsNull(Record(customerName: "  ").CustomerName);
        Assert.AreEqual("Sara", Record(customerName: " Sara ").CustomerName);
    }

    [TestMethod]
    public void A_tab_cannot_pay_itself()
    {
        Assert.ThrowsExactly<SalesDomainException>(() => Record(tender: PaymentTender.Account));
    }

    [TestMethod]
    public void Card_and_instapay_are_fine()
    {
        Assert.AreEqual(PaymentTender.Card, Record(tender: PaymentTender.Card).Tender);
        Assert.AreEqual(PaymentTender.InstaPay, Record(tender: PaymentTender.InstaPay).Tender);
    }

    [TestMethod]
    public void Refuses_a_zero_or_negative_amount()
    {
        Assert.ThrowsExactly<SalesDomainException>(() => Record(amount: 0));
        Assert.ThrowsExactly<SalesDomainException>(() => Record(amount: -5));
    }

    [TestMethod]
    public void Needs_a_customer_a_cashier_and_a_number()
    {
        Assert.ThrowsExactly<SalesDomainException>(() => Record(customerId: ""));
        Assert.ThrowsExactly<SalesDomainException>(() => Record(recordedBy: " "));
        Assert.ThrowsExactly<SalesDomainException>(() => Record(number: 0));
    }
}
