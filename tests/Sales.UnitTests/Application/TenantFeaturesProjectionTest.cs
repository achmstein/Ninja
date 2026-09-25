using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Ninja.Sales.API.Application.IntegrationEvents.EventHandling;
using Ninja.Sales.API.Application.IntegrationEvents.Events;
using Ninja.Sales.API.Application.Queries;
using Ninja.Sales.Infrastructure;

namespace Ninja.Sales.UnitTests.Application;

/// <summary>Sales keeps its own copy of the pay-at-table switch: off until told, and never undone by a late event.</summary>
[TestClass]
public class TenantFeaturesProjectionTest
{
    private static SalesContext NewContext() =>
        new(new DbContextOptionsBuilder<SalesContext>().UseInMemoryDatabase($"sales-{Guid.NewGuid()}").Options);

    private static TenantFeaturesChangedIntegrationEvent Event(bool payAtTable, DateTime at) =>
        new(payAtTable) { CreationDate = at };

    [TestMethod]
    public async Task Pay_at_table_is_off_until_the_stack_says_otherwise_and_a_late_event_does_not_undo_a_newer_one()
    {
        using var context = NewContext();
        var queries = new TenantFeaturesQueries(context);
        var handler = new TenantFeaturesChangedIntegrationEventHandler(context, NullLogger<TenantFeaturesChangedIntegrationEventHandler>.Instance);

        Assert.IsFalse(await queries.PayAtTableAsync(), "no event yet: taking money is never on by default");

        var now = DateTime.UtcNow;
        await handler.Handle(Event(true, now));
        Assert.IsTrue(await queries.PayAtTableAsync());

        await handler.Handle(Event(false, now.AddSeconds(-5)));
        Assert.IsTrue(await queries.PayAtTableAsync(), "an older event arriving late is skipped");

        await handler.Handle(Event(false, now.AddSeconds(5)));
        Assert.IsFalse(await queries.PayAtTableAsync());
    }
}
