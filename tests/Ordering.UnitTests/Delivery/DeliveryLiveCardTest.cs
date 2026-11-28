namespace Ninja.Ordering.UnitTests.Delivery;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Logging.Abstractions;
using Ninja.EventBus.Events;
using Ninja.Ordering.API.Application.IntegrationEvents;
using Ninja.Ordering.Domain.AggregatesModel.OrderAggregate;
using Ninja.Ordering.Infrastructure;
using Ninja.Ordering.Infrastructure.Repositories;
using Order = Ninja.Ordering.Domain.AggregatesModel.OrderAggregate.Order;

/// <summary>
/// The customer's live card, as Ordering feeds it: the customer coming down,
/// how far along a delivery is from where its rider's phone is, "near" said
/// once, and the customer told of progress only when it really moved.
/// </summary>
[TestClass]
public class DeliveryLiveCardTest
{
    private const int Branch = 1;
    private const string Rider = "rider-1";

    // The door, and points on the line from the branch (2,000 m south of it) to it
    private const double DoorLat = 30.0500, DoorLng = 31.2400;
    private const int FromBranch = 2000;

    /// <summary>A point this many metres south of the door.</summary>
    private static double South(int meters) => DoorLat - meters / 111_195.0;

    private sealed class Store
    {
        private readonly string _name = $"ordering-{Guid.NewGuid()}";
        private readonly InMemoryDatabaseRoot _root = new();

        public IMediator Mediator { get; } = Substitute.For<IMediator>();

        public OrderingContext NewContext() =>
            new(new DbContextOptionsBuilder<OrderingContext>().UseInMemoryDatabase(_name, _root).Options, Mediator);

        public List<OrderDeliveryChangedDomainEvent> Raised() =>
            Mediator.ReceivedCalls()
                .Select(c => c.GetArguments()[0]).OfType<OrderDeliveryChangedDomainEvent>().ToList();
    }

    private static Order OnItsWay(string guestId = "device-1", int? eta = 30, bool pin = true)
    {
        var delivery = new Delivery(
            pin ? DoorLat : null, pin ? DoorLng : null, "Tahrir St", "12", null, null, null, "01001234567", 20, FromBranch,
            zoneId: 4, zoneName: new LocalizedText("Downtown", null), etaMinutes: eta);
        var order = new Order(string.Empty, string.Empty, Branch, guestId: guestId, guestName: "Mona", guestPhone: "01001234567", delivery: delivery);
        order.AddOrderItem(1, new() { En = "Latte" }, 50, 0, null, units: 2);
        order.SetValidatedStatus();
        order.SetConfirmedStatus();
        order.AssignRider(Rider, "Ali Hassan", riderPhone: "01112223334");
        order.MarkOutForDelivery(DateTime.UtcNow.AddMinutes(-5));
        order.ClearDomainEvents();
        return order;
    }

    private static async Task<int> SaveAsync(Store store, Order order)
    {
        await using var context = store.NewContext();
        context.Orders.Add(order);
        await context.SaveChangesAsync();
        return order.Id;
    }

    private static async Task<(RiderLocationResult Result, List<DeliveryProgressedIntegrationEvent> Told)> ReportAsync(
        Store store, double latitude, double longitude = DoorLng, double? accuracy = 10, string rider = Rider)
    {
        await using var context = store.NewContext();
        var events = Substitute.For<IOrderingIntegrationEventService>();
        var told = new List<DeliveryProgressedIntegrationEvent>();
        events.AddAndSaveEventAsync(Arg.Do<IntegrationEvent>(e => told.Add((DeliveryProgressedIntegrationEvent)e))).Returns(Task.CompletedTask);

        var result = await new ReportRiderLocationCommandHandler(
                context, new OrderRepository(context), events, NullLogger<ReportRiderLocationCommandHandler>.Instance)
            .Handle(new ReportRiderLocationCommand(rider, latitude, longitude, accuracy), CancellationToken.None);
        return (result, told);
    }

    // ---- the maths -----------------------------------------------------

    [TestMethod]
    public void Progress_is_the_share_of_the_way_covered_and_minutes_shrink_with_it()
    {
        var half = DeliveryProgress.Of(DoorLat, DoorLng, FromBranch, 30, South(1000), DoorLng);

        Assert.AreEqual(50, half.Points);
        Assert.AreEqual(15, half.MinutesLeft);
        Assert.IsFalse(half.Near);
    }

    [TestMethod]
    public void A_rider_further_than_the_branch_is_at_the_start_not_below_it()
    {
        var away = DeliveryProgress.Of(DoorLat, DoorLng, FromBranch, 30, South(3500), DoorLng);

        Assert.AreEqual(0, away.Points);
        Assert.AreEqual(30, away.MinutesLeft);
    }

    [TestMethod]
    public void Under_300_metres_is_near_and_a_minute_is_the_least_said()
    {
        var close = DeliveryProgress.Of(DoorLat, DoorLng, FromBranch, 30, South(20), DoorLng);

        Assert.IsTrue(close.Near);
        Assert.AreEqual(1, close.MinutesLeft);
        Assert.IsFalse(DeliveryProgress.Of(DoorLat, DoorLng, FromBranch, 30, South(320), DoorLng).Near);
    }

    [TestMethod]
    public void Without_a_pin_nothing_is_said_and_without_a_distance_only_near()
    {
        Assert.AreEqual(new DeliveryProgress(null, null, false), DeliveryProgress.Of(null, null, FromBranch, 30, South(100), DoorLng));

        var noDistance = DeliveryProgress.Of(DoorLat, DoorLng, null, 30, South(100), DoorLng);
        Assert.IsNull(noDistance.Points);
        Assert.IsTrue(noDistance.Near);
    }

    [TestMethod]
    public void Progress_is_worth_telling_only_after_ten_points()
    {
        Assert.IsFalse(DeliveryProgress.WorthTelling(9, 0));
        Assert.IsTrue(DeliveryProgress.WorthTelling(10, 0));
        Assert.IsFalse(DeliveryProgress.WorthTelling(45, 40));
        Assert.IsFalse(DeliveryProgress.WorthTelling(20, 40), "never backwards");
        Assert.IsFalse(DeliveryProgress.WorthTelling(null, 0));
    }

    // ---- "I'm coming down" ---------------------------------------------

    [TestMethod]
    public void The_customer_comes_down_only_while_it_is_on_the_way_and_once()
    {
        var order = OnItsWay();
        var before = order.Delivery!.Version;

        order.MarkCustomerComing();
        order.MarkCustomerComing();

        Assert.IsNotNull(order.Delivery.CustomerComingAt);
        Assert.AreEqual(before + 1, order.Delivery.Version);
        var raised = order.DomainEvents.OfType<OrderDeliveryChangedDomainEvent>().Single();
        Assert.AreEqual(DeliveryNote.CustomerComing, raised.Note);
        Assert.AreEqual(DeliveryStage.OnTheWay, raised.Stage);
    }

    [TestMethod]
    public void Coming_down_is_refused_before_it_leaves_and_after_it_arrives()
    {
        var delivered = OnItsWay();
        delivered.MarkDelivered();
        var refused = Assert.ThrowsExactly<OrderingDomainException>(() => delivered.MarkCustomerComing());
        Assert.AreEqual(DeliveryErrors.NotOut, refused.Code);

        var waiting = new Order(string.Empty, string.Empty, Branch, guestId: "d", guestName: "Mona", guestPhone: "01001234567",
            delivery: new Delivery(DoorLat, DoorLng, "Tahrir St", null, null, null, null, "01001234567", 20, FromBranch));
        waiting.AddOrderItem(1, new() { En = "Latte" }, 50, 0, null, units: 1);
        waiting.SetValidatedStatus();
        waiting.SetConfirmedStatus();
        Assert.ThrowsExactly<OrderingDomainException>(() => waiting.MarkCustomerComing());
    }

    [TestMethod]
    public async Task Only_whoever_ordered_it_may_say_they_are_coming_down()
    {
        var store = new Store();
        var id = await SaveAsync(store, OnItsWay(guestId: "device-1"));

        async Task<DeliveryStepResult> SayAsync(string? user, string? guest)
        {
            await using var context = store.NewContext();
            return await new CustomerComingCommandHandler(new OrderRepository(context), NullLogger<CustomerComingCommandHandler>.Instance)
                .Handle(new CustomerComingCommand(id, user, guest), CancellationToken.None);
        }

        Assert.AreEqual(DeliveryStepResult.NotFound, await SayAsync(null, "device-2"));
        Assert.AreEqual(DeliveryStepResult.NotFound, await SayAsync("someone", "device-1"), "an account is judged by its own orders");
        Assert.AreEqual(DeliveryStepResult.NotFound, await SayAsync(null, null));
        Assert.AreEqual(DeliveryStepResult.Done, await SayAsync(null, "device-1"));

        await using var check = store.NewContext();
        Assert.IsNotNull((await check.Orders.SingleAsync()).Delivery!.CustomerComingAt);
    }

    // ---- the rider's phone ---------------------------------------------

    [TestMethod]
    public void The_rider_s_number_is_kept_with_the_delivery_and_goes_with_them()
    {
        var order = OnItsWay();
        Assert.AreEqual("01112223334", order.Delivery!.RiderPhone);
        Assert.AreEqual("01112223334", DeliveryLiveView.PhoneToRing(order.Delivery));

        order.MarkDelivered();
        Assert.IsNull(DeliveryLiveView.PhoneToRing(order.Delivery), "nobody is rung once it is handed over");
    }

    // ---- the rider's reports -------------------------------------------

    [TestMethod]
    public async Task A_report_with_nothing_out_keeps_nothing_and_says_stop()
    {
        var store = new Store();

        var (result, told) = await ReportAsync(store, South(1000));

        Assert.AreEqual(0, result.Out);
        Assert.IsEmpty(told);
        await using var check = store.NewContext();
        Assert.IsFalse(await check.RiderSpots.AnyAsync());
    }

    [TestMethod]
    public async Task The_customer_is_told_progress_only_when_it_moved_ten_points()
    {
        var store = new Store();
        var id = await SaveAsync(store, OnItsWay());

        var first = await ReportAsync(store, South(1900));   // 5%
        var second = await ReportAsync(store, South(1500));  // 25%
        var third = await ReportAsync(store, South(1400));   // 30%: 5 more
        var fourth = await ReportAsync(store, South(1200));  // 40%

        Assert.AreEqual(1, first.Result.Out);
        Assert.IsEmpty(first.Told);
        Assert.AreEqual(25, second.Told.Single().Progress);
        Assert.AreEqual(id, second.Told.Single().OrderId);
        Assert.AreEqual("device-1", second.Told.Single().GuestId);
        Assert.AreEqual("01112223334", second.Told.Single().RiderPhone);
        Assert.IsEmpty(third.Told);
        Assert.AreEqual(40, fourth.Told.Single().Progress);
        Assert.AreEqual(18, fourth.Told.Single().EtaMinutes);
    }

    [TestMethod]
    public async Task A_report_never_writes_the_order_until_the_rider_is_near()
    {
        var store = new Store();
        await SaveAsync(store, OnItsWay());
        int version;
        await using (var before = store.NewContext())
            version = (await before.Orders.SingleAsync()).Delivery!.Version;

        await ReportAsync(store, South(1500));
        await ReportAsync(store, South(900));

        await using var check = store.NewContext();
        var delivery = (await check.Orders.SingleAsync()).Delivery!;
        Assert.AreEqual(version, delivery.Version);
        Assert.IsNull(delivery.NearbyAt);
        Assert.IsEmpty(store.Raised());
        Assert.AreEqual(1, await check.RiderSpots.CountAsync());
    }

    [TestMethod]
    public async Task Near_is_said_once_as_the_delivery_s_own_news()
    {
        var store = new Store();
        await SaveAsync(store, OnItsWay());

        var near = await ReportAsync(store, South(200));
        var nearer = await ReportAsync(store, South(100));

        Assert.IsEmpty(near.Told, "near is told by the delivery's own event, progress with it");
        var raised = store.Raised().Single();
        Assert.AreEqual(DeliveryNote.Nearby, raised.Note);
        Assert.AreEqual(DeliveryStage.OnTheWay, raised.Stage);
        Assert.IsEmpty(nearer.Told, "5 more points: nothing new to say");

        await using var check = store.NewContext();
        Assert.IsNotNull((await check.Orders.SingleAsync()).Delivery!.NearbyAt);
    }

    [TestMethod]
    public async Task A_vague_fix_is_passed_over()
    {
        var store = new Store();
        await SaveAsync(store, OnItsWay());

        var (result, told) = await ReportAsync(store, South(200), accuracy: 400);

        Assert.AreEqual(1, result.Out);
        Assert.IsEmpty(told);
        Assert.IsEmpty(store.Raised());
        await using var check = store.NewContext();
        Assert.IsFalse(await check.RiderSpots.AnyAsync());
    }

    [TestMethod]
    public async Task Another_rider_s_report_moves_nobody_else_s_delivery()
    {
        var store = new Store();
        await SaveAsync(store, OnItsWay());

        var (result, told) = await ReportAsync(store, South(200), rider: "rider-2");

        Assert.AreEqual(0, result.Out);
        Assert.IsEmpty(told);
        Assert.IsEmpty(store.Raised());
    }

    [TestMethod]
    public async Task A_point_off_the_map_is_refused()
    {
        var store = new Store();
        var refused = await Assert.ThrowsExactlyAsync<OrderingDomainException>(() => ReportAsync(store, 120));
        Assert.AreEqual(DeliveryErrors.PinInvalid, refused.Code);
    }

    // ---- what the card reads -------------------------------------------

    [TestMethod]
    public async Task The_card_reads_progress_from_the_rider_s_spot_and_never_less_than_was_told()
    {
        var store = new Store();
        var id = await SaveAsync(store, OnItsWay());

        await using (var fresh = store.NewContext())
        {
            var order = await fresh.Orders.SingleAsync();
            var atStart = await DeliveryProgressReader.ForAsync(fresh, id, order.Delivery!);
            Assert.AreEqual(0, atStart!.Value.Points);
            Assert.AreEqual(30, atStart.Value.MinutesLeft);
        }

        await ReportAsync(store, South(1000));  // told 50
        await ReportAsync(store, South(1100));  // slipped back to 45: not told, and not shown

        await using var context = store.NewContext();
        var delivery = (await context.Orders.SingleAsync()).Delivery!;
        var view = DeliveryLiveView.From(id, delivery, await DeliveryProgressReader.ForAsync(context, id, delivery));

        Assert.AreEqual("OnTheWay", view.Stage);
        Assert.AreEqual(50, view.Progress);
        Assert.AreEqual("Ali Hassan", view.RiderName);
        Assert.AreEqual("01112223334", view.RiderPhone);
        Assert.IsFalse(view.Nearby);
    }

    [TestMethod]
    public void A_spot_from_before_it_left_says_nothing_about_it()
    {
        var old = new RiderSpot { RiderUserId = Rider, Latitude = South(100), Longitude = DoorLng, At = DateTime.UtcNow.AddHours(-1) };

        var progress = DeliveryProgressReader.Read(old, 7, Rider, DoorLat, DoorLng, FromBranch, 30, DateTime.UtcNow);

        Assert.AreEqual(DeliveryProgress.AtStart(30), progress);
    }

    [TestMethod]
    public void Coming_near_and_coming_down_leave_no_row_in_the_delivery_s_history()
    {
        var order = OnItsWay();
        Assert.IsTrue(order.MarkDeliveryNearby());
        Assert.IsFalse(order.MarkDeliveryNearby(), "once");

        var raised = order.DomainEvents.OfType<OrderDeliveryChangedDomainEvent>().Single();
        Assert.AreEqual(DeliveryNote.Nearby, raised.Note);

        order.MarkDelivered();
        Assert.IsFalse(order.MarkDeliveryNearby(), "not once it is handed over");
    }
}
