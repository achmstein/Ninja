#nullable enable
using Ninja.Finance.API.Application.IntegrationEvents.Events;

namespace Finance.UnitTests.Application;

[TestClass]
public class ProfitFeedEventsTest
{
    [TestMethod]
    public void A_settled_ticket_is_dated_when_it_was_paid_not_when_it_arrived()
    {
        // An offline till's sale, paid in the evening and sent the next morning
        var paid = new DateTime(2026, 4, 30, 19, 0, 0, DateTimeKind.Utc);
        var settled = new TicketSettledIntegrationEvent { SettledAt = paid, CreationDate = paid.AddHours(14) };

        Assert.AreEqual(paid, settled.SaleTime());
    }

    [TestMethod]
    public void An_older_producer_without_the_settle_time_is_dated_by_its_creation()
    {
        var at = new DateTime(2026, 4, 30, 19, 0, 0, DateTimeKind.Utc);
        var settled = new TicketSettledIntegrationEvent { CreationDate = at };

        Assert.AreEqual(at, settled.SaleTime());
    }
}
