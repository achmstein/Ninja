namespace Chillax.Accounts.UnitTests.Domain;

using Chillax.Accounts.Domain.AggregatesModel.CustomerAccountAggregate;
using Chillax.Accounts.Domain.Exceptions;

[TestClass]
public class CustomerAccountTest
{
    [TestMethod]
    public void A_payment_lowers_what_is_owed_and_keeps_where_it_came_from()
    {
        var account = new CustomerAccount("u1", "Ahmed");
        account.AddCharge(340, null, "pos", "sales-ticket:1:u1", TransactionSource.PosReceipt, 7);

        account.RecordPayment(100, null, "cashier", "sales-tab-payment:9", TransactionSource.PosTabPayment, 3);

        Assert.AreEqual(240m, account.Balance);
        var payment = account.Transactions.Single(t => t.Type == TransactionType.Payment);
        Assert.AreEqual(TransactionSource.PosTabPayment, payment.Source);
        Assert.AreEqual(3, payment.SourceNumber);
        Assert.AreEqual("sales-tab-payment:9", payment.Reference);
        Assert.AreEqual("cashier", payment.RecordedBy);
    }

    [TestMethod]
    public void A_payment_with_nothing_owed_goes_into_credit()
    {
        // The till took the money; the ledger shows it as a credit
        var account = new CustomerAccount("u1", "Ahmed");

        account.RecordPayment(50, null, "cashier");

        Assert.AreEqual(-50m, account.Balance);
    }

    [TestMethod]
    public void A_payment_must_be_positive_and_signed()
    {
        var account = new CustomerAccount("u1", "Ahmed");

        Assert.ThrowsExactly<AccountsDomainException>(() => account.RecordPayment(0, null, "cashier"));
        Assert.ThrowsExactly<AccountsDomainException>(() => account.RecordPayment(10, null, " "));
    }
}
