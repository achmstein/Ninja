namespace Ninja.Ordering.UnitTests.Application;

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Ninja.Ordering.API.Application.IntegrationEvents.EventHandling;
using Ninja.Ordering.API.Application.IntegrationEvents.Events;
using Ninja.Ordering.API.Application.Queries;
using Ninja.Ordering.Infrastructure;
using Ninja.Ordering.Infrastructure.Projections;

/// <summary>
/// Whether the business delivers at all is the business's switch (bought, and
/// on): one row Ordering keeps from Tenant.API's event. Off, no branch
/// delivers whatever it was set to; never heard of, every branch delivers as set.
/// </summary>
[TestClass]
public class DeliveryFeatureTest
{
    private const int Branch = 3;
    private static readonly DateTime Noon = new(2026, 10, 4, 12, 0, 0, DateTimeKind.Utc);

    private static OrderingContext NewContext()
    {
        var context = new OrderingContext(new DbContextOptionsBuilder<OrderingContext>()
            .UseInMemoryDatabase($"ordering-{Guid.NewGuid()}")
            .Options);
        context.BranchSettings.Add(new BranchSettings
        {
            BranchId = Branch,
            IsOrderingEnabled = true,
            IsDeliveryEnabled = true,
            Latitude = 30.0444,
            Longitude = 31.2357,
            DeliveryRadiusKm = 5,
            DeliveryFee = 20,
        });
        context.SaveChanges();
        return context;
    }

    private static Task HandleAsync(OrderingContext context, bool delivery, DateTime at) =>
        new TenantFeaturesChangedIntegrationEventHandler(context, NullLogger<TenantFeaturesChangedIntegrationEventHandler>.Instance)
            .Handle(new TenantFeaturesChangedIntegrationEvent(delivery) { CreationDate = at });

    [TestMethod]
    public async Task A_stack_that_never_said_delivers_as_each_branch_is_set()
    {
        await using var context = NewContext();
        var queries = new BranchSettingsQueries(context);

        Assert.IsTrue(await queries.IsDeliveryOnAsync());
        Assert.IsNotNull(await queries.GetDeliveryTermsAsync(Branch));
    }

    [TestMethod]
    public async Task Off_no_branch_delivers_not_even_for_the_till()
    {
        await using var context = NewContext();
        await HandleAsync(context, delivery: false, Noon);
        var queries = new BranchSettingsQueries(context);

        Assert.IsFalse(await queries.IsDeliveryOnAsync());
        Assert.IsNull(await queries.GetDeliveryTermsAsync(Branch));
        Assert.IsNull(await queries.GetDeliveryTermsAsync(Branch, evenWhilePaused: true));
    }

    [TestMethod]
    public async Task Bought_again_the_branches_deliver_as_they_were_set()
    {
        await using var context = NewContext();
        await HandleAsync(context, delivery: false, Noon);
        await HandleAsync(context, delivery: true, Noon.AddMinutes(1));

        var terms = await new BranchSettingsQueries(context).GetDeliveryTermsAsync(Branch);
        Assert.IsNotNull(terms);
        Assert.AreEqual(20m, terms.Fee);
    }

    [TestMethod]
    public async Task An_older_event_arriving_late_changes_nothing()
    {
        await using var context = NewContext();
        await HandleAsync(context, delivery: false, Noon);
        await HandleAsync(context, delivery: true, Noon.AddMinutes(-1));

        Assert.IsFalse(await new BranchSettingsQueries(context).IsDeliveryOnAsync());
        Assert.AreEqual(TenantFeatures.SingletonId, (await context.TenantFeatures.SingleAsync()).Id);
    }
}
