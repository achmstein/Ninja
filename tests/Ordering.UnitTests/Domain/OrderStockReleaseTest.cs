namespace Ninja.Ordering.UnitTests.Domain;

using Ninja.Ordering.Domain.AggregatesModel.OrderAggregate;

/// <summary>
/// A confirmed order that will never be sold lets its stock go once: as waste
/// when the food was made, back to the shelf when it was not, or as the
/// cashier said; an order never confirmed took nothing and lets nothing go.
/// </summary>
[TestClass]
public class OrderStockReleaseTest
{
    private static Order Counter(bool confirmed = true)
    {
        var order = new Order("user-1", "Ali", 1);
        order.AddOrderItem(1, new() { En = "Latte" }, 50, 0, null, units: 2);
        order.SetValidatedStatus();
        if (confirmed)
        {
            order.SetConfirmedStatus();
        }
        order.ClearDomainEvents();
        return order;
    }

    private static Order DeliveryOut()
    {
        var order = new Order(string.Empty, string.Empty, 1, guestId: "device-1", guestName: "Mona", guestPhone: "01001234567",
            delivery: new Delivery(30.0444, 31.2357, "Tahrir St", "12", null, null, "Blue gate", "01001234567", 20, 1800));
        order.AddOrderItem(1, new() { En = "Latte" }, 50, 0, null, units: 2);
        order.SetValidatedStatus();
        order.SetConfirmedStatus();
        order.AssignRider("rider-1", "Ali");
        order.MarkOutForDelivery();
        order.ClearDomainEvents();
        return order;
    }

    private static Order Talabat()
    {
        var platform = new PlatformOrder("Talabat", "tok-1", "n0s1", "42", PlatformExpedition.PlatformDelivery, DateTime.UtcNow.AddMinutes(20), null, null,
            paidOnline: true, collectFromCustomer: 50, "https://mw/accept", "https://mw/reject", "https://mw/prepared", null);
        var order = new Order(string.Empty, string.Empty, 1, guestName: "Mona Adel", guestPhone: null, source: OrderSource.Talabat, platform: platform);
        order.AddOrderItem(1, new() { En = "Latte" }, 50, 0, null, units: 1);
        order.SetValidatedStatus();
        order.SetConfirmedStatus();
        order.ClearDomainEvents();
        return order;
    }

    private static OrderStockReleasedDomainEvent[] Released(Order order) =>
        order.DomainEvents.OfType<OrderStockReleasedDomainEvent>().ToArray();

    [TestMethod]
    public void Food_is_prepared_once_the_kitchen_marks_it_ready_or_it_leaves()
    {
        var waiting = Counter();
        Assert.IsFalse(waiting.WasPrepared);

        waiting.SetReady(true);
        Assert.IsTrue(waiting.WasPrepared);

        Assert.IsTrue(DeliveryOut().WasPrepared, "out with the rider");

        var collected = Talabat();
        Assert.IsFalse(collected.WasPrepared);
        collected.MarkPickedUpByPlatform(DateTime.UtcNow);
        Assert.IsTrue(collected.WasPrepared, "the platform's rider took it");
    }

    [TestMethod]
    public void A_voided_bill_puts_unmade_food_back_and_writes_made_food_off()
    {
        var unmade = Counter();
        unmade.MarkVoided(DateTime.UtcNow);

        var made = Counter();
        made.SetReady(true);
        made.ClearDomainEvents();
        made.MarkVoided(DateTime.UtcNow);

        Assert.AreEqual(StockDisposition.Restock, Released(unmade).Single().Disposition);
        Assert.AreEqual(StockReleaseReason.Voided, Released(unmade).Single().Reason);
        Assert.AreEqual(StockDisposition.Waste, Released(made).Single().Disposition);
        Assert.AreEqual(StockDisposition.Waste, made.StockDisposition);
        Assert.IsNotNull(made.StockReleasedAt);
    }

    [TestMethod]
    public void What_the_cashier_says_goes_over_what_the_kitchen_did()
    {
        var made = Counter();
        made.SetReady(true);
        made.ClearDomainEvents();

        made.MarkVoided(DateTime.UtcNow, StockDisposition.Restock);

        Assert.AreEqual(StockDisposition.Restock, Released(made).Single().Disposition);
    }

    [TestMethod]
    public void An_order_never_confirmed_took_no_stock_and_lets_none_go()
    {
        var pending = Counter(confirmed: false);

        pending.SetCancelledStatus(stockDisposition: StockDisposition.Waste);

        Assert.AreEqual(OrderStatus.Cancelled, pending.OrderStatus);
        Assert.IsEmpty(Released(pending));
        Assert.IsNull(pending.StockReleasedAt);
    }

    [TestMethod]
    public void A_delivery_that_came_back_is_waste_unless_told_otherwise()
    {
        var failed = DeliveryOut();
        failed.MarkDeliveryFailed("Nobody answered");
        failed.SetCancelledStatus();

        var untouched = DeliveryOut();
        untouched.MarkDeliveryFailed("Wrong address");
        untouched.SetCancelledStatus(stockDisposition: StockDisposition.Restock);

        var released = Released(failed).Single();
        Assert.AreEqual(StockDisposition.Waste, released.Disposition);
        Assert.AreEqual(StockReleaseReason.Cancelled, released.Reason);
        Assert.AreEqual(failed.Id, released.OrderId);
        Assert.AreEqual(1, released.BranchId);
        Assert.AreEqual(StockDisposition.Restock, Released(untouched).Single().Disposition);
    }

    [TestMethod]
    public void A_cancelled_delivery_whose_bill_is_then_voided_lets_its_stock_go_once()
    {
        var order = DeliveryOut();
        order.MarkDeliveryFailed("Nobody answered");
        order.SetCancelledStatus(stockDisposition: StockDisposition.Restock);

        // Sales voids the delivery's bill; Ordering hears of it after
        order.MarkVoided(DateTime.UtcNow, StockDisposition.Waste);
        order.MarkVoided(DateTime.UtcNow);

        Assert.AreEqual(StockDisposition.Restock, Released(order).Single().Disposition);
        Assert.AreEqual(StockDisposition.Restock, order.StockDisposition);
    }

    [TestMethod]
    public void The_platform_cancelling_after_acceptance_releases_by_what_was_made()
    {
        var waiting = Talabat();
        waiting.CancelByPlatform(DateTime.UtcNow);
        waiting.CancelByPlatform(DateTime.UtcNow);

        var made = Talabat();
        made.SetReady(true);
        made.ClearDomainEvents();
        made.CancelByPlatform(DateTime.UtcNow);

        var released = Released(waiting).Single();
        Assert.AreEqual(StockReleaseReason.PlatformCancelled, released.Reason);
        Assert.AreEqual(StockDisposition.Restock, released.Disposition);
        Assert.AreEqual(StockDisposition.Waste, Released(made).Single().Disposition);
    }

    [TestMethod]
    public void The_platform_cancelling_before_acceptance_releases_nothing()
    {
        var platform = new PlatformOrder("Talabat", "tok-1", "n0s1", "42", PlatformExpedition.PlatformDelivery, DateTime.UtcNow.AddMinutes(20), null, null,
            paidOnline: true, collectFromCustomer: 50, "https://mw/accept", "https://mw/reject", "https://mw/prepared", null);
        var order = new Order(string.Empty, string.Empty, 1, guestName: "Mona", guestPhone: null, source: OrderSource.Talabat, platform: platform);
        order.SetValidatedStatus();

        order.CancelByPlatform(DateTime.UtcNow);

        Assert.AreEqual(OrderStatus.Cancelled, order.OrderStatus);
        Assert.IsEmpty(Released(order));
    }
}
