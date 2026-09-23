namespace Ninja.Ordering.UnitTests.Domain;

using System.Reflection;
using Ninja.Ordering.Domain.AggregatesModel.KitchenAggregate;
using Ninja.Ordering.Domain.AggregatesModel.OrderAggregate;
using Ninja.Ordering.Domain.Seedwork;

/// <summary>
/// Kitchen stations: an order's lines split by the category each product
/// sits in, one part per station, and the order ready once every part on a
/// screen is — a part that only prints never counts.
/// </summary>
[TestClass]
public class KitchenStationsTest
{
    private const int Food = 10;
    private const int Drinks = 20;
    private const int Shisha = 30;

    private const int Burger = 1;
    private const int Lemonade = 2;
    private const int Mint = 3;

    private static KitchenStation Station(int id, string name, int[] categories, bool screen, bool printer, bool isDefault = false)
    {
        var station = new KitchenStation(1, new LocalizedText(name), categories, screen, printer,
            printer ? "192.168.1.50" : null, null, isDefault, id);
        typeof(Entity).GetProperty(nameof(Entity.Id))!.SetValue(station, id);
        return station;
    }

    // The food tablet is the default; the bar has its own screen; shisha only prints
    private static KitchenRouting Routing() => new([
        Station(100, "Kitchen", [Food], screen: true, printer: false, isDefault: true),
        Station(200, "Bar", [Drinks], screen: true, printer: false),
        Station(300, "Shisha", [Shisha], screen: false, printer: true),
    ]);

    private static Order Confirmed(params int[] products)
    {
        var order = new Order("userId", "userName", 1);
        foreach (var product in products)
        {
            order.AddOrderItem(product, new LocalizedText($"Product {product}"), 10, 0, null);
        }
        order.SetStockConfirmedStatus(categories: new Dictionary<int, int> { [Burger] = Food, [Lemonade] = Drinks, [Mint] = Shisha });
        order.SetConfirmedStatus(Routing());
        return order;
    }

    [TestMethod]
    public void Lines_go_to_the_station_that_makes_their_category()
    {
        var order = Confirmed(Burger, Lemonade, Mint);

        Assert.AreEqual(100, order.OrderItems.Single(i => i.ProductId == Burger).StationId);
        Assert.AreEqual(200, order.OrderItems.Single(i => i.ProductId == Lemonade).StationId);
        Assert.AreEqual(300, order.OrderItems.Single(i => i.ProductId == Mint).StationId);
        CollectionAssert.AreEquivalent(new[] { 100, 200, 300 }, order.StationParts.Select(p => p.StationId).ToArray());
    }

    [TestMethod]
    public void A_line_no_station_claims_goes_to_the_default_station()
    {
        var order = new Order("userId", "userName", 1);
        order.AddOrderItem(99, new LocalizedText("Unlisted"), 10, 0, null);
        order.SetStockConfirmedStatus(categories: new Dictionary<int, int> { [99] = 777 });
        order.SetConfirmedStatus(Routing());

        Assert.AreEqual(100, order.OrderItems.Single().StationId);
    }

    [TestMethod]
    public void A_line_without_a_category_goes_to_the_default_station()
    {
        // Catalog answered before it sent categories
        var order = new Order("userId", "userName", 1);
        order.AddOrderItem(Lemonade, new LocalizedText("Lemonade"), 10, 0, null);
        order.SetStockConfirmedStatus();
        order.SetConfirmedStatus(Routing());

        Assert.AreEqual(100, order.OrderItems.Single().StationId);
    }

    [TestMethod]
    public void The_order_is_ready_only_when_every_screen_part_is()
    {
        var order = Confirmed(Burger, Lemonade);

        order.SetStationReady(200, true);
        Assert.IsFalse(order.IsReady);
        Assert.IsFalse(order.DomainEvents.OfType<OrderReadyChangedDomainEvent>().Any());

        order.SetStationReady(100, true);
        Assert.IsTrue(order.IsReady);
        Assert.IsTrue(order.DomainEvents.OfType<OrderReadyChangedDomainEvent>().Single().IsReady);
    }

    [TestMethod]
    public void A_printed_part_does_not_hold_the_order_back()
    {
        // Food on the tablet, shisha on the printer: the tablet decides
        var order = Confirmed(Burger, Mint);

        order.SetStationReady(100, true);

        Assert.IsTrue(order.IsReady);
    }

    [TestMethod]
    public void An_order_made_only_at_printers_is_never_ready()
    {
        var order = Confirmed(Mint);

        Assert.ThrowsExactly<OrderingDomainException>(() => order.SetReady(true));
        Assert.ThrowsExactly<OrderingDomainException>(() => order.SetStationReady(300, true));
        Assert.IsFalse(order.IsReady);
    }

    [TestMethod]
    public void Bringing_a_part_back_takes_the_order_back()
    {
        var order = Confirmed(Burger, Lemonade);
        order.SetStationReady(100, true);
        order.SetStationReady(200, true);

        order.SetStationReady(200, false);

        Assert.IsFalse(order.IsReady);
        Assert.IsTrue(order.StationParts.Single(p => p.StationId == 100).IsReady);
        Assert.IsFalse(order.DomainEvents.OfType<OrderReadyChangedDomainEvent>().Last().IsReady);
    }

    [TestMethod]
    public void The_pass_readies_every_screen_part_at_once()
    {
        var order = Confirmed(Burger, Lemonade, Mint);

        order.SetReady(true);

        Assert.IsTrue(order.IsReady);
        Assert.IsTrue(order.StationParts.Where(p => p.ShowsOnScreen).All(p => p.IsReady));
        Assert.IsNull(order.StationParts.Single(p => p.StationId == 300).ReadyAt);
    }

    [TestMethod]
    public void A_part_at_a_station_the_order_does_not_use_is_refused()
    {
        var order = Confirmed(Burger);

        Assert.ThrowsExactly<OrderingDomainException>(() => order.SetStationReady(200, true));
    }

    [TestMethod]
    public void Parts_that_print_ask_for_their_tickets()
    {
        var order = Confirmed(Burger, Mint);

        var sent = order.DomainEvents.OfType<OrderSentToKitchenPrintersDomainEvent>().Single();
        CollectionAssert.AreEqual(new[] { 300 }, sent.StationIds.ToArray());
    }

    [TestMethod]
    public void An_order_with_nothing_to_print_asks_for_no_ticket()
    {
        var order = Confirmed(Burger, Lemonade);

        Assert.IsFalse(order.DomainEvents.OfType<OrderSentToKitchenPrintersDomainEvent>().Any());
    }

    [TestMethod]
    public void A_part_keeps_the_station_as_it_was_when_the_order_arrived()
    {
        var bar = Station(200, "Bar", [Drinks], screen: true, printer: false);
        var routing = new KitchenRouting([Station(100, "Kitchen", [], true, false, isDefault: true), bar]);
        var order = new Order("userId", "userName", 1);
        order.AddOrderItem(Lemonade, new LocalizedText("Lemonade"), 10, 0, null);
        order.SetStockConfirmedStatus(categories: new Dictionary<int, int> { [Lemonade] = Drinks });
        order.SetConfirmedStatus(routing);

        bar.Update(new LocalizedText("Juice bar"), [Drinks], showsOnScreen: false, printsTickets: true, "10.0.0.9", null, 0);

        var part = order.StationParts.Single();
        Assert.AreEqual("Bar", part.StationName.En);
        Assert.IsTrue(part.ShowsOnScreen);
    }

    [TestMethod]
    public void A_station_must_show_or_print()
    {
        Assert.ThrowsExactly<OrderingDomainException>(() =>
            new KitchenStation(1, new LocalizedText("Nowhere"), [], false, false, null, null, false, 0));
    }

    [TestMethod]
    public void A_station_that_prints_needs_its_printer()
    {
        Assert.ThrowsExactly<OrderingDomainException>(() =>
            new KitchenStation(1, new LocalizedText("Shisha"), [], false, true, " ", null, false, 0));
    }

    [TestMethod]
    public void A_category_another_station_makes_is_taken()
    {
        var stations = new[]
        {
            Station(100, "Kitchen", [Food], true, false, isDefault: true),
            Station(200, "Bar", [Drinks], true, false),
        };

        CollectionAssert.AreEqual(new[] { Food }, KitchenRouting.TakenCategories(stations, 200, [Drinks, Food]).ToArray());
        Assert.AreEqual(0, KitchenRouting.TakenCategories(stations, 200, [Drinks, Shisha]).Count);
        CollectionAssert.AreEqual(new[] { Drinks }, KitchenRouting.TakenCategories(stations, null, [Drinks]).ToArray());
    }

    [TestMethod]
    public void A_failed_print_lets_any_device_try_again()
    {
        var job = KitchenPrintJob.ForOrder(1, 5, 300);

        job.MarkFailed("Connection refused");

        Assert.AreEqual(1, job.Attempts);
        Assert.AreEqual("Connection refused", job.LastError);
        Assert.IsNull(job.ClaimedBy);
        Assert.IsFalse(job.IsPrinted);
    }

    [TestMethod]
    public void A_printed_ticket_ignores_a_late_failure()
    {
        var job = KitchenPrintJob.ForOrder(1, 5, 300);
        job.MarkPrinted();

        job.MarkFailed("timeout");

        Assert.IsTrue(job.IsPrinted);
        Assert.AreEqual(0, job.Attempts);
    }
}
