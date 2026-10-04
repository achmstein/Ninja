namespace Ninja.Ordering.UnitTests.Application;

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Ninja.Ordering.API.Application.IntegrationEvents.EventHandling;
using Ninja.Ordering.API.Application.IntegrationEvents.Events;
using Ninja.Ordering.API.Application.Queries;
using Ninja.Ordering.API.Deliveries;
using Ninja.Ordering.Domain.AggregatesModel.OrderAggregate;
using Ninja.Ordering.Infrastructure;
using Ninja.ServiceDefaults;

/// <summary>
/// A branch may deliver to signed-in customers only: Tenant.API's flag reaches
/// Ordering on the branch-settings event, and the delivery policy refuses a
/// guest's delivery there. A signed-in customer, and the till's phone orders,
/// go through as before.
/// </summary>
[TestClass]
public class DeliverySignInTest
{
    private const int Branch = 4;
    private static readonly DateTime Noon = new(2026, 10, 4, 12, 0, 0, DateTimeKind.Utc);

    private static readonly TenantCountry Egypt = new(new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string, string?> { ["Tenant:Country"] = "EG" })
        .Build());

    private static readonly DeliveryDraft Near = new(30.0600, 31.2450, "Qasr El Nil St", "12", Phone: "01001234567");

    private static async Task<OrderingContext> BranchAsync(bool signInRequired)
    {
        var context = new OrderingContext(new DbContextOptionsBuilder<OrderingContext>()
            .UseInMemoryDatabase($"ordering-{Guid.NewGuid()}")
            .Options);
        await new BranchSettingsChangedIntegrationEventHandler(context, NullLogger<BranchSettingsChangedIntegrationEventHandler>.Instance)
            .Handle(new BranchSettingsChangedIntegrationEvent(
                Branch, IsOrderingEnabled: true, IsReservationsEnabled: true, IsDeliveryEnabled: true,
                Latitude: 30.0444, Longitude: 31.2357, DeliveryRadiusKm: 5, DeliveryFee: 20,
                RequireSignInForDelivery: signInRequired) { CreationDate = Noon });
        return context;
    }

    private static DeliveryPolicy Policy(OrderingContext context) => new(new BranchSettingsQueries(context), Egypt);

    [TestMethod]
    public async Task The_flag_rides_the_branch_event_into_the_terms()
    {
        await using var context = await BranchAsync(signInRequired: true);

        var terms = await new BranchSettingsQueries(context).GetDeliveryTermsAsync(Branch);

        Assert.IsNotNull(terms);
        Assert.IsTrue(terms.SignInRequired);
    }

    [TestMethod]
    public async Task A_guest_is_refused_delivery_where_the_branch_wants_an_account()
    {
        await using var context = await BranchAsync(signInRequired: true);

        var refused = await Assert.ThrowsExactlyAsync<OrderingDomainException>(() =>
            Policy(context).BuildAsync(Near, Branch, DeliveryTaker.Customer, null, 150, isGuest: true));

        Assert.AreEqual(DeliveryErrors.SignInRequired, refused.Code);
    }

    [TestMethod]
    public async Task A_signed_in_customer_and_the_till_go_through_there()
    {
        await using var context = await BranchAsync(signInRequired: true);

        var customer = await Policy(context).BuildAsync(Near, Branch, DeliveryTaker.Customer, null, 150, isGuest: false);
        var phoneOrder = await Policy(context).BuildAsync(Near with { Latitude = null, Longitude = null }, Branch, DeliveryTaker.Till, null, 10, isGuest: true);

        Assert.AreEqual(20m, customer.Fee);
        Assert.AreEqual(20m, phoneOrder.Fee);
    }

    [TestMethod]
    public async Task Off_by_default_a_guest_orders_delivery_as_before()
    {
        await using var context = await BranchAsync(signInRequired: false);

        var delivery = await Policy(context).BuildAsync(Near, Branch, DeliveryTaker.Customer, null, 150, isGuest: true);

        Assert.AreEqual("Qasr El Nil St", delivery.Address);
    }
}
