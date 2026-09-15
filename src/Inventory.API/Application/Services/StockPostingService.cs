#nullable enable
using Chillax.Inventory.API.Application.IntegrationEvents.Events;
using Chillax.Inventory.Infrastructure;

namespace Chillax.Inventory.API.Application.Services;

/// <summary>
/// The one place stock is posted from: the sale handler, receipts, counts
/// and adjustments all come through here, so the consequences of a movement
/// (a menu item going out of stock or coming back, an ingredient running
/// low) are decided once and ride the outbox with the movement itself.
/// Runs inside the caller's transaction.
/// </summary>
public interface IStockPostingService
{
    Task<IReadOnlyList<LevelChange>> PostAsync(int branchId, IReadOnlyList<MovementDraft> drafts, string actor);
}

public class StockPostingService(
    IStockLedger ledger,
    IRecipeRepository recipes,
    IStockItemRepository stockItems,
    InventoryContext context,
    IInventoryIntegrationEventService integrationEvents,
    ILogger<StockPostingService> logger) : IStockPostingService
{
    public async Task<IReadOnlyList<LevelChange>> PostAsync(int branchId, IReadOnlyList<MovementDraft> drafts, string actor)
    {
        var changes = await ledger.PostAsync(branchId, drafts, actor);

        if (changes.Count == 0)
            return changes;

        var items = (await stockItems.GetManyAsync(changes.Select(c => c.StockItemId)))
            .ToDictionary(s => s.Id);

        await AnnounceSoldOutChangesAsync(branchId, changes, items);
        await AnnounceOptionSoldOutChangesAsync(branchId, changes, items);
        await AnnounceLowStockAsync(branchId, changes, items);
        await AnnounceConsumptionAsync(branchId, drafts, changes);

        return changes;
    }

    /// <summary>
    /// The same for customization options: an option recipe line whose
    /// auto-sold-out ingredient crossed zero decides whether that option can
    /// still be chosen at the branch. An option is in stock when every
    /// auto-sold-out ingredient on its lines (across the item's recipe) is
    /// above zero.
    /// </summary>
    /// <summary>
    /// What a sale or waste posting cost, at the average the units left
    /// at, so Finance can put the cost of goods beside the sales. Receipts,
    /// counts, adjustments and transfers cost nothing here.
    /// </summary>
    private async Task AnnounceConsumptionAsync(int branchId, IReadOnlyList<MovementDraft> drafts, IReadOnlyList<LevelChange> changes)
    {
        var avg = changes.ToDictionary(c => c.StockItemId, c => c.AvgUnitCost);

        foreach (var kind in new[] { MovementType.Sale, MovementType.Waste })
        {
            var cost = drafts
                .Where(d => d.Type == kind && d.Quantity < 0)
                .Sum(d => -d.Quantity * (d.UnitCost ?? avg.GetValueOrDefault(d.StockItemId)));

            if (cost <= 0)
                continue;

            var reference = drafts.FirstOrDefault(d => d.Type == kind)?.Reference;
            await integrationEvents.AddAndSaveEventAsync(new StockConsumedIntegrationEvent(
                branchId, kind.ToString(), reference, Math.Round(cost, 2), DateTime.UtcNow));
        }
    }

    private async Task AnnounceOptionSoldOutChangesAsync(int branchId, IReadOnlyList<LevelChange> changes, Dictionary<int, StockItem> items)
    {
        var crossed = changes
            .Where(c => items.TryGetValue(c.StockItemId, out var item) && item.AutoSoldOut
                && (StockTransitions.CrossedToZero(c.Pre, c.Post) || StockTransitions.CrossedAboveZero(c.Pre, c.Post)))
            .Select(c => c.StockItemId)
            .ToList();

        if (crossed.Count == 0)
            return;

        var affected = await recipes.GetUsingInOptionsAsync(crossed);

        if (affected.Count == 0)
            return;

        // Every single-option line of the affected recipes, grouped by option.
        // A line that needs a combination (medium + spiced) says nothing about
        // either option on its own: the menu can hide an option, not a pair,
        // so those lines only deduct and never sell an option out. A none
        // override deducts nothing, so it says nothing either.
        var linesByOption = affected
            .SelectMany(r => r.Lines.Where(l => l.OptionIds.Count == 1 && !l.IsNone))
            .GroupBy(l => l.OptionIds[0])
            .ToDictionary(g => g.Key, g => g.Select(l => l.StockItemId).Distinct().ToList());

        if (linesByOption.Count == 0)
            return;

        var statuses = await LockOptionStatusesAsync(branchId, linesByOption.Keys);

        var ingredientIds = linesByOption.Values.SelectMany(ids => ids).Distinct().ToList();
        var ingredients = (await stockItems.GetManyAsync(ingredientIds)).ToDictionary(s => s.Id);
        var onHand = await ledger.GetOnHandAsync(branchId, ingredientIds);

        var nowOut = new List<int>();
        var nowIn = new List<int>();

        foreach (var (optionId, stockItemIds) in linesByOption)
        {
            var inStock = stockItemIds.All(id =>
                !ingredients.TryGetValue(id, out var ingredient) || !ingredient.AutoSoldOut || onHand[id] > 0);

            if (statuses[optionId].InStock == inStock)
                continue;

            await context.MenuOptionStockStatuses
                .Where(s => s.BranchId == branchId && s.OptionId == optionId)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(x => x.InStock, inStock)
                    .SetProperty(x => x.ChangedAt, DateTime.UtcNow));

            (inStock ? nowIn : nowOut).Add(optionId);
        }

        if (nowOut.Count > 0)
        {
            logger.LogInformation("Branch {BranchId}: options {Options} out of stock", branchId, nowOut);
            await integrationEvents.AddAndSaveEventAsync(new CatalogOptionStockChangedIntegrationEvent(branchId, nowOut, false));
        }

        if (nowIn.Count > 0)
        {
            logger.LogInformation("Branch {BranchId}: options {Options} back in stock", branchId, nowIn);
            await integrationEvents.AddAndSaveEventAsync(new CatalogOptionStockChangedIntegrationEvent(branchId, nowIn, true));
        }
    }

    private async Task<Dictionary<int, MenuOptionStockStatus>> LockOptionStatusesAsync(int branchId, IEnumerable<int> optionIds)
    {
        var ids = optionIds.Distinct().OrderBy(id => id).ToList();

        foreach (var id in ids)
        {
            await context.Database.ExecuteSqlInterpolatedAsync($"""
                INSERT INTO inventory.menu_option_stock_statuses ("BranchId", "OptionId", "InStock", "ChangedAt")
                VALUES ({branchId}, {id}, TRUE, {DateTime.UtcNow})
                ON CONFLICT DO NOTHING
                """);
        }

        var rows = await context.MenuOptionStockStatuses
            .FromSqlInterpolated($"""
                SELECT * FROM inventory.menu_option_stock_statuses
                WHERE "BranchId" = {branchId} AND "OptionId" = ANY({ids.ToArray()})
                ORDER BY "OptionId"
                FOR UPDATE
                """)
            .AsNoTracking()
            .ToListAsync();

        return rows.ToDictionary(r => r.OptionId);
    }

    /// <summary>
    /// For every auto-sold-out item that crossed zero either way, recompute
    /// the menu items whose base recipe needs it and tell Catalog about the
    /// ones whose answer changed.
    /// </summary>
    private async Task AnnounceSoldOutChangesAsync(int branchId, IReadOnlyList<LevelChange> changes, Dictionary<int, StockItem> items)
    {
        var crossed = changes
            .Where(c => items.TryGetValue(c.StockItemId, out var item) && item.AutoSoldOut
                && (StockTransitions.CrossedToZero(c.Pre, c.Post) || StockTransitions.CrossedAboveZero(c.Pre, c.Post)))
            .Select(c => c.StockItemId)
            .ToList();

        if (crossed.Count == 0)
            return;

        var affected = await recipes.GetUsingAsync(crossed);

        if (affected.Count == 0)
            return;

        // Lock the status rows before reading any level, so two postings
        // touching different ingredients of one item recompute one after
        // the other, each seeing what the other committed
        var statuses = await LockStatusesAsync(branchId, affected.Select(r => r.CatalogItemId));

        // Every base ingredient that can sell an item out, across the items
        // in question, read once
        var ingredientIds = affected.SelectMany(r => r.BaseLines).Select(l => l.StockItemId).Distinct().ToList();
        var ingredients = (await stockItems.GetManyAsync(ingredientIds)).ToDictionary(s => s.Id);
        var onHand = await ledger.GetOnHandAsync(branchId, ingredientIds);

        var nowOut = new List<int>();
        var nowIn = new List<int>();

        foreach (var recipe in affected)
        {
            var inStock = recipe.BaseLines.All(l =>
                !ingredients.TryGetValue(l.StockItemId, out var ingredient) || !ingredient.AutoSoldOut || onHand[l.StockItemId] > 0);

            var status = statuses[recipe.CatalogItemId];

            if (status.InStock == inStock)
                continue;

            await context.MenuItemStockStatuses
                .Where(s => s.BranchId == branchId && s.CatalogItemId == recipe.CatalogItemId)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(x => x.InStock, inStock)
                    .SetProperty(x => x.ChangedAt, DateTime.UtcNow));

            (inStock ? nowIn : nowOut).Add(recipe.CatalogItemId);
        }

        if (nowOut.Count > 0)
        {
            logger.LogInformation("Branch {BranchId}: menu items {Items} out of stock", branchId, nowOut);
            await integrationEvents.AddAndSaveEventAsync(new CatalogItemStockChangedIntegrationEvent(branchId, nowOut, false));
        }

        if (nowIn.Count > 0)
        {
            logger.LogInformation("Branch {BranchId}: menu items {Items} back in stock", branchId, nowIn);
            await integrationEvents.AddAndSaveEventAsync(new CatalogItemStockChangedIntegrationEvent(branchId, nowIn, true));
        }
    }

    private async Task<Dictionary<int, MenuItemStockStatus>> LockStatusesAsync(int branchId, IEnumerable<int> catalogItemIds)
    {
        var ids = catalogItemIds.Distinct().OrderBy(id => id).ToList();

        foreach (var id in ids)
        {
            await context.Database.ExecuteSqlInterpolatedAsync($"""
                INSERT INTO inventory.menu_item_stock_statuses ("BranchId", "CatalogItemId", "InStock", "ChangedAt")
                VALUES ({branchId}, {id}, TRUE, {DateTime.UtcNow})
                ON CONFLICT DO NOTHING
                """);
        }

        var rows = await context.MenuItemStockStatuses
            .FromSqlInterpolated($"""
                SELECT * FROM inventory.menu_item_stock_statuses
                WHERE "BranchId" = {branchId} AND "CatalogItemId" = ANY({ids.ToArray()})
                ORDER BY "CatalogItemId"
                FOR UPDATE
                """)
            .AsNoTracking()
            .ToListAsync();

        return rows.ToDictionary(r => r.CatalogItemId);
    }

    private async Task AnnounceLowStockAsync(int branchId, IReadOnlyList<LevelChange> changes, Dictionary<int, StockItem> items)
    {
        foreach (var change in changes)
        {
            if (!StockTransitions.CrossedBelowReorder(change.Pre, change.Post, change.ReorderLevel))
                continue;

            if (!items.TryGetValue(change.StockItemId, out var item))
                continue;

            logger.LogInformation(
                "Branch {BranchId}: {Item} low ({OnHand} {Unit}, reorder at {ReorderLevel})",
                branchId, item.Name.En, change.Post, item.Unit, change.ReorderLevel);

            await integrationEvents.AddAndSaveEventAsync(new StockLowIntegrationEvent(
                branchId, item.Id, item.Name, item.Unit, change.Post, change.ReorderLevel!.Value));
        }
    }
}
