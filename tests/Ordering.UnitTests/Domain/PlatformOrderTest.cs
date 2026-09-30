namespace Ninja.Ordering.UnitTests.Domain;

using Ninja.Ordering.Domain.AggregatesModel.OrderAggregate;

[TestClass]
public class PlatformOrderTest
{
    private static PlatformOrder Talabat(PlatformExpedition expedition = PlatformExpedition.PlatformDelivery, string? address = "Tahrir St")
        => new("Talabat", "tok-1", "n0s1", "42", expedition, DateTime.UtcNow.AddMinutes(20), null, address, paidOnline: true, collectFromCustomer: 50,
            "https://mw/accept", "https://mw/reject", "https://mw/prepared", null);

    private static Order NewOrder(PlatformOrder? platform = null)
        => new(string.Empty, string.Empty, 1, guestName: "Mona Adel", guestPhone: null, source: OrderSource.Talabat, platform: platform ?? Talabat());

    [TestMethod]
    public void A_talabat_order_needs_no_account_table_or_phone()
    {
        var order = NewOrder();

        Assert.AreEqual(OrderSource.Talabat, order.Source);
        Assert.AreEqual("Mona Adel", order.GuestName);
        Assert.IsNull(order.GuestId);
        Assert.IsFalse(order.HasDestination);
        Assert.AreEqual("n0s1", order.Platform!.Code);
    }

    [TestMethod]
    public void A_talabat_order_without_talabats_details_is_refused()
    {
        Assert.ThrowsExactly<OrderingDomainException>(() =>
            new Order(string.Empty, string.Empty, 1, source: OrderSource.Talabat));
    }

    [TestMethod]
    public void Only_the_business_own_rider_keeps_an_address_and_paid_online_collects_nothing()
    {
        Assert.IsNull(Talabat(PlatformExpedition.PlatformDelivery).DeliveryAddress);
        Assert.AreEqual("Tahrir St", Talabat(PlatformExpedition.VendorDelivery).DeliveryAddress);
        Assert.IsNull(Talabat().CollectFromCustomer);
    }

    [TestMethod]
    public void Staff_turning_it_down_says_why_too_busy_unless_told()
    {
        var order = NewOrder();
        order.SetValidatedStatus();

        order.SetCancelledStatus();

        Assert.AreEqual(OrderStatus.Cancelled, order.OrderStatus);
        Assert.AreEqual(PlatformRejectReasons.TooBusy, order.Platform!.RejectReason);
    }

    [TestMethod]
    public void Sold_out_items_turn_it_down_as_unavailable()
    {
        var order = NewOrder();

        order.SetValidationFailedStatus([new ValidationFailure(12, ValidationFailure.Unavailable)]);

        Assert.AreEqual(PlatformRejectReasons.ItemUnavailable, order.Platform!.RejectReason);
    }

    [TestMethod]
    public void The_platform_cancelling_a_waiting_order_cancels_it_once()
    {
        var order = NewOrder();
        order.SetValidatedStatus();
        order.ClearDomainEvents();

        order.CancelByPlatform(DateTime.UtcNow);
        order.CancelByPlatform(DateTime.UtcNow);

        Assert.AreEqual(OrderStatus.Cancelled, order.OrderStatus);
        Assert.IsNotNull(order.Platform!.CancelledAt);
        Assert.IsNull(order.Platform.RejectReason, "nothing to report back");
        Assert.AreEqual(1, order.DomainEvents.OfType<OrderCancelledDomainEvent>().Count());
    }

    [TestMethod]
    public void The_platform_cancelling_an_accepted_order_leaves_it_in_the_kitchen_recorded()
    {
        var order = NewOrder();
        order.SetValidatedStatus();
        order.SetConfirmedStatus();

        order.CancelByPlatform(DateTime.UtcNow);

        Assert.AreEqual(OrderStatus.Confirmed, order.OrderStatus);
        Assert.IsNotNull(order.Platform!.CancelledAt);
    }

    [TestMethod]
    public void Only_a_platform_order_is_cancelled_or_picked_up_by_the_platform()
    {
        var own = new Order("user-1", "Ali", 1);

        Assert.ThrowsExactly<OrderingDomainException>(() => own.CancelByPlatform(DateTime.UtcNow));
        Assert.ThrowsExactly<OrderingDomainException>(() => own.MarkPickedUpByPlatform(DateTime.UtcNow));
    }
}
