namespace Ninja.Ordering.UnitTests.Application;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Ninja.Ordering.API.Application.IntegrationEvents;
using Ninja.Ordering.API.Application.IntegrationEvents.EventHandling;
using Ninja.Ordering.API.Application.IntegrationEvents.Events;
using Ninja.Ordering.API.Application.Queries;
using Ninja.Ordering.Domain.AggregatesModel.OrderAggregate;
using Ninja.Ordering.Infrastructure;
using Ninja.Ordering.Infrastructure.Projections;
using Ninja.Ordering.Infrastructure.Repositories;
using Ninja.ServiceDefaults;
using Order = Ninja.Ordering.Domain.AggregatesModel.OrderAggregate.Order;

/// <summary>
/// The delivery's steps as commands, the riders as Ordering keeps them, the
/// board's bounds, a caller's history at one branch, the one policy both the
/// app's and the till's orders are held to, and the codes the apps translate.
/// </summary>
[TestClass]
public class DeliveryHardeningTest
{
    private const int Branch = 1;
    private const int OtherBranch = 2;
    private static readonly TenantCountry Egypt = new(new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string, string?> { ["Tenant:Country"] = "EG" })
        .Build());
    private static readonly IOptions<DeliveryOptions> Options = Microsoft.Extensions.Options.Options.Create(new DeliveryOptions());

    private sealed class Store
    {
        private readonly string _name = $"ordering-{Guid.NewGuid()}";
        private readonly InMemoryDatabaseRoot _root = new();

        public OrderingContext NewContext() =>
            new(new DbContextOptionsBuilder<OrderingContext>().UseInMemoryDatabase(_name, _root).Options, Substitute.For<IMediator>());
    }

    private static Delivery ToTahrir(string phone = "01001234567") =>
        new(30.0444, 31.2357, "Tahrir St", "12", null, null, "Blue gate", phone, 20, 1800);

    private static Order ConfirmedDelivery(int branch = Branch, string phone = "01001234567")
    {
        var order = new Order(string.Empty, string.Empty, branch, guestId: "device-1", guestName: "Mona", guestPhone: phone, delivery: ToTahrir(phone));
        order.AddOrderItem(1, new() { En = "Latte" }, 50, 0, null, units: 2);
        order.SetValidatedStatus();
        order.SetConfirmedStatus();
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

    private static IIdentityService Till(string userId = "cashier-1")
    {
        var identity = Substitute.For<IIdentityService>();
        identity.RunsTheTill().Returns(true);
        identity.GetUserIdentity().Returns(userId);
        return identity;
    }

    private static IIdentityService Rider(string userId)
    {
        var identity = Substitute.For<IIdentityService>();
        identity.RunsTheTill().Returns(false);
        identity.GetUserIdentity().Returns(userId);
        identity.IsInRole(DeliveryOptions.RiderRole).Returns(true);
        return identity;
    }

    private static async Task AddRiderAsync(OrderingContext context, string userId, string name, params int[] branches)
    {
        await new StaffAccountChangedIntegrationEventHandler(context, NullLogger<StaffAccountChangedIntegrationEventHandler>.Instance)
            .Handle(new StaffAccountChangedIntegrationEvent(userId, name, ["Rider"], branches, true));
    }

    private static Task<DeliveryStepResult> AssignAsync(OrderingContext context, IIdentityService identity, int orderId, string riderId, int branch = Branch) =>
        new AssignDeliveryRiderCommandHandler(new OrderRepository(context), identity, new RiderDirectory(context, Options), NullLogger<AssignDeliveryRiderCommandHandler>.Instance)
            .Handle(new AssignDeliveryRiderCommand(orderId, branch, riderId), CancellationToken.None);

    [TestMethod]
    public async Task Another_branch_s_delivery_is_as_good_as_missing()
    {
        var store = new Store();
        var id = await SaveAsync(store, ConfirmedDelivery(OtherBranch));
        await using var context = store.NewContext();

        Assert.AreEqual(DeliveryStepResult.NotFound, await AssignAsync(context, Till(), id, "rider-1"));
    }

    [TestMethod]
    public async Task The_rider_is_found_here_with_their_own_name_never_the_request_s()
    {
        var store = new Store();
        var id = await SaveAsync(store, ConfirmedDelivery());
        await using var context = store.NewContext();
        await AddRiderAsync(context, "rider-1", "Ali Hassan", Branch);

        Assert.AreEqual(DeliveryStepResult.Done, await AssignAsync(context, Till(), id, "rider-1"));

        await using var check = store.NewContext();
        var delivery = (await check.Orders.SingleAsync()).Delivery!;
        Assert.AreEqual("rider-1", delivery.RiderUserId);
        Assert.AreEqual("Ali Hassan", delivery.RiderName);
    }

    [TestMethod]
    public async Task A_rider_not_at_this_branch_or_unknown_is_refused()
    {
        var store = new Store();
        var id = await SaveAsync(store, ConfirmedDelivery());
        await using var context = store.NewContext();
        await AddRiderAsync(context, "rider-elsewhere", "Omar", OtherBranch);

        var unknown = await Assert.ThrowsExactlyAsync<OrderingDomainException>(() => AssignAsync(context, Till(), id, "someone"));
        Assert.AreEqual(DeliveryErrors.RiderUnknown, unknown.Code);
        var elsewhere = await Assert.ThrowsExactlyAsync<OrderingDomainException>(() => AssignAsync(context, Till(), id, "rider-elsewhere"));
        Assert.AreEqual(DeliveryErrors.RiderUnknown, elsewhere.Code);
    }

    [TestMethod]
    public async Task Before_any_account_is_announced_the_riders_who_checked_in_stand_in()
    {
        var store = new Store();
        var id = await SaveAsync(store, ConfirmedDelivery());
        await using var context = store.NewContext();
        context.RiderStatuses.Add(new RiderStatus { UserId = "rider-1", Name = "Ali", BranchId = Branch, OnDuty = true, LastSeenAt = DateTime.UtcNow });
        await context.SaveChangesAsync();

        Assert.AreEqual(DeliveryStepResult.Done, await AssignAsync(context, Till(), id, "rider-1"));
    }

    [TestMethod]
    public async Task A_rider_moves_only_their_own_and_only_the_rider_s_steps()
    {
        var store = new Store();
        var id = await SaveAsync(store, ConfirmedDelivery());
        await using (var context = store.NewContext())
        {
            await AddRiderAsync(context, "rider-1", "Ali", Branch);
            await AssignAsync(context, Till(), id, "rider-1");
        }

        await using var again = store.NewContext();
        var repository = new OrderRepository(again);

        var notTheirs = await new MarkDeliveryOutCommandHandler(repository, Rider("rider-2"), NullLogger<MarkDeliveryOutCommandHandler>.Instance)
            .Handle(new MarkDeliveryOutCommand(id, Branch), CancellationToken.None);
        Assert.AreEqual(DeliveryStepResult.NotYours, notTheirs);

        var cashByRider = await new HandInDeliveryCashCommandHandler(repository, Rider("rider-1"), NullLogger<HandInDeliveryCashCommandHandler>.Instance)
            .Handle(new HandInDeliveryCashCommand(id, Branch, 120), CancellationToken.None);
        Assert.AreEqual(DeliveryStepResult.NotYours, cashByRider, "the cash is the till's to take");

        var out1 = await new MarkDeliveryOutCommandHandler(repository, Rider("rider-1"), NullLogger<MarkDeliveryOutCommandHandler>.Instance)
            .Handle(new MarkDeliveryOutCommand(id, Branch), CancellationToken.None);
        Assert.AreEqual(DeliveryStepResult.Done, out1);
    }

    [TestMethod]
    public async Task Two_people_moving_the_same_delivery_at_once_cannot_both_win()
    {
        var store = new Store();
        var order = ConfirmedDelivery();
        order.AssignRider("rider-1", "Ali");
        var id = await SaveAsync(store, order);

        await using var first = store.NewContext();
        await using var second = store.NewContext();
        var a = await new OrderRepository(first).GetAsync(id);
        var b = await new OrderRepository(second).GetAsync(id);

        a.MarkOutForDelivery();
        await first.SaveEntitiesAsync();

        b.UnassignRider();
        await Assert.ThrowsExactlyAsync<DbUpdateConcurrencyException>(() => second.SaveEntitiesAsync());
    }

    [TestMethod]
    public void A_delivery_that_could_not_be_handed_over_comes_back_and_can_be_cancelled()
    {
        var order = ConfirmedDelivery();
        order.AssignRider("rider-1", "Ali");
        order.MarkOutForDelivery();

        order.MarkDeliveryFailed("Nobody answered");
        Assert.AreEqual(DeliveryStage.Failed, order.Delivery!.Stage);
        Assert.AreEqual("Nobody answered", order.Delivery.FailureReason);
        var delivered = Assert.ThrowsExactly<OrderingDomainException>(() => order.MarkDelivered());
        Assert.AreEqual(DeliveryErrors.NotOut, delivered.Code);

        order.MarkDeliveryReturned();
        Assert.AreEqual(DeliveryStage.Returned, order.Delivery.Stage);

        order.SetCancelledStatus();
        Assert.AreEqual(OrderStatus.Cancelled, order.OrderStatus);
    }

    [TestMethod]
    public void It_fails_only_on_the_way_and_a_delivered_one_with_its_cash_in_is_never_cancelled()
    {
        var order = ConfirmedDelivery();
        order.AssignRider("rider-1", "Ali");
        Assert.AreEqual(DeliveryErrors.NotOut, Assert.ThrowsExactly<OrderingDomainException>(() => order.MarkDeliveryFailed("x")).Code);

        order.MarkOutForDelivery();
        order.MarkDelivered();
        Assert.AreEqual(DeliveryErrors.AlreadyDelivered, Assert.ThrowsExactly<OrderingDomainException>(() => order.MarkDeliveryFailed("x")).Code);
        order.MarkDeliveryCashHandedIn(120);
        Assert.ThrowsExactly<OrderingDomainException>(() => order.SetCancelledStatus());
    }

    [TestMethod]
    public void The_cash_handed_in_is_kept_and_a_bill_settled_otherwise_is_not_counted_twice()
    {
        var order = ConfirmedDelivery();
        order.AssignRider("rider-1", "Ali");
        order.MarkOutForDelivery();
        order.MarkDelivered();

        Assert.AreEqual(DeliveryErrors.CashInvalid, Assert.ThrowsExactly<OrderingDomainException>(() => order.MarkDeliveryCashHandedIn(-1)).Code);
        order.MarkDeliveryCashHandedIn(100);
        Assert.AreEqual(100m, order.Delivery!.CashCollected);

        var view = DeliveryBoardQueries.ToView(order);
        Assert.AreEqual(120m, view.Total);
        Assert.AreEqual(-20m, view.CashDifference, "twenty short");

        var settled = ConfirmedDelivery();
        settled.AssignRider("rider-1", "Ali");
        settled.MarkOutForDelivery();
        settled.MarkDelivered();
        settled.MarkPaid(7, "Cash", DateTime.UtcNow);
        Assert.AreEqual(DeliveryErrors.AlreadySettled, Assert.ThrowsExactly<OrderingDomainException>(() => settled.MarkDeliveryCashHandedIn(120)).Code);
    }

    [TestMethod]
    public void Every_step_moves_the_version_on()
    {
        var order = ConfirmedDelivery();
        var start = order.Delivery!.Version;
        order.AssignRider("rider-1", "Ali");
        order.MarkOutForDelivery();
        order.MarkDelivered();
        order.MarkDeliveryCashHandedIn(120);
        Assert.AreEqual(start + 4, order.Delivery.Version);
    }

    [TestMethod]
    public void Words_longer_than_their_column_are_refused_as_such()
    {
        var tooLong = Assert.ThrowsExactly<OrderingDomainException>(() =>
            new Delivery(null, null, "Tahrir", null, null, null, new string('x', DeliveryLimits.Directions + 1), "01001234567", 0, null));
        Assert.AreEqual(DeliveryErrors.TooLong, tooLong.Code);
        Assert.AreEqual(StatusCodesFor(DeliveryErrors.TooLong), 400);
    }

    [TestMethod]
    public void The_apps_are_told_a_conflict_from_a_mistake()
    {
        Assert.AreEqual(409, StatusCodesFor(DeliveryErrors.AlreadyOut));
        Assert.AreEqual(409, StatusCodesFor(DeliveryErrors.Conflict));
        Assert.AreEqual(409, StatusCodesFor(DeliveryErrors.NotDelivered));
        Assert.AreEqual(400, StatusCodesFor(DeliveryErrors.OutOfRange));
        Assert.AreEqual(400, StatusCodesFor(DeliveryErrors.RiderUnknown));
        Assert.AreEqual(402, StatusCodesFor(OrderingProblems.ModuleOff));
        Assert.AreEqual(403, StatusCodesFor(DeliveryErrors.RiderNotYours));
        Assert.AreEqual(404, StatusCodesFor(AddressErrors.NotFound));
    }

    private static int StatusCodesFor(string code) => OrderingProblems.StatusFor(code);

    [TestMethod]
    public async Task The_board_leaves_out_voided_deliveries_and_ones_settled_long_ago()
    {
        var store = new Store();
        var open = ConfirmedDelivery();
        var voided = ConfirmedDelivery();
        voided.MarkVoided(DateTime.UtcNow);
        var settledLongAgo = ConfirmedDelivery();
        settledLongAgo.MarkPaid(9, "Cash", DateTime.UtcNow.AddDays(-3));
        var settledToday = ConfirmedDelivery();
        settledToday.MarkPaid(10, "Cash", DateTime.UtcNow.AddHours(-1));
        foreach (var order in new[] { open, voided, settledLongAgo, settledToday })
        {
            await SaveAsync(store, order);
        }

        await using var context = store.NewContext();
        var board = await new DeliveryBoardQueries(context, Egypt, Options).GetBoardAsync(Branch);

        CollectionAssert.AreEquivalent(new[] { open.Id, settledToday.Id }, board.Select(o => o.OrderNumber).ToArray());
        Assert.IsTrue(board.All(o => o.Delivery.Stage == nameof(DeliveryStage.Waiting)));
    }

    [TestMethod]
    public async Task A_caller_s_earlier_addresses_are_this_branch_s_only()
    {
        var store = new Store();
        await SaveAsync(store, ConfirmedDelivery(Branch, "01001112222"));
        await SaveAsync(store, ConfirmedDelivery(OtherBranch, "01001113333"));

        await using var context = store.NewContext();
        var queries = new DeliveryBoardQueries(context, Egypt, Options);

        Assert.HasCount(1, await queries.GetKnownAddressesAsync(Branch, null, "01001112222"));
        Assert.IsEmpty(await queries.GetKnownAddressesAsync(Branch, null, "01001113333"), "another branch's deliveries stay there");
        Assert.IsEmpty(await queries.GetKnownAddressesAsync(Branch, null, null));
    }

    [TestMethod]
    public async Task The_till_s_riders_are_the_branch_s_accounts_merged_with_their_app_s_word()
    {
        var store = new Store();
        await using var context = store.NewContext();
        await AddRiderAsync(context, "rider-1", "Ali", Branch);
        await AddRiderAsync(context, "rider-2", "Bassem", Branch);
        await AddRiderAsync(context, "rider-3", "Omar", OtherBranch);
        context.RiderStatuses.Add(new RiderStatus { UserId = "rider-1", Name = "Ali", BranchId = Branch, OnDuty = true, LastSeenAt = DateTime.UtcNow });
        context.RiderStatuses.Add(new RiderStatus { UserId = "ghost", Name = "Gone", BranchId = Branch, OnDuty = true, LastSeenAt = DateTime.UtcNow });
        await context.SaveChangesAsync();

        var riders = await new RiderDirectory(context, Options).ListAsync(Branch);

        CollectionAssert.AreEqual(new[] { "rider-1", "rider-2" }, riders.Select(r => r.UserId).ToArray(), "on duty first; no account, no rider");
        Assert.IsTrue(riders[0].OnDuty);
        Assert.IsTrue(riders[0].SignedIn);
        Assert.IsFalse(riders[1].SignedIn, "added in Staff, app never opened");
        Assert.IsNull(riders[1].LastSeenAt);
    }

    [TestMethod]
    public async Task An_account_that_stops_being_a_rider_goes_and_a_late_event_does_not_bring_it_back()
    {
        var store = new Store();
        await using var context = store.NewContext();
        var handler = new StaffAccountChangedIntegrationEventHandler(context, NullLogger<StaffAccountChangedIntegrationEventHandler>.Instance);
        var noon = new DateTime(2026, 10, 4, 12, 0, 0, DateTimeKind.Utc);

        await handler.Handle(new StaffAccountChangedIntegrationEvent("rider-1", "Ali", ["Rider"], [Branch], true) { CreationDate = noon });
        await handler.Handle(new StaffAccountChangedIntegrationEvent("rider-1", "Ali", ["Cashier"], [Branch], true) { CreationDate = noon.AddMinutes(1) });
        await handler.Handle(new StaffAccountChangedIntegrationEvent("rider-1", "Ali", ["Rider"], [Branch], true) { CreationDate = noon.AddSeconds(30) });
        await handler.Handle(new StaffAccountChangedIntegrationEvent("cashier-1", "Sara", ["Cashier"], [Branch], true) { CreationDate = noon });

        var rows = await context.RiderAccounts.ToListAsync();
        Assert.HasCount(1, rows, "an account never a rider is not kept");
        Assert.IsFalse(rows[0].IsRider);
        Assert.IsNull(await new RiderDirectory(context, Options).FindAsync("rider-1", Branch));
    }

    [TestMethod]
    public async Task The_admin_standing_in_through_the_rider_app_is_never_listed_as_a_rider()
    {
        var store = new Store();
        await using var context = store.NewContext();
        var admin = Substitute.For<IIdentityService>();
        admin.IsInRole(DeliveryOptions.RiderRole).Returns(false);

        var events = Substitute.For<IOrderingIntegrationEventService>();
        var view = await new SetRiderStatusCommandHandler(context, admin, events)
            .Handle(new SetRiderStatusCommand("admin-1", "Admin", Branch, true), CancellationToken.None);

        Assert.IsTrue(view.OnDuty);
        Assert.IsEmpty(await context.RiderStatuses.ToListAsync());
        await events.DidNotReceiveWithAnyArgs().AddAndSaveEventAsync(default!);

        await new SetRiderStatusCommandHandler(context, Rider("rider-1"), events)
            .Handle(new SetRiderStatusCommand("rider-1", "Ali", Branch, true), CancellationToken.None);
        Assert.HasCount(1, await context.RiderStatuses.ToListAsync());
    }

    [TestMethod]
    public async Task The_till_hears_a_rider_start_and_stop_but_not_every_beat()
    {
        var store = new Store();
        await using var context = store.NewContext();
        var events = Substitute.For<IOrderingIntegrationEventService>();
        var handler = new SetRiderStatusCommandHandler(context, Rider("rider-1"), events);

        await handler.Handle(new SetRiderStatusCommand("rider-1", "Ali", Branch, true), CancellationToken.None);
        await handler.Handle(new SetRiderStatusCommand("rider-1", "Ali", Branch, true), CancellationToken.None);
        await handler.Handle(new SetRiderStatusCommand("rider-1", "Ali", Branch, false), CancellationToken.None);

        var told = events.ReceivedCalls()
            .Select(c => c.GetArguments()[0])
            .OfType<RiderStatusChangedIntegrationEvent>()
            .Select(e => e.OnDuty)
            .ToList();
        CollectionAssert.AreEqual(new[] { true, false }, told, "on duty, then off; the second beat says nothing new");
    }

    private static async Task<IDeliveryPolicy> PolicyAsync(OrderingContext context, decimal minimum = 100, bool orderingOn = true)
    {
        context.BranchSettings.Add(new BranchSettings
        {
            BranchId = Branch,
            IsOrderingEnabled = orderingOn,
            IsDeliveryEnabled = true,
            Latitude = 30.0444,
            Longitude = 31.2357,
            DeliveryRadiusKm = 5,
            DeliveryFee = 20,
            DeliveryMinimumOrder = minimum,
        });
        await context.SaveChangesAsync();
        return new DeliveryPolicy(new BranchSettingsQueries(context), Egypt);
    }

    [TestMethod]
    public async Task The_customer_s_delivery_is_held_to_the_pin_the_area_and_the_minimum()
    {
        await using var context = new Store().NewContext();
        var policy = await PolicyAsync(context);

        async Task<string?> CodeOf(DeliveryDraft draft, decimal subtotal) =>
            (await Assert.ThrowsExactlyAsync<OrderingDomainException>(() =>
                policy.BuildAsync(draft, Branch, DeliveryTaker.Customer, "01001234567", subtotal))).Code;

        Assert.AreEqual(DeliveryErrors.PinInvalid, await CodeOf(new DeliveryDraft(null, null, "Tahrir"), 150));
        Assert.AreEqual(DeliveryErrors.OutOfRange, await CodeOf(new DeliveryDraft(29.87, 31.2357, "Maadi"), 150));
        Assert.AreEqual(DeliveryErrors.BelowMinimum, await CodeOf(new DeliveryDraft(30.06, 31.245, "Tahrir"), 60));
        Assert.AreEqual(DeliveryErrors.PhoneInvalid, (await Assert.ThrowsExactlyAsync<OrderingDomainException>(() =>
            policy.BuildAsync(new DeliveryDraft(30.06, 31.245, "Tahrir", Phone: "12"), Branch, DeliveryTaker.Customer, null, 150))).Code);

        var delivery = await policy.BuildAsync(new DeliveryDraft(30.06, 31.245, "Tahrir"), Branch, DeliveryTaker.Customer, "01001234567", 150);
        Assert.AreEqual(20m, delivery.Fee);
        Assert.IsNotNull(delivery.DistanceMeters);
    }

    [TestMethod]
    public async Task The_till_s_phone_order_is_held_to_neither_the_area_nor_the_minimum_nor_a_pause()
    {
        await using var context = new Store().NewContext();
        var policy = await PolicyAsync(context, orderingOn: false);

        var far = await policy.BuildAsync(new DeliveryDraft(29.87, 31.2357, "Maadi"), Branch, DeliveryTaker.Till, "01001234567", 10);
        var words = await policy.BuildAsync(new DeliveryDraft(null, null, "Maadi, road 9", Phone: "01001234567"), Branch, DeliveryTaker.Till, null, 10);

        Assert.IsTrue(far.DistanceMeters > 5000);
        Assert.IsNull(words.Latitude);
        Assert.AreEqual(DeliveryErrors.NotDelivering, (await Assert.ThrowsExactlyAsync<OrderingDomainException>(() =>
            policy.BuildAsync(new DeliveryDraft(null, null, "x"), Branch, DeliveryTaker.Customer, "01001234567", 500))).Code,
            "paused for customers");
    }

    [TestMethod]
    public async Task A_customer_s_delivery_under_the_minimum_at_the_menu_s_prices_is_cancelled()
    {
        var store = new Store();
        await using var context = store.NewContext();
        await PolicyAsync(context, minimum: 100);
        var order = new Order(string.Empty, string.Empty, Branch, guestId: "device-1", guestName: "Mona", guestPhone: "01001234567", delivery: ToTahrir());
        order.AddOrderItem(1, new() { En = "Latte" }, 60, 0, null, units: 2);
        context.Orders.Add(order);
        await context.SaveChangesAsync();
        var line = order.OrderItems.Single();

        var handler = new SetOrderValidatedCommandHandler(new OrderRepository(context), NullLogger<SetOrderValidatedCommandHandler>.Instance, new BranchSettingsQueries(context));
        var moved = await handler.Handle(new SetOrderValidatedCommand(order.Id, new Dictionary<int, decimal> { [line.Id] = 40 }, null, 0, null), CancellationToken.None);

        Assert.IsFalse(moved);
        Assert.AreEqual(OrderStatus.Cancelled, order.OrderStatus, "80 at the menu's prices, under 100");
    }

    [TestMethod]
    public void The_customer_s_view_names_the_rider_but_never_their_account()
    {
        var order = ConfirmedDelivery();
        order.AssignRider("rider-1", "Ali");

        var view = DeliveryView.From(order.Delivery)!;
        Assert.AreEqual("Ali", view.RiderName);
        Assert.IsFalse(view is DeliveryStaffView);
        Assert.IsNull(typeof(DeliveryView).GetProperty("RiderUserId"));
        Assert.AreEqual("rider-1", DeliveryStaffView.ForStaff(order.Delivery)!.RiderUserId);
    }

    private static Order DeliveredBy(string riderId, int branch = Branch)
    {
        var order = ConfirmedDelivery(branch);
        order.AssignRider(riderId, "Ali");
        order.MarkOutForDelivery();
        order.MarkDelivered();
        order.ClearDomainEvents();
        return order;
    }

    private static Task<DeliveryStepResult> HandInManyAsync(Store store, IIdentityService identity, params (int OrderId, decimal Amount)[] items)
    {
        var context = store.NewContext();
        return new HandInDeliveriesCashCommandHandler(new OrderRepository(context), identity, NullLogger<HandInDeliveriesCashCommandHandler>.Instance)
            .Handle(new HandInDeliveriesCashCommand(Branch, [.. items.Select(i => new DeliveryCashItem(i.OrderId, i.Amount))]), CancellationToken.None);
    }

    private static async Task<Delivery> DeliveryOfAsync(Store store, int orderId)
    {
        await using var context = store.NewContext();
        return (await new OrderRepository(context).GetAsync(orderId))!.Delivery!;
    }

    [TestMethod]
    public async Task A_rider_s_cash_for_several_deliveries_is_counted_in_at_once()
    {
        var store = new Store();
        var first = await SaveAsync(store, DeliveredBy("rider-1"));
        var second = await SaveAsync(store, DeliveredBy("rider-1"));

        Assert.AreEqual(DeliveryStepResult.Done, await HandInManyAsync(store, Till(), (first, 120), (second, 95)));

        Assert.AreEqual(120m, (await DeliveryOfAsync(store, first)).CashCollected);
        Assert.AreEqual(95m, (await DeliveryOfAsync(store, second)).CashCollected);
        Assert.IsNotNull((await DeliveryOfAsync(store, second)).CashHandedInAt);

        // The same hand-in again, a retried request: nothing moves
        Assert.AreEqual(DeliveryStepResult.Done, await HandInManyAsync(store, Till(), (first, 1), (second, 1)));
        Assert.AreEqual(120m, (await DeliveryOfAsync(store, first)).CashCollected);
    }

    [TestMethod]
    public async Task One_delivery_that_cannot_be_counted_in_refuses_the_whole_hand_in()
    {
        var store = new Store();
        var delivered = await SaveAsync(store, DeliveredBy("rider-1"));
        var stillOut = ConfirmedDelivery();
        stillOut.AssignRider("rider-1", "Ali");
        stillOut.MarkOutForDelivery();
        var outId = await SaveAsync(store, stillOut);

        var refused = await Assert.ThrowsExactlyAsync<OrderingDomainException>(() => HandInManyAsync(store, Till(), (delivered, 120), (outId, 95)));
        Assert.AreEqual(DeliveryErrors.NotDelivered, refused.Code);
        Assert.IsNull((await DeliveryOfAsync(store, delivered)).CashHandedInAt, "all or nothing");

        var elsewhere = await SaveAsync(store, DeliveredBy("rider-1", OtherBranch));
        Assert.AreEqual(DeliveryStepResult.NotFound, await HandInManyAsync(store, Till(), (delivered, 120), (elsewhere, 95)));
        Assert.IsNull((await DeliveryOfAsync(store, delivered)).CashHandedInAt);
    }

    [TestMethod]
    public async Task Only_the_till_takes_a_hand_in_and_the_list_must_make_sense()
    {
        var store = new Store();
        var id = await SaveAsync(store, DeliveredBy("rider-1"));

        Assert.AreEqual(DeliveryStepResult.NotYours, await HandInManyAsync(store, Rider("rider-1"), (id, 120)));

        var empty = await Assert.ThrowsExactlyAsync<OrderingDomainException>(() => HandInManyAsync(store, Till()));
        Assert.AreEqual(DeliveryErrors.CashInvalid, empty.Code);
        var twice = await Assert.ThrowsExactlyAsync<OrderingDomainException>(() => HandInManyAsync(store, Till(), (id, 60), (id, 60)));
        Assert.AreEqual(DeliveryErrors.CashInvalid, twice.Code);
        Assert.IsNull((await DeliveryOfAsync(store, id)).CashHandedInAt);
    }
}
