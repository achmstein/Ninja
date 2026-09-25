namespace Ninja.Ordering.UnitTests.Application;

using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Ninja.Ordering.API.Application.IntegrationEvents.EventHandling;
using Ninja.Ordering.API.Application.IntegrationEvents.Events;
using Ninja.Ordering.API.Application.Queries;
using Ninja.Ordering.API.Extensions;
using Ninja.Ordering.Infrastructure;
using Ninja.Ordering.Infrastructure.Projections;
using Ninja.ServiceDefaults;

/// <summary>
/// Whether a guest may order from anywhere is the café's: one row Ordering
/// keeps from Tenant.API's event, read for every branch — including one
/// Ordering has no settings row for yet.
/// </summary>
[TestClass]
public class TenantSettingsTest
{
    private static OrderingContext NewContext() =>
        new(new DbContextOptionsBuilder<OrderingContext>()
            .UseInMemoryDatabase($"ordering-{Guid.NewGuid()}")
            .Options);

    private static Task HandleAsync(OrderingContext context, bool guestOrdersAnywhere, DateTime at) =>
        new TenantSettingsChangedIntegrationEventHandler(context, NullLogger<TenantSettingsChangedIntegrationEventHandler>.Instance)
            .Handle(new TenantSettingsChangedIntegrationEvent(guestOrdersAnywhere) { CreationDate = at });

    private static readonly DateTime Noon = new(2026, 9, 25, 12, 0, 0, DateTimeKind.Utc);

    [TestMethod]
    public async Task The_first_event_makes_the_row()
    {
        await using var context = NewContext();

        await HandleAsync(context, guestOrdersAnywhere: true, Noon);

        var row = await context.TenantSettings.SingleAsync();
        Assert.AreEqual(TenantSettings.SingletonId, row.Id);
        Assert.IsTrue(row.GuestOrdersAnywhere);
        Assert.AreEqual(Noon, row.UpdatedAt);
    }

    [TestMethod]
    public async Task A_newer_event_changes_the_one_row()
    {
        await using var context = NewContext();
        await HandleAsync(context, guestOrdersAnywhere: true, Noon);

        await HandleAsync(context, guestOrdersAnywhere: false, Noon.AddMinutes(1));

        var row = await context.TenantSettings.SingleAsync();
        Assert.IsFalse(row.GuestOrdersAnywhere);
        Assert.AreEqual(Noon.AddMinutes(1), row.UpdatedAt);
    }

    [TestMethod]
    public async Task An_older_event_arriving_late_changes_nothing()
    {
        await using var context = NewContext();
        await HandleAsync(context, guestOrdersAnywhere: true, Noon);

        await HandleAsync(context, guestOrdersAnywhere: false, Noon.AddMinutes(-1));
        await HandleAsync(context, guestOrdersAnywhere: false, Noon);

        var row = await context.TenantSettings.SingleAsync();
        Assert.IsTrue(row.GuestOrdersAnywhere, "a stale off must not undo a newer on");
        Assert.AreEqual(Noon, row.UpdatedAt);
    }

    [TestMethod]
    public async Task A_guest_without_a_place_is_taken_at_a_branch_ordering_has_never_heard_of()
    {
        await using var context = NewContext();
        await HandleAsync(context, guestOrdersAnywhere: true, Noon);

        var result = await CreateGuestOrderAwayAsync(context, branchId: 9);

        Assert.IsInstanceOfType<Ok>(result.Result, "a branch opened after the switch takes guests' orders too");
    }

    [TestMethod]
    public async Task A_guest_without_a_place_is_refused_when_the_cafe_says_no_whatever_the_branch_row()
    {
        await using var context = NewContext();
        await HandleAsync(context, guestOrdersAnywhere: false, Noon);
        context.BranchSettings.Add(new BranchSettings { BranchId = 1, IsOrderingEnabled = true, UpdatedAt = Noon });
        await context.SaveChangesAsync();

        var result = await CreateGuestOrderAwayAsync(context, branchId: 1);

        Assert.IsInstanceOfType<BadRequest<string>>(result.Result);
    }

    [TestMethod]
    public async Task A_guest_without_a_place_is_refused_by_a_cafe_that_has_never_said()
    {
        await using var context = NewContext();
        context.BranchSettings.Add(new BranchSettings { BranchId = 1, IsOrderingEnabled = true, UpdatedAt = Noon });
        await context.SaveChangesAsync();

        var result = await CreateGuestOrderAwayAsync(context, branchId: 1);

        Assert.IsInstanceOfType<BadRequest<string>>(result.Result, "no row reads as off, as it always has");
    }

    private static Task<Results<Ok, BadRequest<string>>> CreateGuestOrderAwayAsync(OrderingContext context, int branchId)
    {
        var mediator = Substitute.For<IMediator>();
        mediator.Send(Arg.Any<IdentifiedCommand<CreateOrderCommand, int>>(), default).Returns(Task.FromResult(42));
        var identity = Substitute.For<IIdentityService>();
        identity.GetUserIdentity().Returns((string)null);

        var httpContext = new DefaultHttpContext();
        httpContext.Request.Headers[BranchHeaderExtensions.HeaderName] = branchId.ToString();
        httpContext.Request.Headers[GuestHeaderExtensions.HeaderName] = "11111111-1111-1111-1111-111111111111";

        var services = new OrderServices(
            mediator,
            Substitute.For<IOrderQueries>(),
            identity,
            new BranchSettingsQueries(context),
            new TenantSettingsQueries(context),
            Substitute.For<IPlaceQueries>(),
            new TenantCountry(new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?> { ["Tenant:Country"] = "EG" })
                .Build()),
            NullLogger<OrderServices>.Instance);

        var request = new CreateOrderRequest(
            UserId: string.Empty,
            UserName: string.Empty,
            CustomerNote: null,
            PointsToRedeem: 0,
            LoyaltyDiscount: 0,
            Items: [new BasketItem { Id = "1", ProductId = 1, ProductName = "Latte", UnitPrice = 50, Quantity = 1 }],
            GuestName: "Nadia",
            GuestPhone: "01012345678",
            PlaceId: null,
            PlaceKind: null,
            PlaceName: null);

        return OrdersApi.CreateOrderAsync(Guid.NewGuid(), request, httpContext, services);
    }
}
