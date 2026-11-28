namespace Ninja.Ordering.UnitTests.Domain;

using Ninja.Ordering.Domain.AggregatesModel.OrderAggregate;

/// <summary>
/// Items of an order the kitchen already has, cancelled at the till: each is
/// found by what it was (the catalog item and its options, or its name when
/// the bill's line did not say the item), struck for as many as asked across
/// lines alike, never more than is left; the stock they took goes as the till
/// said, else as the kitchen left it, and only when it is this cancel's to move.
/// </summary>
[TestClass]
public class OrderItemCancelTest
{
    private static readonly LocalizedText Latte = new() { En = "Latte" };
    private static readonly LocalizedText Oat = new() { En = "Oat milk" };
    private static readonly Guid Key = Guid.Parse("11111111-2222-3333-4444-555555555555");

    private static Order Confirmed(Action<Order> items, bool confirmed = true)
    {
        var order = new Order("user-1", "Ali", 1);
        items(order);
        order.SetValidatedStatus();
        if (confirmed)
        {
            order.SetConfirmedStatus();
        }
        order.ClearDomainEvents();
        return order;
    }

    private static Order Lattes(int units = 3, bool confirmed = true) =>
        Confirmed(o => o.AddOrderItem(1, Latte, 50, 0, null, units: units), confirmed);

    private static OrderItemsCancelledDomainEvent Cancelled(Order order) =>
        order.DomainEvents!.OfType<OrderItemsCancelledDomainEvent>().Single();

    [TestMethod]
    public void An_item_cancel_strikes_units_and_keeps_why_and_when()
    {
        var item = new OrderItem(1, Latte, 50, 0, null, units: 3);
        var at = new DateTime(2026, 11, 28, 12, 0, 0, DateTimeKind.Utc);

        Assert.AreEqual(2, item.Cancel(2, "  Changed their mind ", at));
        Assert.AreEqual(3, item.Units, "the line stays as it was rung up");
        Assert.AreEqual(2, item.CancelledUnits);
        Assert.AreEqual(1, item.UnitsLeft);
        Assert.AreEqual("Changed their mind", item.CancelReason);
        Assert.AreEqual(at, item.CancelledAt);

        // Never more than is left, nothing for nothing, and a blank reason keeps the last one
        Assert.AreEqual(1, item.Cancel(5, " ", at.AddMinutes(1)));
        Assert.AreEqual(0, item.UnitsLeft);
        Assert.AreEqual("Changed their mind", item.CancelReason);
        Assert.AreEqual(0, item.Cancel(1, "Again", at.AddMinutes(2)));
        Assert.AreEqual(0, new OrderItem(1, Latte, 50, 0, null, units: 2).Cancel(-1, "No", at));
        Assert.AreEqual(at.AddMinutes(1), item.CancelledAt, "a cancel that took nothing changes nothing");
    }

    [TestMethod]
    public void The_item_is_found_by_its_product_and_options()
    {
        var order = Confirmed(o =>
        {
            o.AddOrderItem(1, Latte, 50, 0, null, units: 2);
            o.AddOrderItem(1, Latte, 55, 0, null, units: 2, customizationsDescription: Oat, optionIds: [7]);
            o.AddOrderItem(2, new() { En = "Tea" }, 20, 0, null, units: 1);
        });

        var struck = order.CancelItems([new ItemCancel(1, Latte, new LocalizedText("Oat milk", null), 1)], "Wrong milk", DateTime.UtcNow, null, Key);

        Assert.IsTrue(struck);
        var plain = order.OrderItems.Single(i => i.ProductId == 1 && i.CustomizationsDescription is null);
        var oat = order.OrderItems.Single(i => i.CustomizationsDescription == Oat);
        Assert.AreEqual(0, plain.CancelledUnits, "the latte without options is another thing");
        Assert.AreEqual(1, oat.CancelledUnits);

        var item = Cancelled(order).Items.Single();
        Assert.AreEqual(1, item.ProductId);
        Assert.AreEqual(Oat, item.CustomizationsDescription);
        Assert.AreEqual(1, item.Units);
        CollectionAssert.AreEqual(new[] { 7 }, item.OptionIds!.ToArray());
    }

    [TestMethod]
    public void Without_a_product_the_name_stands_in()
    {
        var order = Lattes(units: 2);

        Assert.IsTrue(order.CancelItems([new ItemCancel(null, new LocalizedText("Latte", null), null, 1)], "Cold", DateTime.UtcNow, null, Key));
        Assert.AreEqual(1, order.OrderItems.Single().CancelledUnits);

        Assert.IsFalse(order.CancelItems([new ItemCancel(null, new LocalizedText("Mocha", null), null, 1)], "Cold", DateTime.UtcNow, null, Key));
        Assert.IsFalse(order.CancelItems([new ItemCancel(null, Latte, Oat, 1)], "Cold", DateTime.UtcNow, null, Key),
            "the name with other options is another thing");
    }

    [TestMethod]
    public void A_cancel_spreads_across_lines_alike_and_stops_at_what_is_left()
    {
        // Lines with options are never folded together: two alike lines of 2 each
        var order = Confirmed(o =>
        {
            o.AddOrderItem(1, Latte, 55, 0, null, units: 2, customizationsDescription: Oat);
            o.AddOrderItem(1, Latte, 55, 0, null, units: 2, customizationsDescription: Oat);
        });
        var (first, second) = (order.OrderItems.First(), order.OrderItems.Last());

        order.CancelItems([new ItemCancel(1, Latte, Oat, 3)], "Left", DateTime.UtcNow, null, Key);

        Assert.AreEqual(2, first.CancelledUnits);
        Assert.AreEqual(1, second.CancelledUnits);
        CollectionAssert.AreEqual(new[] { 2, 1 }, Cancelled(order).Items.Select(i => i.Units).ToArray());

        // Five asked, one left: one struck
        order.ClearDomainEvents();
        Assert.IsTrue(order.CancelItems([new ItemCancel(1, Latte, Oat, 5)], "Left", DateTime.UtcNow, null, Key));
        Assert.AreEqual(2, second.CancelledUnits);
        Assert.AreEqual(1, Cancelled(order).Items.Single().Units);

        // Nothing left at all: nothing struck, nothing raised
        order.ClearDomainEvents();
        Assert.IsFalse(order.CancelItems([new ItemCancel(1, Latte, Oat, 1)], "Left", DateTime.UtcNow, null, Key));
        Assert.IsEmpty(order.DomainEvents!.OfType<OrderItemsCancelledDomainEvent>());
    }

    [TestMethod]
    public void Nothing_matched_raises_nothing()
    {
        var order = Lattes();

        Assert.IsFalse(order.CancelItems([new ItemCancel(9, new LocalizedText("Cake", null), null, 1)], "Cold", DateTime.UtcNow, null, Key));
        Assert.IsFalse(order.CancelItems([], "Cold", DateTime.UtcNow, null, Key));
        Assert.IsEmpty(order.DomainEvents?.OfType<OrderItemsCancelledDomainEvent>() ?? []);
        Assert.AreEqual(0, order.OrderItems.Single().CancelledUnits);
    }

    [TestMethod]
    public void The_event_carries_the_order_the_reason_and_the_key()
    {
        var order = Lattes();

        order.CancelItems([new ItemCancel(1, Latte, null, 1)], "Cold", DateTime.UtcNow, StockDisposition.Waste, Key);

        var cancelled = Cancelled(order);
        Assert.AreEqual(order.Id, cancelled.OrderId);
        Assert.AreEqual(1, cancelled.BranchId);
        Assert.AreEqual("Cold", cancelled.Reason);
        Assert.AreEqual(Key, cancelled.Key);
        Assert.AreEqual(Latte, cancelled.Items.Single().ProductName);
    }

    [TestMethod]
    public void Stock_goes_as_the_till_said_else_as_the_kitchen_left_it()
    {
        var unmade = Lattes();
        unmade.CancelItems([new ItemCancel(1, Latte, null, 1)], "Cold", DateTime.UtcNow, null, Key);
        Assert.AreEqual(StockDisposition.Restock, Cancelled(unmade).Disposition, "never made: back to the shelf");

        var made = Lattes();
        made.SetReady(true);
        made.ClearDomainEvents();
        made.CancelItems([new ItemCancel(1, Latte, null, 1)], "Cold", DateTime.UtcNow, null, Key);
        Assert.AreEqual(StockDisposition.Waste, Cancelled(made).Disposition, "marked ready: waste");

        var told = Lattes();
        told.SetReady(true);
        told.ClearDomainEvents();
        told.CancelItems([new ItemCancel(1, Latte, null, 1)], "Cold", DateTime.UtcNow, StockDisposition.Restock, Key);
        Assert.AreEqual(StockDisposition.Restock, Cancelled(told).Disposition, "what the cashier says goes");
    }

    [TestMethod]
    public void No_stock_moves_for_an_order_never_confirmed_or_already_released()
    {
        var pending = Lattes(confirmed: false);
        Assert.IsTrue(pending.CancelItems([new ItemCancel(1, Latte, null, 1)], "Cold", DateTime.UtcNow, StockDisposition.Waste, Key));
        Assert.IsNull(Cancelled(pending).Disposition, "its confirmation never took any");

        var released = Lattes();
        released.MarkVoided(DateTime.UtcNow);
        Assert.IsNotNull(released.StockReleasedAt);
        released.ClearDomainEvents();
        Assert.IsTrue(released.CancelItems([new ItemCancel(1, Latte, null, 1)], "Cold", DateTime.UtcNow, StockDisposition.Waste, Key));
        Assert.IsNull(Cancelled(released).Disposition, "the whole order's stock already went");
    }
}
