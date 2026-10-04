using System.Security.Claims;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Ninja.Notification.API.Apis;
using Ninja.Notification.API.Hubs;
using Ninja.Notification.API.Infrastructure;
using Ninja.Notification.API.IntegrationEvents.EventHandling;
using Ninja.Notification.API.IntegrationEvents.Events;
using Ninja.Notification.API.Localization;
using Ninja.Notification.API.Model;
using Ninja.Notification.API.Services;
using NSubstitute;

namespace Ninja.Notification.UnitTests;

/// <summary>
/// A delivery's moves reach the right phones once each: a redelivered or late
/// event rings nobody, a stage this copy does not know pushes nothing, a phone
/// rings for the rider who signed in on it last, and a rider switched off is
/// rung no more.
/// </summary>
[TestClass]
public sealed class DeliveryNoticeTests
{
    private NotificationContext _context = null!;
    private IFcmService _fcm = null!;
    private IHubContext<NotificationHub> _hub = null!;
    private Dictionary<string, List<object?[]>> _sent = null!;

    [TestInitialize]
    public void Setup()
    {
        _context = new NotificationContext(new DbContextOptionsBuilder<NotificationContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        _fcm = Substitute.For<IFcmService>();
        _fcm.SendNotificationAsync(default!, default!, default!, default).ReturnsForAnyArgs(true);
        _sent = [];
        _hub = Substitute.For<IHubContext<NotificationHub>>();
        _hub.Clients.Group(Arg.Any<string>()).Returns(call =>
        {
            var group = call.Arg<string>();
            var proxy = Substitute.For<IClientProxy>();
            proxy.SendCoreAsync(Arg.Any<string>(), Arg.Any<object?[]>(), Arg.Any<CancellationToken>())
                .Returns(Task.CompletedTask)
                .AndDoes(c => (_sent.TryGetValue(group, out var list) ? list : _sent[group] = []).Add(c.Arg<object?[]>()));
            return proxy;
        });

        _context.Subscriptions.AddRange(
            new NotificationSubscription { UserId = "rider-1", FcmToken = "phone-r1", Type = SubscriptionType.RiderDeliveries },
            new NotificationSubscription { UserId = "customer-1", FcmToken = "phone-c1", Type = SubscriptionType.UserOrderNotification });
        _context.SaveChanges();
    }

    private OrderDeliveryChangedIntegrationEventHandler Handler() => new(
        _context, _fcm, _hub, new TenantArabic(new ConfigurationBuilder().Build()), TimeProvider.System,
        NullLogger<OrderDeliveryChangedIntegrationEventHandler>.Instance);

    private static OrderDeliveryChangedIntegrationEvent Move(string stage, int version, string? rider = "rider-1") =>
        new(42, 1, stage, rider, "Ali", null, "customer-1", null, false, 115m, "Tahrir St", version);

    private int PushesTo(string token) =>
        _fcm.ReceivedCalls().Count(c => c.GetMethodInfo().Name == nameof(IFcmService.SendNotificationAsync) && (string)c.GetArguments()[0]! == token);

    [TestMethod]
    public void A_stage_this_copy_does_not_know_is_unknown()
    {
        Assert.AreEqual(DeliveryStage.OnTheWay, OrderDeliveryChangedIntegrationEventHandler.StageOf("OnTheWay"));
        Assert.AreEqual(DeliveryStage.Failed, OrderDeliveryChangedIntegrationEventHandler.StageOf("failed"));
        Assert.AreEqual(DeliveryStage.Unknown, OrderDeliveryChangedIntegrationEventHandler.StageOf("Teleported"));
        Assert.AreEqual(DeliveryStage.Unknown, OrderDeliveryChangedIntegrationEventHandler.StageOf(null));
    }

    [TestMethod]
    public async Task The_same_move_heard_twice_rings_the_rider_once()
    {
        var assigned = Move("Assigned", 1);

        await Handler().Handle(assigned);
        await Handler().Handle(assigned);

        Assert.AreEqual(1, PushesTo("phone-r1"));
    }

    [TestMethod]
    public async Task A_move_older_than_the_last_told_rings_nobody()
    {
        await Handler().Handle(Move("OnTheWay", 3));
        await Handler().Handle(Move("Assigned", 2));

        Assert.AreEqual(0, PushesTo("phone-r1"), "a late Assigned after On the way never rings the rider");
        Assert.AreEqual(1, PushesTo("phone-c1"), "only On the way reached the customer");
    }

    [TestMethod]
    public async Task A_delivery_that_could_not_be_handed_over_tells_the_rider_and_the_customer()
    {
        await Handler().Handle(Move("Failed", 4));

        Assert.AreEqual(1, PushesTo("phone-r1"));
        Assert.AreEqual(1, PushesTo("phone-c1"));
        await _fcm.Received().SendNotificationAsync("phone-c1", Arg.Any<string>(), Arg.Any<string>(),
            Arg.Is<Dictionary<string, string>>(d => d["type"] == "order_not_delivered"));
    }

    [TestMethod]
    public async Task The_customer_never_learns_whose_account_has_their_order()
    {
        await Handler().Handle(Move("OnTheWay", 1));

        var payload = _sent["user:customer-1"].Single()[0]!;
        Assert.IsNull(payload.GetType().GetProperty("riderUserId"), "the customer's payload carries no rider id");
        Assert.IsNotNull(_sent["admin"].Single()[0]!.GetType().GetProperty("riderUserId"), "the till's still does");
    }

    [TestMethod]
    public async Task A_phone_rings_for_the_rider_who_signed_in_on_it_last()
    {
        var second = new ClaimsPrincipal(new ClaimsIdentity([new Claim("sub", "rider-2")], "test"));

        await NotificationApi.SubscribeToRiderDeliveries(_context, second, new SubscribeRequest("phone-r1"));

        var onThePhone = await _context.Subscriptions.Where(s => s.FcmToken == "phone-r1" && s.Type == SubscriptionType.RiderDeliveries).ToListAsync();
        Assert.AreEqual("rider-2", onThePhone.Single().UserId);
    }

    [TestMethod]
    public async Task A_rider_switched_off_is_rung_no_more()
    {
        var handler = new StaffAccountChangedIntegrationEventHandler(_context, NullLogger<StaffAccountChangedIntegrationEventHandler>.Instance);

        await handler.Handle(new StaffAccountChangedIntegrationEvent("rider-1", "Ali", ["Rider"], [1], Enabled: true));
        Assert.AreEqual(1, await _context.Subscriptions.CountAsync(s => s.UserId == "rider-1"), "still a rider, still rung");

        await handler.Handle(new StaffAccountChangedIntegrationEvent("rider-1", "Ali", ["Rider"], [1], Enabled: false));
        Assert.AreEqual(0, await _context.Subscriptions.CountAsync(s => s.UserId == "rider-1"));
        Assert.AreEqual(1, await _context.Subscriptions.CountAsync(s => s.UserId == "customer-1"), "nobody else's");
    }
}
