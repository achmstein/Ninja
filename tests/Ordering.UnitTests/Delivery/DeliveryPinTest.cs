namespace Ninja.Ordering.UnitTests.Application;

using Ninja.Ordering.API.Deliveries;
using Ninja.Ordering.Domain.AggregatesModel.OrderAggregate;
using Order = Ninja.Ordering.Domain.AggregatesModel.OrderAggregate.Order;

/// <summary>
/// How far a delivery's pin can be trusted: where it came from, a location the caller shares after the
/// order was placed, and the door as the rider found it, which a regular's next order goes to.
/// </summary>
[TestClass]
public class DeliveryPinTest
{
    private static Delivery ByPhone(double? lat = null, double? lng = null, DeliveryPinSource source = DeliveryPinSource.Search) =>
        new(lat, lng, "Street 9", "12", "3", null, null, "01001234567", 20, lat is null ? null : 900, pinSource: source, locationShareToken: "abc123");

    private static Order Confirmed(Delivery delivery)
    {
        var order = new Order(string.Empty, string.Empty, 1, guestId: "till", guestName: "Mona", guestPhone: "01001234567", delivery: delivery);
        order.AddOrderItem(1, new() { En = "Latte" }, 50, 0, null, units: 2);
        order.SetValidatedStatus();
        order.SetConfirmedStatus();
        order.ClearDomainEvents();
        return order;
    }

    [TestMethod]
    public void A_pin_says_where_it_came_from_and_none_without_one()
    {
        Assert.AreEqual(DeliveryPinSource.None, ByPhone().PinSource);
        Assert.AreEqual(DeliveryPinSource.Search, ByPhone(30.05, 31.23).PinSource);
        Assert.AreEqual(DeliveryPinSource.Search, ByPhone(30.05, 31.23, DeliveryPinSource.None).PinSource, "a pin said to be none was found on the map");
        Assert.AreEqual(DeliveryPinSource.Rider, ByPhone(30.05, 31.23, DeliveryPinSource.Rider).PinSource);
        Assert.AreEqual("abc123", ByPhone().LocationShareToken);
    }

    [TestMethod]
    public void A_shared_location_becomes_the_pin_until_it_is_handed_over()
    {
        var order = Confirmed(ByPhone());
        Assert.IsTrue(order.ShareDeliveryPin(30.06, 31.24, 1200));
        Assert.AreEqual((30.06, 31.24, DeliveryPinSource.Shared, 1200), (order.Delivery!.Latitude, order.Delivery.Longitude, order.Delivery.PinSource, order.Delivery.DistanceMeters));
        Assert.AreEqual(0, order.DomainEvents?.Count ?? 0, "not a step: nothing is said to the customer");
        Assert.IsFalse(order.ShareDeliveryPin(30.06, 31.24, 1200), "the same again changes nothing");

        order.AssignRider("rider-1", "Ali");
        order.MarkOutForDelivery();
        order.MarkDelivered();
        Assert.IsFalse(order.ShareDeliveryPin(30.07, 31.25, 1300), "handed over: the pin stays as it was");
        Assert.AreEqual(30.06, order.Delivery.Latitude);
    }

    [TestMethod]
    public void A_shared_location_never_moves_the_customers_own_pin()
    {
        var order = Confirmed(ByPhone(30.05, 31.23, DeliveryPinSource.Customer));
        Assert.IsFalse(order.ShareDeliveryPin(30.06, 31.24, 1200));
        Assert.AreEqual(30.05, order.Delivery!.Latitude);
    }

    [TestMethod]
    public void The_rider_saying_it_was_delivered_keeps_where_they_were()
    {
        var order = Confirmed(ByPhone());
        order.AssignRider("rider-1", "Ali");
        order.MarkOutForDelivery();
        order.MarkDelivered(latitude: 30.061, longitude: 31.241);
        Assert.AreEqual((30.061, 31.241), (order.Delivery!.DeliveredLatitude, order.Delivery.DeliveredLongitude));

        var half = Confirmed(ByPhone());
        half.AssignRider("rider-1", "Ali");
        half.MarkOutForDelivery();
        half.MarkDelivered(latitude: 30.061);
        Assert.IsNull(half.Delivery!.DeliveredLatitude, "both or neither");
    }

    [TestMethod]
    public void A_regulars_next_order_goes_to_the_door_the_rider_found_but_never_over_their_own_pin()
    {
        Assert.AreEqual((30.061, 31.241), DeliveryBoardQueries.FoundDoor(30.061, 31.241, DeliveryPinSource.Search));
        Assert.AreEqual((30.061, 31.241), DeliveryBoardQueries.FoundDoor(30.061, 31.241, DeliveryPinSource.None));
        Assert.IsNull(DeliveryBoardQueries.FoundDoor(30.061, 31.241, DeliveryPinSource.Customer));
        Assert.IsNull(DeliveryBoardQueries.FoundDoor(null, null, DeliveryPinSource.Search));
    }
}
