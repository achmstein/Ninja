namespace Ninja.Sales.UnitTests.Domain;

using Ninja.Sales.Domain.AggregatesModel.TicketAggregate;

[TestClass]
public class PaymentTenderTest
{
    [TestMethod]
    public void One_tender_is_named_and_several_are_mixed()
    {
        Assert.AreEqual("Cash", Payment.DescribeTenders([new Payment(PaymentTender.Cash, 50, "Sara")]));
        Assert.AreEqual("Account", Payment.DescribeTenders([
            new Payment(PaymentTender.Account, 30, "Sara", "c1", "Ahmed"),
            new Payment(PaymentTender.Account, 20, "Sara", "c2", "Mona"),
        ]));
        Assert.AreEqual("Mixed", Payment.DescribeTenders([
            new Payment(PaymentTender.Cash, 30, "Sara"),
            new Payment(PaymentTender.Card, 20, "Sara"),
        ]));
        Assert.AreEqual("None", Payment.DescribeTenders([]));
    }
}
