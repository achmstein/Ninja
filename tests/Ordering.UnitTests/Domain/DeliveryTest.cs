namespace Ninja.Ordering.UnitTests.Domain;

using Ninja.Ordering.Domain.AggregatesModel.OrderAggregate;
using Ninja.Ordering.Domain.Events;

[TestClass]
public class DeliveryTest
{
    private static Delivery ToTahrir(decimal fee = 20)
        => new(30.0444, 31.2357, "Tahrir St", "12", "3", "7", "Blue gate", "01001234567", fee, 1800);

    private static Order GuestDelivery(Delivery? delivery = null)
        => new(string.Empty, string.Empty, 1, guestId: "device-1", guestName: "Mona", guestPhone: "01001234567", delivery: delivery ?? ToTahrir());

    private static Order Confirmed(Order? order = null)
    {
        order ??= GuestDelivery();
        order.AddOrderItem(1, new() { En = "Latte" }, 50, 0, null, units: 2);
        order.SetValidatedStatus();
        order.SetConfirmedStatus();
        order.ClearDomainEvents();
        return order;
    }

    [TestMethod]
    public void A_guest_can_have_it_delivered_without_a_table()
    {
        var order = GuestDelivery();

        Assert.IsTrue(order.IsDelivery);
        Assert.IsFalse(order.HasDestination);
        Assert.AreEqual(DeliveryStage.Waiting, order.Delivery!.Stage);
    }

    [TestMethod]
    public void A_guest_without_a_table_or_an_address_is_still_refused()
    {
        Assert.ThrowsExactly<OrderingDomainException>(() =>
            new Order(string.Empty, string.Empty, 1, guestId: "device-1", guestName: "Mona", guestPhone: "01001234567"));
    }

    [TestMethod]
    public void An_order_goes_to_a_table_or_an_address_not_both()
    {
        Assert.ThrowsExactly<OrderingDomainException>(() =>
            new Order("user-1", "Mona", 1, placeId: 4, placeKind: "Table", delivery: ToTahrir()));
    }

    [TestMethod]
    public void A_platform_order_is_never_the_business_own_delivery()
    {
        var talabat = new PlatformOrder("Talabat", "tok", "code", null, PlatformExpedition.PlatformDelivery, null, null, null, true, null, null, null, null, null);
        Assert.ThrowsExactly<OrderingDomainException>(() =>
            new Order(string.Empty, string.Empty, 1, source: OrderSource.Talabat, platform: talabat, delivery: ToTahrir()));
    }

    [TestMethod]
    public void A_delivery_needs_an_address_and_a_phone()
    {
        Assert.ThrowsExactly<OrderingDomainException>(() => new Delivery(30, 31, " ", null, null, null, null, "0100", 0, 0));
        Assert.ThrowsExactly<OrderingDomainException>(() => new Delivery(30, 31, "Tahrir", null, null, null, null, "", 0, 0));
        Assert.ThrowsExactly<OrderingDomainException>(() => new Delivery(95, 31, "Tahrir", null, null, null, null, "0100", 0, 0));
    }

    [TestMethod]
    public void An_address_taken_over_the_phone_goes_without_a_pin()
    {
        var delivery = new Delivery(null, null, "Tahrir St", "12", null, null, "Blue gate", "01001234567", 20, 1800);

        Assert.IsNull(delivery.Latitude);
        Assert.IsNull(delivery.Longitude);
        Assert.IsNull(delivery.DistanceMeters, "no pin, no distance");
        Assert.IsTrue(Confirmed(new Order(string.Empty, string.Empty, 1, guestName: "Mona", source: OrderSource.Pos, delivery: delivery)).IsDelivery);
    }

    [TestMethod]
    public void A_pin_has_both_coordinates_or_none()
    {
        Assert.ThrowsExactly<OrderingDomainException>(() => new Delivery(30, null, "Tahrir", null, null, null, null, "0100", 0, null));
        Assert.ThrowsExactly<OrderingDomainException>(() => new Delivery(null, 31, "Tahrir", null, null, null, null, "0100", 0, null));
    }

    [TestMethod]
    public void The_fee_is_on_the_total_and_no_discount_takes_it_off()
    {
        var order = Confirmed(GuestDelivery(ToTahrir(fee: 25)));

        Assert.AreEqual(125m, order.GetTotal());
    }

    [TestMethod]
    public void It_goes_from_a_rider_to_the_door_to_the_till()
    {
        var order = Confirmed();

        order.AssignRider("rider-1", "Ali");
        Assert.AreEqual(DeliveryStage.Assigned, order.Delivery!.Stage);

        order.MarkOutForDelivery();
        Assert.AreEqual(DeliveryStage.OnTheWay, order.Delivery.Stage);

        order.MarkDelivered();
        Assert.AreEqual(DeliveryStage.Delivered, order.Delivery.Stage);

        order.MarkDeliveryCashHandedIn(125);
        Assert.IsNotNull(order.Delivery.CashHandedInAt);

        var events = order.DomainEvents!.OfType<OrderDeliveryChangedDomainEvent>().ToList();
        Assert.HasCount(4, events);
        Assert.IsTrue(events[^1].CashHandedIn);
    }

    [TestMethod]
    public void It_cannot_leave_without_a_rider_or_arrive_before_it_leaves()
    {
        var order = Confirmed();

        Assert.ThrowsExactly<OrderingDomainException>(() => order.MarkOutForDelivery());
        order.AssignRider("rider-1", "Ali");
        Assert.ThrowsExactly<OrderingDomainException>(() => order.MarkDelivered());
        Assert.ThrowsExactly<OrderingDomainException>(() => order.MarkDeliveryCashHandedIn(125));
    }

    [TestMethod]
    public void Another_rider_can_take_it_until_it_leaves_and_the_first_is_told()
    {
        var order = Confirmed();
        order.AssignRider("rider-1", "Ali");
        order.ClearDomainEvents();

        order.AssignRider("rider-2", "Omar");

        var moved = order.DomainEvents!.OfType<OrderDeliveryChangedDomainEvent>().Single();
        Assert.AreEqual("rider-1", moved.PreviousRiderUserId);
        Assert.AreEqual("Omar", order.Delivery!.RiderName);

        order.MarkOutForDelivery();
        Assert.ThrowsExactly<OrderingDomainException>(() => order.AssignRider("rider-1", "Ali"));
        Assert.ThrowsExactly<OrderingDomainException>(() => order.UnassignRider());
    }

    [TestMethod]
    public void A_repeated_tap_is_a_no_op()
    {
        var order = Confirmed();
        order.AssignRider("rider-1", "Ali");
        order.MarkOutForDelivery();
        order.ClearDomainEvents();

        order.AssignRider("rider-1", "Ali");
        order.MarkOutForDelivery();

        Assert.IsEmpty(order.DomainEvents?.ToList() ?? []);
    }

    [TestMethod]
    public void Only_a_confirmed_delivery_goes_out()
    {
        var order = GuestDelivery();

        Assert.ThrowsExactly<OrderingDomainException>(() => order.AssignRider("rider-1", "Ali"));
    }

    [TestMethod]
    public void Distances_are_as_the_crow_flies()
    {
        // Tahrir Square to the Giza pyramids: about 13 km
        var meters = Geo.DistanceMeters(30.0444, 31.2357, 29.9792, 31.1342);

        Assert.IsTrue(meters is > 12_000 and < 13_500, $"{meters} m");
        Assert.AreEqual(0, Geo.DistanceMeters(30, 31, 30, 31));
    }
}
