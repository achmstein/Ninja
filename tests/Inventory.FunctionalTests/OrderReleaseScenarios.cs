using System.Net;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Ninja.IntegrationEventLogEF;
using Ninja.Inventory.API.Application.IntegrationEvents.EventHandling;
using Ninja.Inventory.API.Application.IntegrationEvents.Events;
using Ninja.Inventory.Infrastructure;
using Ninja.Testing;

namespace Ninja.Inventory.FunctionalTests;

public record UsageRowView(int StockItemId, decimal Sold, decimal SoldValue, decimal Wasted, decimal WastedValue, decimal CountVariance = 0);
public record UsageView(List<UsageRowView> Rows);
public record VarianceRowView(int StockItemId, decimal Opening, decimal OpeningValue, decimal Theoretical, decimal Closing, decimal ClosingValue, bool ValuedAtCurrentAverage);
public record VarianceView(List<VarianceRowView> Rows);

/// <summary>
/// A confirmed order that will never be sold gives its sale back: food never
/// made goes back on the shelf, food made is written off as waste (the shelf
/// as it was, the cost moved from sold to wasted). Once per order, through
/// the handlers the bus would call.
/// </summary>
[TestClass]
public sealed class OrderReleaseScenarios
{
    private const string Inventory = "/api/inventory";
    private const string Version = "api-version=1.0";
    private static int _orders = Random.Shared.Next(1_000_000, 2_000_000);

    private static Caller BackOffice => Suite.Inventory.As(Persona.Admin(Suite.Branch), Suite.Branch);
    private static string Url(string tail = "") => $"{Inventory}{tail}?{Version}";

    /// <summary>Beans on the shelf at 300 a kilo, and a menu item that takes 20 g a cup.</summary>
    private static async Task<(int Beans, int MenuItem)> ACupOfCoffeeAsync()
    {
        var beans = (await BackOffice.PostAsync<CreatedView>(Url("/items"), new
        {
            name = new { en = $"Beans {Guid.NewGuid():N}"[..20], ar = "بن" },
            unit = "kg",
            autoSoldOut = false,
        })).Id;
        await BackOffice.PostAsync<CreatedView>(Url("/purchases"), new
        {
            supplier = "The roastery",
            lines = new[] { new { stockItemId = beans, quantity = 10m, unitCost = 300m } },
        });
        var menuItem = Random.Shared.Next(100_000, 900_000);
        var (saved, detail) = await BackOffice.RefusedAsync(HttpMethod.Put, Url($"/recipes/{menuItem}"), new
        {
            lines = new[] { new { stockItemId = beans, quantity = 0.02m } },
        });
        Assert.AreEqual(HttpStatusCode.OK, saved, detail);
        return (beans, menuItem);
    }

    private static async Task<int> SellAsync(int menuItem, int units, DateTime? placedAt = null)
    {
        var orderId = Interlocked.Increment(ref _orders);
        using var scope = Suite.Inventory.Services.CreateScope();
        var handler = ActivatorUtilities.CreateInstance<OrderStatusChangedToConfirmedIntegrationEventHandler>(scope.ServiceProvider);
        await handler.Handle(new OrderStatusChangedToConfirmedIntegrationEvent
        {
            OrderId = orderId,
            BranchId = Suite.Branch,
            Items = [new OrderConfirmedItem { ProductId = menuItem, Units = units }],
            PlacedAt = placedAt,
        });
        return orderId;
    }

    private static async Task ReleaseAsync(int orderId, string disposition)
    {
        using var scope = Suite.Inventory.Services.CreateScope();
        var handler = ActivatorUtilities.CreateInstance<OrderStockReleasedIntegrationEventHandler>(scope.ServiceProvider);
        await handler.Handle(new OrderStockReleasedIntegrationEvent(orderId, Suite.Branch, disposition, "Cancelled"));
    }

    private static async Task<decimal> OnHandAsync(int stockItemId)
    {
        var levels = await BackOffice.GetAsync<List<LevelView>>(Url("/levels"));
        return levels.Single(l => l.StockItemId == stockItemId).OnHand;
    }

    private static async Task<List<MovementView>> LedgerAsync(int stockItemId) =>
        (await BackOffice.GetAsync<PageView<MovementView>>($"{Inventory}/movements?stockItemId={stockItemId}&{Version}")).Items;

    private static async Task<UsageRowView> UsageAsync(int stockItemId)
        => (await UsageRowAsync(stockItemId, DateTime.UtcNow.AddHours(-1), DateTime.UtcNow.AddHours(1)))!;

    private static string Window(DateTime from, DateTime to)
        => $"from={Uri.EscapeDataString(from.ToString("O"))}&to={Uri.EscapeDataString(to.ToString("O"))}&{Version}";

    /// <summary>The item's row of the usage report over a window; null when nothing of it happened then.</summary>
    private static async Task<UsageRowView?> UsageRowAsync(int stockItemId, DateTime from, DateTime to)
    {
        var report = await BackOffice.GetAsync<UsageView>($"{Inventory}/reports/usage?{Window(from, to)}");
        return report.Rows.SingleOrDefault(r => r.StockItemId == stockItemId);
    }

    private static async Task<VarianceRowView?> VarianceRowAsync(int stockItemId, DateTime from, DateTime to)
    {
        var report = await BackOffice.GetAsync<VarianceView>($"{Inventory}/reports/variance?{Window(from, to)}");
        return report.Rows.SingleOrDefault(r => r.StockItemId == stockItemId);
    }

    /// <summary>The cost each posting of the order told Finance, by kind.</summary>
    private static Task<List<string>> ConsumedAsync(int orderId) => ConsumedAsync($"order:{orderId}");

    /// <summary>The cost the postings under a reference told Finance, as the JSON that went out.</summary>
    private static async Task<List<string>> ConsumedAsync(string reference)
    {
        using var scope = Suite.Inventory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<InventoryContext>();
        var entries = await context.Set<IntegrationEventLogEntry>()
            .Where(e => e.EventTypeName.Contains(nameof(StockConsumedIntegrationEvent)) && e.Content.Contains(reference))
            .Select(e => e.Content)
            .ToListAsync();
        return entries;
    }

    private static StockConsumedIntegrationEvent Read(string content)
        => System.Text.Json.JsonSerializer.Deserialize<StockConsumedIntegrationEvent>(content)!;

    // Postgres keeps microseconds, .NET ticks
    private static void AssertSameMoment(DateTime expected, DateTime actual, string because)
        => Assert.IsLessThan(TimeSpan.FromMilliseconds(1), (expected.ToUniversalTime() - actual.ToUniversalTime()).Duration(), because);

    [TestMethod]
    public async Task Food_never_made_goes_back_on_the_shelf_once()
    {
        var (beans, menuItem) = await ACupOfCoffeeAsync();
        var order = await SellAsync(menuItem, units: 2);
        Assert.AreEqual(9.96m, await OnHandAsync(beans), "two cups took forty grams");

        await ReleaseAsync(order, "Restock");
        await ReleaseAsync(order, "Restock");

        Assert.AreEqual(10m, await OnHandAsync(beans), "back on the shelf, once");
        var reversal = (await LedgerAsync(beans)).Single(m => m.Type == "SaleReversal");
        Assert.AreEqual(0.04m, reversal.Quantity);

        var usage = await UsageAsync(beans);
        Assert.AreEqual(0m, usage.Sold, "a sale given back was never sold");
        Assert.AreEqual(0m, usage.SoldValue);
        Assert.AreEqual(0m, usage.Wasted);

        var consumed = await ConsumedAsync(order);
        Assert.HasCount(2, consumed, "the sale's cost, then the same given back");
        Assert.IsTrue(consumed.Any(c => c.Contains("SaleReversal") && c.Contains("12")), string.Join("\n", consumed));
    }

    [TestMethod]
    public async Task Food_made_and_never_sold_is_waste_and_the_shelf_stays_as_it_is()
    {
        var (beans, menuItem) = await ACupOfCoffeeAsync();
        var order = await SellAsync(menuItem, units: 2);

        await ReleaseAsync(order, "Waste");
        await ReleaseAsync(order, "Restock");

        Assert.AreEqual(9.96m, await OnHandAsync(beans), "the beans are in the bin, not on the shelf");
        var ledger = await LedgerAsync(beans);
        Assert.AreEqual(0.04m, ledger.Single(m => m.Type == "SaleReversal").Quantity);
        Assert.AreEqual(-0.04m, ledger.Single(m => m.Type == "Waste").Quantity);

        var usage = await UsageAsync(beans);
        Assert.AreEqual(0m, usage.Sold);
        Assert.AreEqual(0.04m, usage.Wasted);
        Assert.AreEqual(12m, usage.WastedValue, "forty grams of three-hundred-pound beans");

        var consumed = await ConsumedAsync(order);
        Assert.HasCount(3, consumed, "the sale, its reversal, and the waste");
        Assert.IsTrue(consumed.Any(c => c.Contains("\"Waste\"")), string.Join("\n", consumed));
    }

    [TestMethod]
    public async Task An_order_that_took_nothing_gives_nothing_back()
    {
        var order = await SellAsync(menuItem: 999_999_999, units: 1);

        await ReleaseAsync(order, "Waste");

        Assert.IsEmpty(await ConsumedAsync(order));
    }

    [TestMethod]
    public async Task A_sale_an_offline_till_sent_late_is_in_the_period_it_was_rung_up_in()
    {
        var (beans, menuItem) = await ACupOfCoffeeAsync();
        var rungUp = DateTime.UtcNow.AddDays(-3);

        await SellAsync(menuItem, units: 2, placedAt: rungUp);

        var then = await UsageRowAsync(beans, rungUp.AddHours(-1), rungUp.AddHours(1));
        Assert.IsNotNull(then, "the sale is in the hour it was rung up");
        Assert.AreEqual(0.04m, then.Sold);
        Assert.AreEqual(12m, then.SoldValue);
        Assert.AreEqual(0m, (await UsageAsync(beans)).Sold, "and not in the hour it reached the storeroom");

        var variance = await VarianceRowAsync(beans, rungUp.AddHours(-1), rungUp.AddHours(1));
        Assert.AreEqual(0.04m, variance!.Theoretical, "the recipes' usage is the day's it was sold on");

        var sale = (await LedgerAsync(beans)).Single(m => m.Type == "Sale");
        AssertSameMoment(rungUp, sale.OccurredAt!.Value, "the ledger says when it happened");
        Assert.IsGreaterThan(rungUp.AddDays(2), sale.RecordedAt!.Value, "beside when it was posted");
    }

    [TestMethod]
    public async Task An_order_called_off_after_a_months_end_gives_its_sale_back_in_the_sales_month()
    {
        var (beans, menuItem) = await ACupOfCoffeeAsync();
        // Rung up on the last evening of March, called off now
        var soldAt = new DateTime(2026, 3, 31, 20, 0, 0, DateTimeKind.Utc);
        var order = await SellAsync(menuItem, units: 2, placedAt: soldAt);

        await ReleaseAsync(order, "Waste");

        var march = await UsageRowAsync(beans, new DateTime(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc), new DateTime(2026, 4, 1, 0, 0, 0, DateTimeKind.Utc));
        Assert.AreEqual(0m, march!.Sold, "March sold nothing: its sale was given back in March");
        Assert.AreEqual(0m, march.Wasted);
        Assert.AreEqual(0.04m, (await UsageAsync(beans)).Wasted, "the food went in the bin today");

        var consumed = (await ConsumedAsync(order)).Select(Read).ToList();
        var sale = consumed.Single(c => c.Kind == "Sale");
        var reversal = consumed.Single(c => c.Kind == "SaleReversal");
        var waste = consumed.Single(c => c.Kind == "Waste");
        Assert.AreEqual(soldAt, sale.At);
        Assert.AreEqual(soldAt, reversal.At, "Finance takes the cost back out of March's goods");
        Assert.AreEqual(12m, reversal.Cost);
        Assert.IsGreaterThan(soldAt.AddDays(30), waste.At, "and books the waste today");
    }

    [TestMethod]
    public async Task Stock_a_count_finds_missing_is_a_cost_and_a_sale_sent_after_the_count_takes_it_back()
    {
        var (beans, menuItem) = await ACupOfCoffeeAsync();
        var soldOffline = DateTime.UtcNow.AddHours(-2);

        // Two cups sold offline two hours ago; the count now finds the forty
        // grams gone and, not knowing of the sale, books them as missing
        var count = await BackOffice.PostAsync<CreatedView>(Url("/counts"), new
        {
            note = "Closing count",
            lines = new[] { new { stockItemId = beans, counted = 9.96m } },
        });
        var shortfall = (await ConsumedAsync($"\"count:{count.Id}\"")).Select(Read).Single();
        Assert.AreEqual("Shrinkage", shortfall.Kind, "stock gone without a sale is a cost all the same");
        Assert.AreEqual(12m, shortfall.Cost, "forty grams at three hundred a kilo");

        // Then the till's sale arrives
        var order = await SellAsync(menuItem, units: 2, placedAt: soldOffline);

        Assert.AreEqual(9.96m, await OnHandAsync(beans), "the shelf stays as the count found it");
        var consumed = (await ConsumedAsync(order)).Select(Read).ToList();
        Assert.AreEqual(12m, consumed.Single(c => c.Kind == "Sale").Cost, "the sale costs its goods, on its own day");
        AssertSameMoment(soldOffline, consumed.Single(c => c.Kind == "Sale").At, "dated when the cups were sold");
        var found = consumed.Single(c => c.Kind == "ShrinkageFound");
        Assert.AreEqual(12m, found.Cost, "and what the count took for missing was sold");

        var usage = await UsageRowAsync(beans, soldOffline.AddHours(-1), DateTime.UtcNow.AddHours(1));
        Assert.AreEqual(0.04m, usage!.Sold);
        Assert.AreEqual(0m, usage.CountVariance, "the count's shortfall and its correction cancel out");
    }

    [TestMethod]
    public async Task Opening_and_closing_stock_are_valued_at_the_average_as_it_stood_then()
    {
        var (beans, _) = await ACupOfCoffeeAsync();
        await Task.Delay(50);
        var between = DateTime.UtcNow;
        await Task.Delay(50);

        // A dearer delivery since: ten more kilos at 500, the average now 400
        await BackOffice.PostAsync<CreatedView>(Url("/purchases"), new
        {
            supplier = "The roastery",
            lines = new[] { new { stockItemId = beans, quantity = 10m, unitCost = 500m } },
        });

        var row = await VarianceRowAsync(beans, between, DateTime.UtcNow.AddHours(1));
        Assert.AreEqual(10m, row!.Opening);
        Assert.AreEqual(3000m, row.OpeningValue, "the ten kilos were worth 300 a kilo then, not today's 400");
        Assert.AreEqual(20m, row.Closing);
        Assert.AreEqual(8000m, row.ClosingValue);
        Assert.IsFalse(row.ValuedAtCurrentAverage);
    }
}
