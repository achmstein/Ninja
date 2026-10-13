namespace Ninja.Sales.UnitTests.Domain;

using Ninja.Sales.Domain.AggregatesModel.TicketAggregate;

/// <summary>
/// A bill says who took the order that opened it, and, for a phone delivery
/// another branch's till sent here, which branch that was.
/// </summary>
[TestClass]
public class TicketTakenByTest
{
    private const int Maadi = 2;
    private const int Downtown = 1;

    [TestMethod]
    public void A_delivery_sent_from_another_branch_says_who_took_it_and_where()
    {
        var ticket = Ticket.OpenForDelivery(Maadi, "#123 · Mona");

        ticket.NoteTaker(" Sara ", Downtown);

        Assert.AreEqual("Sara", ticket.TakenBy);
        Assert.AreEqual(Downtown, ticket.TakenAtBranchId);
    }

    [TestMethod]
    public void A_bill_taken_where_it_is_made_keeps_no_branch()
    {
        var ticket = Ticket.OpenForCounter(Maadi);

        ticket.NoteTaker("Sara", Maadi);

        Assert.AreEqual("Sara", ticket.TakenBy);
        Assert.IsNull(ticket.TakenAtBranchId);
    }

    [TestMethod]
    public void The_first_order_that_says_keeps_it()
    {
        var ticket = Ticket.OpenForTable(3, new LocalizedText("Table 3", null), Maadi);

        ticket.NoteTaker("Sara", Maadi);
        ticket.NoteTaker("Omar", Maadi);

        Assert.AreEqual("Sara", ticket.TakenBy);
    }

    [TestMethod]
    public void An_order_from_the_apps_leaves_it_empty()
    {
        var ticket = Ticket.OpenForCounter(Maadi);

        ticket.NoteTaker(null, null);

        Assert.IsNull(ticket.TakenBy);
        Assert.IsNull(ticket.TakenAtBranchId);
    }
}
