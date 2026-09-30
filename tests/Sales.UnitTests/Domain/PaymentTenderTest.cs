namespace Ninja.Sales.UnitTests.Domain;

using Ninja.Sales.Domain.AggregatesModel.TicketAggregate;
using Ninja.Sales.Domain.Exceptions;
using Ninja.Sales.Domain.SeedWork;

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

    [TestMethod]
    public void A_bill_the_platform_paid_is_named_after_it()
    {
        Assert.AreEqual("Talabat", Payment.DescribeTenders([new Payment(PaymentTender.Talabat, 95, "talabat")]));
    }

    [TestMethod]
    public void The_platform_pays_exact_and_never_takes_change()
    {
        var ticket = Ticket.OpenForCounter(1, "Talabat 42");
        ticket.AddManualLine(new LocalizedText("Latte", null), 1, 95m, 0m, "talabat");

        Assert.ThrowsExactly<SalesDomainException>(() => ticket.Settle([new Payment(PaymentTender.Talabat, 100, "talabat")], "talabat"));
        Assert.AreEqual(0m, ticket.Settle([new Payment(PaymentTender.Talabat, 95, "talabat")], "talabat"));
    }
}
