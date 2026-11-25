namespace Ninja.Ordering.UnitTests.Application;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Logging.Abstractions;
using Ninja.Ordering.API.Application.Queries;
using Ninja.Ordering.Domain.AggregatesModel.OrderAggregate;
using Ninja.Ordering.Infrastructure;
using Ninja.Ordering.Infrastructure.Deliveries;
using Ninja.Ordering.Infrastructure.Repositories;
using Order = Ninja.Ordering.Domain.AggregatesModel.OrderAggregate.Order;

/// <summary>
/// A delivery a courier company carries instead of a rider: one or the other, never both; it can
/// leave with a courier; it is said delivered with what the courier collected, which is what
/// settles the bill; and the courier's cash is never handed in at the till.
/// </summary>
[TestClass]
public class CourierTest
{
    private const int Branch = 1;

    private sealed class Store
    {
        private readonly string _name = $"ordering-{Guid.NewGuid()}";
        private readonly InMemoryDatabaseRoot _root = new();

        public OrderingContext NewContext() =>
            new(new DbContextOptionsBuilder<OrderingContext>().UseInMemoryDatabase(_name, _root).Options, Substitute.For<IMediator>());
    }

    private static Delivery ToTahrir() => new(30.0444, 31.2357, "Tahrir St", "12", null, null, null, "01001234567", 20, 1800);

    /// <summary>Two lattes and the fee: 2 × 50 + 20 = 120</summary>
    private static Order ConfirmedDelivery(bool paysOnline = false)
    {
        var order = new Order(string.Empty, string.Empty, Branch, guestId: "device-1", guestName: "Mona", guestPhone: "01001234567",
            guestOrdersAnywhere: paysOnline, delivery: ToTahrir(), paysOnline: paysOnline);
        order.AddOrderItem(1, new() { En = "Latte" }, 50, 0, null, units: 2);
        order.SetValidatedStatus();
        if (paysOnline)
            order.MarkPaidOnline(Guid.NewGuid(), 120m, DateTime.UtcNow);
        order.SetConfirmedStatus();
        order.ClearDomainEvents();
        return order;
    }

    private static void AssertRefused(string code, Action step)
    {
        var refused = Assert.ThrowsExactly<OrderingDomainException>(step);
        Assert.AreEqual(code, refused.Code);
    }

    private static IIdentityService Till()
    {
        var identity = Substitute.For<IIdentityService>();
        identity.RunsTheTill().Returns(true);
        identity.GetUserIdentity().Returns("cashier-1");
        return identity;
    }

    [TestMethod]
    public void A_delivery_is_with_a_rider_or_a_courier_never_both()
    {
        var order = ConfirmedDelivery();
        order.AssignRider("rider-1", "Ali");
        order.ClearDomainEvents();

        order.AssignCourier(7, "Fast Couriers", "Hassan", "01005550000", 35m);

        Assert.IsNull(order.Delivery!.RiderUserId, "the rider no longer has it");
        Assert.IsTrue(order.Delivery.HasCourier);
        Assert.AreEqual(DeliveryStage.Assigned, order.Delivery.Stage);
        Assert.AreEqual("rider-1", order.DomainEvents.OfType<OrderDeliveryChangedDomainEvent>().Single().PreviousRiderUserId, "the rider is told it was taken");

        order.AssignRider("rider-2", "Omar");
        Assert.IsFalse(order.Delivery.HasCourier, "the courier company no longer has it");
        Assert.IsNull(order.Delivery.CourierFee);
        Assert.AreEqual("rider-2", order.Delivery.RiderUserId);
    }

    [TestMethod]
    public void Taken_back_from_the_courier_it_waits_for_someone_again()
    {
        var order = ConfirmedDelivery();
        order.AssignCourier(7, "Fast Couriers", null, null, 35m);

        order.UnassignRider();

        Assert.IsFalse(order.Delivery!.HasCourier);
        Assert.AreEqual(DeliveryStage.Waiting, order.Delivery.Stage);
    }

    [TestMethod]
    public void It_leaves_with_a_courier_and_no_rider_and_is_given_to_nobody_once_it_has()
    {
        var order = ConfirmedDelivery();
        order.AssignCourier(7, "Fast Couriers", null, null, 35m);

        order.MarkOutForDelivery();

        Assert.AreEqual(DeliveryStage.OnTheWay, order.Delivery!.Stage);
        AssertRefused(DeliveryErrors.AlreadyOut, () => order.AssignCourier(8, "Other", null, null, null));
        AssertRefused(DeliveryErrors.NoRider, () => ConfirmedDelivery().MarkOutForDelivery());
    }

    [TestMethod]
    public void It_is_said_delivered_with_what_the_courier_collected_once()
    {
        var order = ConfirmedDelivery();
        order.AssignCourier(7, "Fast Couriers", null, null, 35m);
        order.MarkOutForDelivery();
        order.ClearDomainEvents();

        AssertRefused(DeliveryErrors.CourierAmountRequired, () => order.MarkDelivered());

        order.MarkCourierDelivered(120m);

        Assert.AreEqual(DeliveryStage.Delivered, order.Delivery!.Stage);
        Assert.AreEqual(120m, order.Delivery.CourierCollected);
        var said = order.DomainEvents.OfType<OrderDeliveryChangedDomainEvent>().Single();
        Assert.IsTrue(said.CourierCollected, "Sales settles the bill to the courier company on it");

        order.ClearDomainEvents();
        order.MarkCourierDelivered(90m);
        Assert.AreEqual(120m, order.Delivery.CourierCollected, "a repeat changes nothing");
        Assert.IsFalse(order.DomainEvents.Any());
    }

    [TestMethod]
    public void Before_it_has_left_it_cannot_be_said_delivered()
    {
        var order = ConfirmedDelivery();
        order.AssignCourier(7, "Fast Couriers", null, null, 35m);

        AssertRefused(DeliveryErrors.NotOut, () => order.MarkCourierDelivered(120m));
        AssertRefused(DeliveryErrors.NoCourier, () => ConfirmedDelivery().MarkCourierDelivered(120m));
    }

    [TestMethod]
    public void Paid_online_ahead_the_courier_collected_nothing_whatever_is_said()
    {
        var order = ConfirmedDelivery(paysOnline: true);
        order.AssignCourier(7, "Fast Couriers", null, null, 35m);
        order.MarkOutForDelivery();

        order.MarkCourierDelivered(120m);

        Assert.AreEqual(0m, order.Delivery!.CourierCollected);
    }

    [TestMethod]
    public void A_couriers_cash_is_never_handed_in_at_the_till()
    {
        var order = ConfirmedDelivery();
        order.AssignCourier(7, "Fast Couriers", null, null, 35m);
        order.MarkOutForDelivery();
        order.MarkCourierDelivered(120m);

        AssertRefused(DeliveryErrors.CourierHasIt, () => order.MarkDeliveryCashHandedIn(120m));
    }

    [TestMethod]
    public void A_fee_below_zero_and_a_company_with_no_name_are_refused()
    {
        AssertRefused(DeliveryErrors.CourierFeeInvalid, () => ConfirmedDelivery().AssignCourier(7, "Fast Couriers", null, null, -1m));
        AssertRefused(DeliveryErrors.CourierUnknown, () => ConfirmedDelivery().AssignCourier(7, " ", null, null, null));
    }

    [TestMethod]
    public void The_history_records_the_courier_company_and_what_the_courier_collected()
    {
        var order = ConfirmedDelivery();
        order.AssignCourier(7, "Fast Couriers", "Hassan", null, 35m);
        order.MarkOutForDelivery();
        order.ClearDomainEvents();
        order.MarkCourierDelivered(120m);

        var row = OrderDeliveryChangedDomainEventHandler.HistoryRow(
            order.DomainEvents.OfType<OrderDeliveryChangedDomainEvent>().Single(), DateTime.UtcNow, "cashier-1", "Sara", byTill: true);

        Assert.AreEqual(DeliveryAction.Delivered, row.Action);
        Assert.AreEqual(120m, row.CashCollected);
        Assert.AreEqual(7, row.CourierProviderId);
        Assert.AreEqual("Fast Couriers", row.CourierProvider);
        Assert.AreEqual("Hassan", row.CourierName);
    }

    [TestMethod]
    public async Task The_till_gives_it_to_a_company_the_business_lists_at_its_usual_fee_and_never_one_switched_off()
    {
        var store = new Store();
        int id, listed, off;
        await using (var context = store.NewContext())
        {
            var order = ConfirmedDelivery();
            context.Orders.Add(order);
            var fast = context.CourierProviders.Add(new CourierCompany { Name = "Fast Couriers", DefaultFee = 35m, IsActive = true }).Entity;
            var gone = context.CourierProviders.Add(new CourierCompany { Name = "Gone Couriers", IsActive = false }).Entity;
            await context.SaveChangesAsync();
            (id, listed, off) = (order.Id, fast.Id, gone.Id);
        }

        await using (var context = store.NewContext())
        {
            var handler = new AssignDeliveryCourierCommandHandler(new OrderRepository(context), Till(), context, Substitute.For<ICourierDispatch>(), NullLogger<AssignDeliveryCourierCommandHandler>.Instance);

            await Assert.ThrowsExactlyAsync<OrderingDomainException>(() =>
                handler.Handle(new AssignDeliveryCourierCommand(id, Branch, off, null, null, null), CancellationToken.None));
            Assert.AreEqual(DeliveryStepResult.Done,
                await handler.Handle(new AssignDeliveryCourierCommand(id, Branch, listed, "Hassan", null, null), CancellationToken.None));
        }

        await using (var context = store.NewContext())
        {
            var delivery = (await context.Orders.SingleAsync(o => o.Id == id)).Delivery!;
            Assert.AreEqual("Fast Couriers", delivery.CourierProvider);
            Assert.AreEqual(35m, delivery.CourierFee, "the company's usual fee when the till left it out");
            Assert.AreEqual("Hassan", delivery.CourierName);
        }
    }

    [TestMethod]
    public async Task A_rider_cannot_take_a_couriers_steps()
    {
        var store = new Store();
        int id;
        await using (var context = store.NewContext())
        {
            var order = ConfirmedDelivery();
            order.AssignCourier(7, "Fast Couriers", null, null, 35m);
            context.Orders.Add(order);
            await context.SaveChangesAsync();
            id = order.Id;
        }

        var rider = Substitute.For<IIdentityService>();
        rider.RunsTheTill().Returns(false);
        rider.GetUserIdentity().Returns("rider-1");
        await using var ctx = store.NewContext();
        var result = await new MarkDeliveryOutCommandHandler(new OrderRepository(ctx), rider, NullLogger<MarkDeliveryOutCommandHandler>.Instance)
            .Handle(new MarkDeliveryOutCommand(id, Branch), CancellationToken.None);

        Assert.AreEqual(DeliveryStepResult.NotYours, result);
    }

    [TestMethod]
    public void The_till_sees_the_courier_and_the_customer_sees_the_couriers_name_and_never_their_phone()
    {
        var order = ConfirmedDelivery();
        order.AssignCourier(7, "Fast Couriers", "Hassan", "01005550000", 35m);

        var staff = DeliveryStaffView.ForStaff(order.Delivery)!;
        var customer = DeliveryView.From(order.Delivery)!;

        Assert.AreEqual("01005550000", staff.CourierPhone);
        Assert.AreEqual(35m, staff.CourierFee);
        Assert.AreEqual("Hassan", customer.CourierName);
        Assert.AreEqual("Hassan", customer.RiderName, "the apps say who is bringing it where a rider's name would be");
        Assert.IsNull(staff.RiderName, "the till sees the courier on its own fields, never as a rider");
        Assert.AreEqual("Fast Couriers", customer.CourierProvider);
        Assert.IsNull(typeof(DeliveryView).GetProperty(nameof(DeliveryStaffView.CourierPhone)), "the customer's view has no courier phone");
    }

    [TestMethod]
    public void A_connected_companys_job_is_kept_until_another_company_has_the_delivery()
    {
        var order = ConfirmedDelivery();
        order.AssignCourier(7, "Fast Couriers", null, null, 30m);
        order.RecordCourierJob("job-1", "https://track.test/1", 35m);
        Assert.AreEqual(35m, order.Delivery!.CourierFee, "the company's own fee for the job");

        // The same company: still its job
        order.AssignCourier(7, "Fast Couriers", "Karim", null, 35m);
        Assert.AreEqual("job-1", order.Delivery.CourierJobId);

        order.AssignCourier(8, "Other Couriers", null, null, 25m);
        Assert.IsNull(order.Delivery.CourierJobId);
        Assert.IsNull(order.Delivery.CourierTrackingUrl);
    }

    [TestMethod]
    public void A_status_count_at_or_below_the_last_is_not_taken_again()
    {
        var order = ConfirmedDelivery();
        order.AssignCourier(7, "Fast Couriers", null, null, 30m);
        order.RecordCourierJob("job-1", null, null);

        Assert.IsTrue(order.AdvanceCourierSequence(2));
        Assert.IsFalse(order.AdvanceCourierSequence(2), "sent again");
        Assert.IsFalse(order.AdvanceCourierSequence(1), "overtaken");
        Assert.IsTrue(order.AdvanceCourierSequence(3));

        order.UnassignRider();
        order.AssignCourier(7, "Fast Couriers", null, null, 30m);
        order.RecordCourierJob("job-2", null, null);
        Assert.IsTrue(order.AdvanceCourierSequence(1), "a new job counts from the start");
    }

    [TestMethod]
    public void Who_the_company_sent_is_told_once_and_only_when_it_changes()
    {
        var order = ConfirmedDelivery();
        order.AssignCourier(7, "Fast Couriers", null, null, 30m);
        order.ClearDomainEvents();

        order.UpdateCourier("Karim", "01112223334", null);
        Assert.AreEqual(1, order.DomainEvents!.Count);
        Assert.AreEqual("Karim", order.Delivery!.CourierName);

        order.ClearDomainEvents();
        order.UpdateCourier("Karim", null, null);
        Assert.IsTrue(order.DomainEvents is null || order.DomainEvents.Count == 0, "nothing new to tell");
        Assert.AreEqual("01112223334", order.Delivery.CourierPhone, "a status that leaves the phone out keeps it");
    }

    [TestMethod]
    public void A_job_is_recorded_only_for_a_delivery_a_company_has()
    {
        var order = ConfirmedDelivery();
        AssertRefused(DeliveryErrors.NoCourier, () => order.RecordCourierJob("job-1", null, null));
        AssertRefused(DeliveryErrors.NoCourier, () => order.UpdateCourier("Karim", null, null));
    }

    [TestMethod]
    public void A_cancel_the_company_did_not_take_is_tried_again_soon_then_less_often()
    {
        Assert.AreEqual(TimeSpan.FromSeconds(15), Ninja.Ordering.API.Deliveries.CourierCancelSender.Backoff(1));
        Assert.AreEqual(TimeSpan.FromSeconds(30), Ninja.Ordering.API.Deliveries.CourierCancelSender.Backoff(2));
        Assert.AreEqual(TimeSpan.FromMinutes(1), Ninja.Ordering.API.Deliveries.CourierCancelSender.Backoff(3));
        Assert.AreEqual(TimeSpan.FromMinutes(15), Ninja.Ordering.API.Deliveries.CourierCancelSender.Backoff(30), "never longer than a quarter of an hour");
    }
}
