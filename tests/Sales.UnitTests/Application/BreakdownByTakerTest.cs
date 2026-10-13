using Microsoft.EntityFrameworkCore;
using Ninja.Sales.API.Application.Queries;
using Ninja.Sales.Domain.AggregatesModel.TicketAggregate;
using Ninja.Sales.Infrastructure;

namespace Ninja.Sales.UnitTests.Application;

/// <summary>
/// The breakdown says who took the orders the settled bills opened for: a call
/// centre's agent, who settles nothing at the branch, shows there with the
/// branch's own cashiers.
/// </summary>
[TestClass]
public class BreakdownByTakerTest
{
    private const int Maadi = 2;

    private static SalesContext NewContext() =>
        new(new DbContextOptionsBuilder<SalesContext>().UseInMemoryDatabase($"sales-{Guid.NewGuid()}").Options);

    private static Ticket Settled(decimal price, string? takenBy)
    {
        var ticket = Ticket.OpenForCounter(Maadi);
        ticket.NoteTaker(takenBy, null);
        ticket.AddManualLine(new LocalizedText("Latte", null), 1, price, 0, "Omar");
        ticket.Settle([new Payment(PaymentTender.Cash, price, "Omar")], "Omar");
        return ticket;
    }

    [TestMethod]
    public async Task Settled_bills_are_totalled_by_who_took_the_order_biggest_first()
    {
        await using var context = NewContext();
        context.Tickets.AddRange(
            Settled(60, "Salma"),
            Settled(40, "Salma"),
            Settled(150, "Rana"),
            Settled(30, null));
        await context.SaveChangesAsync();

        var report = await new TicketQueries(context).GetBreakdownAsync(Maadi, DateTime.UtcNow.AddHours(-1), DateTime.UtcNow.AddHours(1), 0);

        CollectionAssert.AreEqual(
            new[] { new TakerTotal("Rana", 1, 150), new TakerTotal("Salma", 2, 100) },
            report.ByTaker.ToArray(),
            "a bill opened from the apps names nobody and is left out");
        Assert.AreEqual("Omar", report.ByCashier.Single().Name, "the cashier who settled them is still the cashier");
    }

    [TestMethod]
    public async Task No_taker_no_list()
    {
        await using var context = NewContext();
        context.Tickets.Add(Settled(30, null));
        await context.SaveChangesAsync();

        var report = await new TicketQueries(context).GetBreakdownAsync(Maadi, DateTime.UtcNow.AddHours(-1), DateTime.UtcNow.AddHours(1), 0);

        Assert.IsEmpty(report.ByTaker);
    }
}
