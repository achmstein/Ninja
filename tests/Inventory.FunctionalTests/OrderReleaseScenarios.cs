using System.Net;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Ninja.IntegrationEventLogEF;
using Ninja.Inventory.API.Application.IntegrationEvents.EventHandling;
using Ninja.Inventory.API.Application.IntegrationEvents.Events;
using Ninja.Inventory.Infrastructure;
using Ninja.Testing;

namespace Ninja.Inventory.FunctionalTests;

public record UsageRowView(int StockItemId, decimal Sold, decimal SoldValue, decimal Wasted, decimal WastedValue);
public record UsageView(List<UsageRowView> Rows);

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

    private static async Task<int> SellAsync(int menuItem, int units)
    {
        var orderId = Interlocked.Increment(ref _orders);
        using var scope = Suite.Inventory.Services.CreateScope();
        var handler = ActivatorUtilities.CreateInstance<OrderStatusChangedToConfirmedIntegrationEventHandler>(scope.ServiceProvider);
        await handler.Handle(new OrderStatusChangedToConfirmedIntegrationEvent
        {
            OrderId = orderId,
            BranchId = Suite.Branch,
            Items = [new OrderConfirmedItem { ProductId = menuItem, Units = units }],
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
    {
        var from = DateTime.UtcNow.AddHours(-1).ToString("O");
        var to = DateTime.UtcNow.AddHours(1).ToString("O");
        var report = await BackOffice.GetAsync<UsageView>(
            $"{Inventory}/reports/usage?from={Uri.EscapeDataString(from)}&to={Uri.EscapeDataString(to)}&{Version}");
        return report.Rows.Single(r => r.StockItemId == stockItemId);
    }

    /// <summary>The cost each posting of the order told Finance, by kind.</summary>
    private static async Task<List<string>> ConsumedAsync(int orderId)
    {
        using var scope = Suite.Inventory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<InventoryContext>();
        var entries = await context.Set<IntegrationEventLogEntry>()
            .Where(e => e.EventTypeName.Contains(nameof(StockConsumedIntegrationEvent)) && e.Content.Contains($"order:{orderId}"))
            .Select(e => e.Content)
            .ToListAsync();
        return entries;
    }

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
}
