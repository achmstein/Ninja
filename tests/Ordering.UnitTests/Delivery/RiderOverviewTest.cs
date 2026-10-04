namespace Ninja.Ordering.UnitTests.Application;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Options;
using Ninja.Ordering.Domain.AggregatesModel.OrderAggregate;
using Ninja.Ordering.Domain.Events;
using Ninja.Ordering.Infrastructure;
using Order = Ninja.Ordering.Domain.AggregatesModel.OrderAggregate.Order;

/// <summary>
/// The admin's Riders page: who is working now (Online, Quiet, Off), what each
/// did today, a rider's deliveries over a window (those taken from them too),
/// and one delivery's steps as its history recorded them.
/// </summary>
[TestClass]
public class RiderOverviewTest
{
    private const int Branch = 1;
    private const int OtherBranch = 2;
    private static readonly DeliveryOptions Defaults = new();
    private static readonly IOptions<DeliveryOptions> Options = Microsoft.Extensions.Options.Options.Create(Defaults);

    private sealed class Store
    {
        private readonly string _name = $"ordering-{Guid.NewGuid()}";
        private readonly InMemoryDatabaseRoot _root = new();

        public OrderingContext NewContext() =>
            new(new DbContextOptionsBuilder<OrderingContext>().UseInMemoryDatabase(_name, _root).Options, Substitute.For<IMediator>());
    }

    private static Order Delivery(int branch = Branch)
    {
        var order = new Order(string.Empty, string.Empty, branch, guestId: "device-1", guestName: "Mona", guestPhone: "01001234567",
            delivery: new Delivery(30.0444, 31.2357, "Tahrir St", "12", "3", null, null, "01001234567", 20, 1800));
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

    private static RiderAccount Account(string userId, string name, bool enabled = true, params int[] branches) => new()
    {
        UserId = userId,
        Name = name,
        IsRider = true,
        Branches = branches.Length == 0 ? [Branch] : [.. branches],
        Enabled = enabled,
        UpdatedAt = DateTime.UtcNow,
    };

    private static DeliveryAssignment Step(int orderId, DeliveryAction action, string? rider, string? riderName, DateTime at, string? previous = null, int branch = Branch) => new()
    {
        OrderId = orderId,
        BranchId = branch,
        RiderUserId = rider,
        RiderName = riderName,
        PreviousRiderUserId = previous,
        Action = action,
        At = at,
        ActorUserId = "cashier-1",
        ActorName = "Sara",
        ActorRole = "Till",
    };

    [TestMethod]
    public void A_rider_is_online_on_duty_here_and_heard_lately_quiet_when_not_heard_and_off_otherwise()
    {
        var now = new DateTime(2026, 10, 4, 12, 0, 0, DateTimeKind.Utc);
        var gone = Defaults.RiderGone;
        RiderStatus Heard(bool onDuty, int branch, TimeSpan ago) => new() { UserId = "r", Name = "Ali", OnDuty = onDuty, BranchId = branch, LastSeenAt = now - ago };

        Assert.AreEqual(RiderPresence.Online, RiderPresenceRule.Of(Heard(true, Branch, TimeSpan.FromMinutes(2)), Branch, now, gone));
        Assert.AreEqual(RiderPresence.Quiet, RiderPresenceRule.Of(Heard(true, Branch, gone + TimeSpan.FromMinutes(1)), Branch, now, gone));
        Assert.AreEqual(RiderPresence.Off, RiderPresenceRule.Of(Heard(false, Branch, TimeSpan.FromMinutes(1)), Branch, now, gone));
        Assert.AreEqual(RiderPresence.Off, RiderPresenceRule.Of(Heard(true, OtherBranch, TimeSpan.FromMinutes(1)), Branch, now, gone), "on duty elsewhere is off here");
        Assert.AreEqual(RiderPresence.Off, RiderPresenceRule.Of(null, Branch, now, gone), "never opened the app");
    }

    [TestMethod]
    public void The_day_starts_at_the_callers_midnight()
    {
        // Cairo is UTC+2: JavaScript's getTimezoneOffset says -120; at 23:30 UTC it is already 01:30 the next day there
        var utc = new DateTime(2026, 10, 4, 23, 30, 0, DateTimeKind.Utc);
        Assert.AreEqual(new DateTime(2026, 10, 4, 22, 0, 0, DateTimeKind.Utc), RiderPresenceRule.StartOfDay(utc, -120));
        Assert.AreEqual(new DateTime(2026, 10, 4, 0, 0, 0, DateTimeKind.Utc), RiderPresenceRule.StartOfDay(utc, 0));
    }

    [TestMethod]
    public async Task The_overview_lists_the_branchs_riders_online_first_with_their_day()
    {
        var store = new Store();
        await using (var context = store.NewContext())
        {
            context.RiderAccounts.AddRange(
                Account("ali", "Ali"),
                Account("omar", "Omar"),
                Account("gone", "Gone", enabled: false),
                Account("elsewhere", "Elsewhere", branches: OtherBranch));
            context.RiderStatuses.AddRange(
                new RiderStatus { UserId = "omar", Name = "Omar", BranchId = Branch, OnDuty = true, LastSeenAt = DateTime.UtcNow },
                new RiderStatus { UserId = "ali", Name = "Ali", BranchId = Branch, OnDuty = false, LastSeenAt = DateTime.UtcNow.AddHours(-1) });
            await context.SaveChangesAsync();
        }

        // Omar: one delivered and cashed in, one failed, one still out
        var delivered = Delivery();
        delivered.AssignRider("omar", "Omar");
        delivered.MarkOutForDelivery();
        delivered.MarkDelivered();
        delivered.MarkDeliveryCashHandedIn(130);
        await SaveAsync(store, delivered);

        var failed = Delivery();
        failed.AssignRider("omar", "Omar");
        failed.MarkOutForDelivery();
        failed.MarkDeliveryFailed("No answer");
        await SaveAsync(store, failed);

        var open = Delivery();
        open.AssignRider("omar", "Omar");
        await SaveAsync(store, open);

        // Another branch's delivery of the same rider is not counted here
        var there = Delivery(OtherBranch);
        there.AssignRider("omar", "Omar");
        there.MarkOutForDelivery();
        there.MarkDelivered();
        await SaveAsync(store, there);

        await using var read = store.NewContext();
        var riders = await new RiderOverviewQueries(read, Options).GetOverviewAsync(Branch, 0);

        CollectionAssert.AreEqual(new[] { "omar", "ali", "gone" }, riders.Select(r => r.UserId).ToArray(), "online first; another branch's rider is not listed");
        var omar = riders[0];
        Assert.AreEqual(nameof(RiderPresence.Online), omar.Status);
        Assert.AreEqual(1, omar.DeliveredToday);
        Assert.AreEqual(1, omar.FailedToday);
        Assert.AreEqual(130m, omar.CashCollectedToday);
        Assert.AreEqual(2, omar.Out, "the failed one is not back yet, and the one not yet out");
        Assert.AreEqual(nameof(RiderPresence.Off), riders[1].Status);
        Assert.IsTrue(riders[1].SignedIn);
        Assert.IsFalse(riders[2].Enabled);
        Assert.IsFalse(riders[2].SignedIn);
    }

    [TestMethod]
    public void Each_step_makes_one_history_row_with_who_took_it()
    {
        var order = Delivery();
        DeliveryAssignment Row(OrderDeliveryChangedDomainEvent step, bool byTill = true) =>
            OrderDeliveryChangedDomainEventHandler.HistoryRow(step, DateTime.UtcNow, byTill ? "cashier-1" : "ali", byTill ? "Sara" : "Ali", byTill);
        OrderDeliveryChangedDomainEvent Last() => order.DomainEvents.OfType<OrderDeliveryChangedDomainEvent>().Last();

        order.AssignRider("ali", "Ali");
        var given = Row(Last());
        Assert.AreEqual(DeliveryAction.Assigned, given.Action);
        Assert.AreEqual("ali", given.RiderUserId);
        Assert.AreEqual("Till", given.ActorRole);
        Assert.AreEqual("Sara", given.ActorName);

        order.AssignRider("omar", "Omar");
        var reassigned = Row(Last());
        Assert.AreEqual(DeliveryAction.Reassigned, reassigned.Action);
        Assert.AreEqual("omar", reassigned.RiderUserId);
        Assert.AreEqual("ali", reassigned.PreviousRiderUserId);

        order.UnassignRider();
        var takenBack = Row(Last());
        Assert.AreEqual(DeliveryAction.Unassigned, takenBack.Action);
        Assert.IsNull(takenBack.RiderUserId);
        Assert.AreEqual("omar", takenBack.PreviousRiderUserId);

        order.AssignRider("ali", "Ali");
        order.MarkOutForDelivery();
        var left = Row(Last(), byTill: false);
        Assert.AreEqual(DeliveryAction.Out, left.Action);
        Assert.AreEqual("Rider", left.ActorRole);
        Assert.AreEqual("ali", left.ActorUserId);

        order.MarkDeliveryFailed("No answer");
        var failed = Row(Last(), byTill: false);
        Assert.AreEqual(DeliveryAction.Failed, failed.Action);
        Assert.AreEqual("No answer", failed.Reason);

        order.MarkDeliveryReturned();
        Assert.AreEqual(DeliveryAction.Returned, Row(Last()).Action);

        var cashed = Delivery();
        cashed.AssignRider("ali", "Ali");
        cashed.MarkOutForDelivery();
        cashed.MarkDelivered();
        Assert.AreEqual(DeliveryAction.Delivered, OrderDeliveryChangedDomainEventHandler.HistoryRow(cashed.DomainEvents.OfType<OrderDeliveryChangedDomainEvent>().Last(), DateTime.UtcNow, "ali", "Ali", false).Action);
        cashed.MarkDeliveryCashHandedIn(140);
        var cashIn = OrderDeliveryChangedDomainEventHandler.HistoryRow(cashed.DomainEvents.OfType<OrderDeliveryChangedDomainEvent>().Last(), DateTime.UtcNow, "cashier-1", "Sara", true);
        Assert.AreEqual(DeliveryAction.CashIn, cashIn.Action);
        Assert.AreEqual(140m, cashIn.CashCollected);
    }

    [TestMethod]
    public async Task A_riders_history_keeps_deliveries_taken_from_them_and_counts_only_what_stayed_theirs()
    {
        var store = new Store();
        var now = DateTime.UtcNow;

        // Given to Ali, then to Omar before it left: Ali's history shows it given to Omar
        var reassigned = Delivery();
        reassigned.AssignRider("omar", "Omar");
        var reassignedId = await SaveAsync(store, reassigned);

        // Ali's own: delivered, ten over (two lattes and the fee are 120)
        var mine = Delivery();
        mine.AssignRider("ali", "Ali");
        mine.MarkOutForDelivery();
        mine.MarkDelivered();
        mine.MarkDeliveryCashHandedIn(130);
        var mineId = await SaveAsync(store, mine);

        // Given to Ali and taken back
        var takenBack = Delivery();
        var takenBackId = await SaveAsync(store, takenBack);

        // From before the history was kept: still Ali's, no rows at all
        var unrecorded = Delivery();
        unrecorded.AssignRider("ali", "Ali");
        var unrecordedId = await SaveAsync(store, unrecorded);

        // Given to Ali long ago: outside the window
        var old = Delivery();
        var oldId = await SaveAsync(store, old);

        await using (var context = store.NewContext())
        {
            context.DeliveryAssignments.AddRange(
                Step(reassignedId, DeliveryAction.Assigned, "ali", "Ali", now.AddHours(-5)),
                Step(reassignedId, DeliveryAction.Reassigned, "omar", "Omar", now.AddHours(-4), previous: "ali"),
                Step(mineId, DeliveryAction.Assigned, "ali", "Ali", now.AddHours(-3)),
                Step(mineId, DeliveryAction.Out, "ali", "Ali", now.AddHours(-3)),
                Step(mineId, DeliveryAction.Delivered, "ali", "Ali", now.AddHours(-2)),
                Step(takenBackId, DeliveryAction.Assigned, "ali", "Ali", now.AddHours(-2)),
                Step(takenBackId, DeliveryAction.Unassigned, null, null, now.AddHours(-1), previous: "ali"),
                Step(oldId, DeliveryAction.Assigned, "ali", "Ali", now.AddDays(-30)));
            await context.SaveChangesAsync();
        }

        await using var read = store.NewContext();
        var queries = new RiderOverviewQueries(read, Options);
        var history = await queries.GetHistoryAsync(Branch, "ali", now.AddDays(-7), now.AddMinutes(1), page: 1, pageSize: 25);

        var byOrder = history.Items.ToDictionary(i => i.OrderNumber);
        CollectionAssert.AreEquivalent(new[] { reassignedId, mineId, takenBackId, unrecordedId }, byOrder.Keys.ToArray(), "the one given long ago is outside the window");

        Assert.AreEqual("GivenToOther", byOrder[reassignedId].Stage);
        Assert.AreEqual("Omar", byOrder[reassignedId].GivenToRiderName);
        Assert.IsFalse(byOrder[reassignedId].StillWithRider);
        Assert.AreEqual("TakenBack", byOrder[takenBackId].Stage);
        Assert.IsNotNull(byOrder[takenBackId].TakenFromRiderAt);
        Assert.AreEqual(nameof(DeliveryStage.Delivered), byOrder[mineId].Stage);
        Assert.AreEqual(10m, byOrder[mineId].CashDifference);
        Assert.IsTrue(byOrder[unrecordedId].StillWithRider);

        Assert.AreEqual(1, history.Summary.Delivered, "only what stayed theirs counts");
        Assert.AreEqual(130m, history.Summary.CashCollected);
        Assert.AreEqual(10m, history.Summary.CashDifferenceTotal);

        // Newest first, a page at a time
        var page2 = await queries.GetHistoryAsync(Branch, "ali", now.AddDays(-7), now.AddMinutes(1), page: 2, pageSize: 1);
        Assert.HasCount(1, page2.Items);
        Assert.AreEqual(4, page2.TotalCount);
        Assert.AreEqual(history.Items[1].OrderNumber, page2.Items[0].OrderNumber);

        // Omar's history has it as his own, another branch's has nothing
        var omar = await queries.GetHistoryAsync(Branch, "omar", now.AddDays(-7), now.AddMinutes(1), 1, 25);
        Assert.IsTrue(omar.Items.Single(i => i.OrderNumber == reassignedId).StillWithRider);
        Assert.IsEmpty((await queries.GetHistoryAsync(OtherBranch, "ali", now.AddDays(-7), now.AddMinutes(1), 1, 25)).Items);
    }

    [TestMethod]
    public async Task A_deliverys_timeline_is_its_steps_in_order_and_another_branch_has_none()
    {
        var store = new Store();
        var now = DateTime.UtcNow;
        var order = Delivery();
        order.AssignRider("omar", "Omar");
        var id = await SaveAsync(store, order);

        await using (var context = store.NewContext())
        {
            context.DeliveryAssignments.AddRange(
                Step(id, DeliveryAction.Reassigned, "omar", "Omar", now.AddMinutes(-5), previous: "ali"),
                Step(id, DeliveryAction.Assigned, "ali", "Ali", now.AddMinutes(-10)));
            await context.SaveChangesAsync();
        }

        await using var read = store.NewContext();
        var queries = new RiderOverviewQueries(read, Options);
        var steps = await queries.GetTimelineAsync(Branch, id);

        Assert.IsNotNull(steps);
        CollectionAssert.AreEqual(new[] { "Assigned", "Reassigned" }, steps.Select(s => s.Action).ToArray());
        Assert.AreEqual("Ali", steps[1].PreviousRiderName, "named from the step that gave it to them");
        Assert.AreEqual("Sara", steps[0].ActorName);
        Assert.IsNull(await queries.GetTimelineAsync(OtherBranch, id));
    }
}
