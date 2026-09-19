using Ninja.E2E.Actors;
using Ninja.E2E.Fixtures;
using Ninja.E2E.Harness;
using Ninja.E2E.Support;

namespace Ninja.E2E.Scenarios;

/// <summary>
/// Stock from purchase to sold out and back: a supplier delivery invoices
/// Finance, waste costs the P&amp;L and trips the low-stock warning, selling
/// the last unit sells the menu item out at the till through Catalog, a
/// further sale is rejected, a stock count brings it back, and the usage
/// report adds up. Uses its own menu item and ingredient so nothing else
/// on the menu is affected.
/// </summary>
public sealed class InventoryFlowScenario(NinjaApp app, DaySetup day) : ScenarioBase(app, day)
{
    private const int JuicesCategory = 5;
    private const decimal LemonadePrice = 20m;
    private const decimal LemonCost = 4m;

    [Fact]
    public async Task Purchase_waste_sell_out_reject_count_and_report()
    {
        var month = Money.Month(BusinessDay);
        var profitBefore = await Owner.ProfitAsync(month.Year, month.Month, Ct);
        var runStart = DateTime.UtcNow.AddMinutes(-1);

        // 1. A new menu item tracked one-to-one on a new ingredient that sells out automatically.
        var setup = Step("Create Lemonade, its lemons (auto sold-out, reorder at 2) and the recipe");
        var lemonadeName = $"E2E Lemonade {Day.RunId}";
        var lemonade = await Owner.CreateMenuItemAsync(lemonadeName, LemonadePrice, JuicesCategory, Ct);
        var lemons = await Owner.CreateStockItemAsync($"E2E Lemons {Day.RunId}", "pcs", autoSoldOut: true, Ct);
        await Owner.SetReorderLevelAsync(lemons, 2m, Ct);
        await Owner.SetRecipeAsync(lemonade.Id, [(lemons, 1m)], Ct);
        // Saved again, as the editor does: the replaced line must be gone, not left behind
        // with no recipe (an orphan used to break the next receipt's sold-out lookup)
        await Owner.SetRecipeAsync(lemonade.Id, [(lemons, 1m)], Ct);
        Assert.Single((await Owner.RecipeAsync(lemonade.Id, Ct)).Lines);
        await Menu.RefreshAsync(Ct);
        Assert.True(Menu.Item(lemonadeName).IsAvailable);
        Assert.False(Menu.Item(lemonadeName).IsOutOfStock);

        // 2. Three lemons arrive from the supplier: stock up, invoice on the supplier's account.
        var delivery = Step("Receive 3 lemons at 4.00 from the supplier");
        var invoiceRef = $"INV-{Day.RunId}";
        var purchaseId = await Owner.ReceivePurchaseAsync([(lemons, 3m, LemonCost)], Ct, supplierId: Day.SupplierId, invoiceRef: invoiceRef);
        var received = await ExpectEventAsync(delivery, "PurchaseReceived", e => e.Int("PurchaseId") == purchaseId);
        Assert.Equal(Day.SupplierId, received.Int("SupplierId"));
        Assert.Equal(3 * LemonCost, received.Dec("Total"));
        Assert.Equal(invoiceRef, received.Str("InvoiceRef"));
        await ExpectNoEventAsync(delivery, "CatalogItemStockChanged"); // the item was never out

        var level = await Owner.LevelAsync(lemons, Ct);
        Assert.Equal(3m, level.OnHand);
        Assert.Equal(LemonCost, level.AvgUnitCost);
        Assert.Equal(LemonCost, level.LastCost); // what the branch last paid, for the next receipt to compare against
        Assert.False(level.IsLow);
        var history = await Owner.CostHistoryAsync(lemons, Ct);
        var receipt = Assert.Single(history);
        Assert.Equal(purchaseId, receipt.PurchaseId);
        Assert.Equal(3m, receipt.Quantity);
        Assert.Equal(LemonCost, receipt.UnitCost);
        var recipeCost = Assert.Single(await Owner.RecipeCostsAsync(Ct), c => c.CatalogItemId == lemonade.Id);
        Assert.Equal(LemonCost, recipeCost.BaseCost); // one lemon per lemonade, at the branch's average
        Assert.Empty(recipeCost.Uncosted);
        await ExpectAsync("Finance put the invoice on the supplier's account", async () =>
        {
            var entry = Assert.Single((await Owner.SupplierLedgerAsync(Day.SupplierId, Ct)).Entries, x => x.Reference == $"purchase:{purchaseId}");
            Assert.Equal(Codes.SupplierEntry.Invoice, entry.Type);
            Assert.Equal(3 * LemonCost, entry.Amount);
            Assert.Equal(invoiceRef, entry.Note);
            Assert.Equal(Codes.FinanceSource.Purchase, entry.Source);
        });

        // 3. One lemon goes bad: waste is a cost, and stock is now at the reorder line.
        var waste = Step("Throw one bruised lemon away");
        await Owner.PostWasteAsync(lemons, 1m, "bruised", Ct);
        var wasted = await ExpectEventAsync(waste, "StockConsumed", e => e.Str("Kind") == "Waste" && e.Dec("Cost") == LemonCost);
        Assert.Equal(1, wasted.Int("BranchId"));
        var low = await ExpectEventAsync(waste, "StockLow", e => e.Int("StockItemId") == lemons);
        Assert.Equal(2m, low.Dec("OnHand"));
        Assert.Equal(2m, low.Dec("ReorderLevel"));
        level = await Owner.LevelAsync(lemons, Ct);
        Assert.Equal(2m, level.OnHand);
        Assert.True(level.IsLow);
        await ExpectAsync("Finance costed the waste", async () =>
            Assert.Equal(LemonCost, (await Owner.ProfitAsync(month.Year, month.Month, Ct)).Since(profitBefore).Waste));
        await ExpectHubAsync(waste, "StockLow", m => m.Int("stockItemId") == lemons);

        // 4. Selling the last two lemonades sells the item out at this branch.
        var sellOut = Step("Ring up 2 lemonades (the last two lemons)");
        var sale = await Cashier.RingUpAsync(Menu, Lines((lemonadeName, 2)), Ct);
        var sold = await ExpectEventAsync(sellOut, "StockConsumed", e => e.Str("Reference") == $"order:{sale.OrderId}");
        Assert.Equal("Sale", sold.Str("Kind"));
        Assert.Equal(2 * LemonCost, sold.Dec("Cost"));
        var outOfStock = await ExpectEventAsync(sellOut, "CatalogItemStockChanged", e => !e.Bool("InStock"));
        Assert.Contains(outOfStock.Array("CatalogItemIds"), id => id.GetInt32() == lemonade.Id);
        var unavailable = await ExpectEventAsync(sellOut, "CatalogItemAvailabilityChanged", e => e.Int("ItemId") == lemonade.Id && !e.Bool("IsAvailable"));
        Assert.Equal(1, unavailable.Int("BranchId"));

        Assert.Equal(0m, (await Owner.LevelAsync(lemons, Ct)).OnHand);
        await ExpectAsync("the till shows lemonade sold out", async () =>
        {
            await Menu.RefreshAsync(Ct);
            Assert.False(Menu.Item(lemonadeName).IsAvailable);
            Assert.True(Menu.Item(lemonadeName).IsOutOfStock);
        });
        await ExpectAsync("Finance costed the goods", async () =>
            Assert.Equal(2 * LemonCost, (await Owner.ProfitAsync(month.Year, month.Month, Ct)).Since(profitBefore).Goods));
        await ExpectHubAsync(sellOut, "CatalogChanged", m => m.Int("itemId") == lemonade.Id && !m.Bool("isAvailable"));

        var lemonadeBill = Money.Bill(2 * LemonadePrice, served: 0m, DaySetup.VatRate, DaySetup.ServiceRate);
        await Cashier.SettleAsync(sale.TicketId, Ct, Tender.Cash(lemonadeBill.Total));

        // 5. One more is refused by Catalog: the order is cancelled before it reaches a ticket.
        var refused = Step("Try to ring up one more lemonade");
        var (rejectedOrder, rejectedTicket) = await Cashier.TryRingUpAsync(Menu, Lines((lemonadeName, 1)), Ct);
        var rejected = await ExpectEventAsync(refused, "OrderStockRejected", e => e.Int("OrderId") == rejectedOrder);
        var item = Assert.Single(rejected.Array("OrderStockItems"));
        Assert.Equal(lemonade.Id, item.GetProperty("ProductId").GetInt32());
        Assert.False(item.GetProperty("HasStock").GetBoolean());
        await ExpectEventAsync(refused, "OrderStatusChangedToCancelled", e => e.Int("OrderId") == rejectedOrder);
        Assert.Null(rejectedTicket);
        await ExpectOrderStatusAsync(refused, "order_cancelled", rejectedOrder);

        // 6. A stock count finds five: the correction brings the item back.
        var count = Step("Count 5 lemons on the shelf");
        var countId = await Owner.PostCountAsync([(lemons, 5m)], "recount", Ct);
        var backInStock = await ExpectEventAsync(count, "CatalogItemStockChanged", e => e.Bool("InStock"));
        Assert.Contains(backInStock.Array("CatalogItemIds"), id => id.GetInt32() == lemonade.Id);
        await ExpectEventAsync(count, "CatalogItemAvailabilityChanged", e => e.Int("ItemId") == lemonade.Id && e.Bool("IsAvailable"));
        await ExpectNoEventAsync(count, "StockConsumed"); // a count is not a cost

        Assert.Equal(5m, (await Owner.LevelAsync(lemons, Ct)).OnHand);
        var movements = await Owner.MovementsAsync(lemons, Ct);
        var correction = Assert.Single(movements.Items, m => m.Reference == $"count:{countId}");
        Assert.Equal("Count", correction.Type);
        Assert.Equal(5m, correction.Quantity);
        await ExpectAsync("the till shows lemonade available again", async () =>
        {
            await Menu.RefreshAsync(Ct);
            Assert.True(Menu.Item(lemonadeName).IsAvailable);
        });
        await ExpectHubAsync(count, "CatalogChanged", m => m.Int("itemId") == lemonade.Id && m.Bool("isAvailable"));

        // 7. The usage report adds it all up.
        var usage = await Owner.UsageAsync(runStart, DateTime.UtcNow.AddMinutes(1), Ct);
        var row = Assert.Single(usage.Rows, r => r.StockItemId == lemons);
        Assert.Equal(3m, row.Purchased);
        Assert.Equal(12m, row.PurchasedValue);
        Assert.Equal(2m, row.Sold);
        Assert.Equal(8m, row.SoldValue);
        Assert.Equal(1m, row.Wasted);
        Assert.Equal(4m, row.WastedValue);
        Assert.Equal(5m, row.CountVariance);
        Assert.Equal(20m, row.CountVarianceValue);

        // 7b. The same period as the field reads it: nothing before, three in, two used, one wasted, five found, five left.
        var variance = await Owner.VarianceAsync(runStart, DateTime.UtcNow.AddMinutes(1), Ct);
        var period = Assert.Single(variance.Rows, r => r.StockItemId == lemons);
        Assert.Equal(0m, period.Opening);
        Assert.Equal(3m, period.Received);
        Assert.Equal(12m, period.ReceivedValue);
        Assert.Equal(2m, period.Theoretical);
        Assert.Equal(8m, period.TheoreticalValue);
        Assert.Equal(1m, period.Wasted);
        Assert.Equal(5m, period.CountVariance);
        Assert.Equal(5m, period.Closing); // 0 + 3 − 2 − 1 + 5
        Assert.Equal(20m, period.ClosingValue);
        Assert.Equal(250m, period.VariancePercent); // five found over two used

        // 8. Rebuilding the levels from the ledger changes nothing.
        Assert.Equal(0, (await Owner.RebuildLevelsAsync(Ct)).Changed);
        Assert.Equal(5m, (await Owner.LevelAsync(lemons, Ct)).OnHand);

        // 9. Staff can still take it off the menu by hand, and put it back.
        var manual = Step("Mark lemonade sold out by hand, then available again");
        await Owner.SetAvailabilityAsync(lemonade.Id, false, Ct);
        await ExpectEventAsync(manual, "CatalogItemAvailabilityChanged", e => e.Int("ItemId") == lemonade.Id && !e.Bool("IsAvailable"));
        await ExpectHubAsync(manual, "CatalogChanged", m => m.Int("itemId") == lemonade.Id && !m.Bool("isAvailable"));
        await Menu.RefreshAsync(Ct);
        Assert.False(Menu.Item(lemonadeName).IsAvailable);
        Assert.False(Menu.Item(lemonadeName).IsOutOfStock); // a choice, not a stock-out

        var back = Step("Put it back on");
        await Owner.SetAvailabilityAsync(lemonade.Id, true, Ct);
        await ExpectEventAsync(back, "CatalogItemAvailabilityChanged", e => e.Int("ItemId") == lemonade.Id && e.Bool("IsAvailable"));
        await Menu.RefreshAsync(Ct);
        Assert.True(Menu.Item(lemonadeName).IsAvailable);

        App.Logs.AssertNoHandlerFailures(Checkpoint.Logs);
        AssertSameBusinessDay();
    }
}
