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
/// The customer's live delivery card: an Android phone that draws it gets its
/// data alone, an iPhone its data beside the three plain pushes, a phone on
/// an older build the plain pushes as before; progress moves it silently and
/// only forwards; and the rider hears when the customer is coming down.
/// </summary>
[TestClass]
public sealed class DeliveryCardTests
{
    private const string Android = "phone-android", Iphone = "phone-ios", Old = "phone-old", RiderPhone = "phone-r1";

    private NotificationContext _context = null!;
    private IFcmService _fcm = null!;
    private IHubContext<NotificationHub> _hub = null!;
    private Dictionary<string, List<(string Method, object? Payload)>> _sent = null!;
    private List<(List<string> Tokens, Dictionary<string, string> Data)> _cards = null!;

    [TestInitialize]
    public void Setup()
    {
        _context = new NotificationContext(new DbContextOptionsBuilder<NotificationContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        _fcm = Substitute.For<IFcmService>();
        _fcm.SendNotificationAsync(default!, default!, default!, default).ReturnsForAnyArgs(true);
        _cards = [];
        _fcm.SendBatchDataMessagesAsync(default!, default!).ReturnsForAnyArgs(call =>
        {
            _cards.Add((call.Arg<IEnumerable<string>>().ToList(), call.Arg<Dictionary<string, string>>()));
            return new BatchSendResult(1, []);
        });
        _sent = [];
        _hub = Substitute.For<IHubContext<NotificationHub>>();
        _hub.Clients.Group(Arg.Any<string>()).Returns(call =>
        {
            var group = call.Arg<string>();
            var proxy = Substitute.For<IClientProxy>();
            proxy.SendCoreAsync(Arg.Any<string>(), Arg.Any<object?[]>(), Arg.Any<CancellationToken>())
                .Returns(Task.CompletedTask)
                .AndDoes(c => (_sent.TryGetValue(group, out var list) ? list : _sent[group] = []).Add((c.Arg<string>(), c.Arg<object?[]>()[0])));
            return proxy;
        });

        _context.Subscriptions.Add(new NotificationSubscription { UserId = "rider-1", FcmToken = RiderPhone, Type = SubscriptionType.RiderDeliveries });
        _context.SaveChanges();
    }

    private void Customer(string token, string? platform)
    {
        _context.Subscriptions.Add(new NotificationSubscription
        {
            UserId = "customer-1", FcmToken = token, Type = SubscriptionType.UserOrderNotification, Platform = platform,
        });
        _context.SaveChanges();
    }

    private OrderDeliveryChangedIntegrationEventHandler Steps() => new(
        _context, _fcm, _hub, new TenantArabic(new ConfigurationBuilder().Build()), TimeProvider.System,
        NullLogger<OrderDeliveryChangedIntegrationEventHandler>.Instance);

    private DeliveryProgressedIntegrationEventHandler Progress() => new(
        _context, _fcm, _hub, TimeProvider.System, NullLogger<DeliveryProgressedIntegrationEventHandler>.Instance);

    private static OrderDeliveryChangedIntegrationEvent Move(
        string stage, int version, string? note = null, int? progress = null, bool nearby = false, bool coming = false, string? phone = "0111") =>
        new(42, 1, stage, "rider-1", "Ali", null, "customer-1", null, false, 115m, "Tahrir St", version,
            EtaMinutes: 30, RiderPhone: phone, Progress: progress, Nearby: nearby, CustomerComing: coming, Note: note);

    private static DeliveryProgressedIntegrationEvent Closer(int progress, int version = 2, int? eta = 12) =>
        new(42, 1, "customer-1", null, progress, eta, "Ali", "0111", version);

    private int PushesTo(string token) =>
        _fcm.ReceivedCalls().Count(c => c.GetMethodInfo().Name == nameof(IFcmService.SendNotificationAsync) && (string)c.GetArguments()[0]! == token);

    private List<Dictionary<string, string>> CardsTo(string token) =>
        _cards.Where(c => c.Tokens.Contains(token)).Select(c => c.Data).ToList();

    [TestMethod]
    public async Task An_android_phone_with_the_card_gets_its_data_and_no_plain_push()
    {
        Customer(Android, "android");

        await Steps().Handle(Move("Assigned", 1));
        await Steps().Handle(Move("OnTheWay", 2, progress: 0));
        await Steps().Handle(Move("Delivered", 3, phone: null));

        Assert.AreEqual(0, PushesTo(Android), "the card says it; a plain push would say it twice");
        var cards = CardsTo(Android);
        Assert.HasCount(3, cards);
        Assert.AreEqual("delivery_card", cards[1]["type"]);
        Assert.AreEqual("OnTheWay", cards[1]["stage"]);
        Assert.AreEqual("Ali", cards[1]["riderName"]);
        Assert.AreEqual("0111", cards[1]["riderPhone"]);
        Assert.AreEqual("30", cards[1]["etaMinutes"]);
        Assert.AreEqual("1", cards[1]["alert"], "it rings when it leaves");
        Assert.AreEqual("0", cards[0]["alert"]);
        Assert.AreEqual("0", cards[2]["alert"]);
        Assert.AreEqual(string.Empty, cards[2]["riderPhone"], "said empty, so the card drops the number");
    }

    [TestMethod]
    public async Task An_iphone_gets_the_card_s_data_beside_the_three_plain_pushes()
    {
        Customer(Iphone, "ios");

        await Steps().Handle(Move("Assigned", 1));
        await Steps().Handle(Move("OnTheWay", 2));
        await Steps().Handle(Move("OnTheWay", 3, note: "Nearby", nearby: true));
        await Steps().Handle(Move("Delivered", 4));

        Assert.AreEqual(2, PushesTo(Iphone), "left and arrived; near is the card's alone");
        Assert.HasCount(4, CardsTo(Iphone));
    }

    [TestMethod]
    public async Task A_phone_on_an_older_build_gets_the_plain_pushes_as_before()
    {
        Customer(Old, null);

        await Steps().Handle(Move("Assigned", 1));
        await Steps().Handle(Move("OnTheWay", 2));
        await Steps().Handle(Move("OnTheWay", 3, note: "Nearby", nearby: true));
        await Steps().Handle(Move("Delivered", 4));
        await Progress().Handle(Closer(40));

        Assert.AreEqual(2, PushesTo(Old));
        Assert.IsEmpty(_cards);
    }

    [TestMethod]
    public async Task Near_rings_the_card_once_and_pushes_nobody_on_its_way_again()
    {
        Customer(Android, "android");
        Customer(Old, null);

        await Steps().Handle(Move("OnTheWay", 2));
        await Steps().Handle(Move("OnTheWay", 3, note: "Nearby", progress: 88, nearby: true));

        Assert.AreEqual(1, PushesTo(Old), "on its way is said once, not again when the rider is near");
        var near = CardsTo(Android).Last();
        Assert.AreEqual("1", near["nearby"]);
        Assert.AreEqual("1", near["alert"]);
        Assert.AreEqual("88", near["progress"]);
        Assert.AreEqual(0, PushesTo(RiderPhone), "the rider is told nothing of their own nearness");
    }

    [TestMethod]
    public async Task The_customer_coming_down_rings_the_rider_and_only_then()
    {
        Customer(Android, "android");
        await Steps().Handle(Move("OnTheWay", 2));
        Assert.AreEqual(0, PushesTo(RiderPhone));

        await Steps().Handle(Move("OnTheWay", 3, note: "CustomerComing", coming: true));
        await Steps().Handle(Move("Delivered", 4, coming: true));

        Assert.AreEqual(1, PushesTo(RiderPhone));
        await _fcm.Received(1).SendNotificationAsync(RiderPhone, Arg.Any<string>(), Arg.Any<string>(),
            Arg.Is<Dictionary<string, string>>(d => d["type"] == "customer_coming" && d["orderId"] == "42"));
        var nudge = _sent["user:rider-1"].Select(s => s.Payload!).Single(p => (string?)p.GetType().GetProperty("note")!.GetValue(p) == "CustomerComing");
        Assert.IsTrue((bool)nudge.GetType().GetProperty("customerComing")!.GetValue(nudge)!);
        Assert.AreEqual("1", CardsTo(Android)[1]["coming"]);
        Assert.AreEqual("0", CardsTo(Android)[1]["alert"], "their own tap rings nothing on their phone");
    }

    [TestMethod]
    public async Task A_step_that_leaves_the_stage_where_it_was_rings_nobody_again()
    {
        Customer(Android, "android");
        Customer(Old, null);

        await Steps().Handle(Move("OnTheWay", 2));
        // A connected courier company named its courier while on the way: a step, the same stage
        await Steps().Handle(Move("OnTheWay", 3));

        Assert.AreEqual(1, PushesTo(Old));
        Assert.AreEqual("0", CardsTo(Android).Last()["alert"]);
    }

    [TestMethod]
    public async Task Progress_moves_the_card_silently_and_only_forwards()
    {
        Customer(Android, "android");
        Customer(Iphone, "ios");
        await Steps().Handle(Move("OnTheWay", 2, progress: 0));
        _cards.Clear();

        await Progress().Handle(Closer(30));
        await Progress().Handle(Closer(20));
        await Progress().Handle(Closer(30));
        await Progress().Handle(Closer(50, eta: null));

        Assert.HasCount(2, _cards);
        CollectionAssert.AreEquivalent(new[] { Android, Iphone }, _cards[0].Tokens);
        Assert.AreEqual("30", _cards[0].Data["progress"]);
        Assert.AreEqual("12", _cards[0].Data["etaMinutes"]);
        Assert.AreEqual("0", _cards[0].Data["alert"]);
        Assert.IsFalse(_cards[0].Data.ContainsKey("riderPhone"), "only what moved: the card keeps the rest");
        Assert.AreEqual("50", _cards[1].Data["progress"]);
        Assert.IsFalse(_cards[1].Data.ContainsKey("etaMinutes"));
        Assert.AreEqual(0, PushesTo(Android));
        Assert.AreEqual(1, PushesTo(Iphone), "the one plain push in all: the iPhone's on its way");

        var dock = _sent["user:customer-1"].Where(s => s.Method == "OrderStatusChanged").Select(s => s.Payload!).ToList();
        Assert.HasCount(3, dock, "the step and the two moves");
        Assert.IsFalse(_sent["admin"].Any(s => (string?)s.Payload!.GetType().GetProperty("type")!.GetValue(s.Payload) == "delivery_progress"),
            "the till hears nothing of where a rider is");
    }

    [TestMethod]
    public async Task Progress_after_it_arrived_or_before_it_left_moves_nothing()
    {
        Customer(Android, "android");

        await Progress().Handle(Closer(30));
        await Steps().Handle(Move("Assigned", 1));
        await Progress().Handle(Closer(30));
        await Steps().Handle(Move("OnTheWay", 2));
        await Steps().Handle(Move("Delivered", 3));
        _cards.Clear();
        await Progress().Handle(Closer(60));

        Assert.IsEmpty(_cards);
    }

    [TestMethod]
    public async Task A_customer_who_switched_order_updates_off_gets_no_card()
    {
        Customer(Android, "android");
        _context.Preferences.Add(new NotificationPreferences { UserId = "customer-1", OrderStatusUpdates = false });
        _context.SaveChanges();

        await Steps().Handle(Move("OnTheWay", 2));
        await Progress().Handle(Closer(40));

        Assert.IsEmpty(_cards);
        Assert.AreEqual(0, PushesTo(Android));
    }

    [TestMethod]
    public async Task The_app_says_its_platform_when_it_registers_and_an_older_build_takes_it_back()
    {
        var customer = new ClaimsPrincipal(new ClaimsIdentity([new Claim("sub", "customer-2")], "test"));

        await NotificationApi.SubscribeToUserOrderNotifications(_context, customer, new SubscribeRequest("tok", "ar", Platform: " Android "));
        Assert.AreEqual("android", (await _context.Subscriptions.SingleAsync(s => s.UserId == "customer-2")).Platform);

        await NotificationApi.SubscribeToUserOrderNotifications(_context, customer, new SubscribeRequest("tok", "ar", Platform: "windows"));
        Assert.IsNull((await _context.Subscriptions.SingleAsync(s => s.UserId == "customer-2")).Platform);

        await NotificationApi.SubscribeToUserOrderNotifications(_context, customer, new SubscribeRequest("tok", "ar", Platform: "ios"));
        await NotificationApi.SubscribeToUserOrderNotifications(_context, customer, new SubscribeRequest("tok", "ar"));
        Assert.IsNull((await _context.Subscriptions.SingleAsync(s => s.UserId == "customer-2")).Platform, "a build that says nothing gets plain pushes");
    }
}
