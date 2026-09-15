#nullable enable
using Chillax.Inventory.Domain.AggregatesModel.TransferAggregate;
using Chillax.Inventory.API.Application.Services;
using Chillax.Inventory.Infrastructure;

namespace Chillax.Inventory.API.Application.Queries;

public interface IInventoryQueries
{
    Task<IReadOnlyList<StockItemView>> GetStockItemsAsync(bool includeInactive);
    Task<StockItemView?> GetStockItemAsync(int id);

    /// <summary>Every active stock item at the branch, moved or not, with its level.</summary>
    Task<IReadOnlyList<StockLevelView>> GetLevelsAsync(int branchId, bool lowOnly, bool includeRetired = false);

    Task<PagedResult<MovementView>> GetMovementsAsync(int branchId, int? stockItemId, MovementType? type, DateTime? from, DateTime? to, int pageIndex, int pageSize);

    Task<PagedResult<PurchaseView>> GetPurchasesAsync(int branchId, int pageIndex, int pageSize);
    Task<PurchaseView?> GetPurchaseAsync(int id);

    Task<PagedResult<StockCountView>> GetStockCountsAsync(int branchId, int pageIndex, int pageSize);
    Task<StockCountView?> GetStockCountAsync(int id);

    Task<IReadOnlyList<RecipeView>> GetRecipesAsync();
    Task<RecipeView?> GetRecipeAsync(int catalogItemId);

    /// <summary>Transfers the branch sent or received, newest first.</summary>
    Task<PagedResult<TransferView>> GetTransfersAsync(int branchId, int pageIndex, int pageSize);
    Task<TransferView?> GetTransferAsync(int id);

    Task<UsageReport> GetUsageReportAsync(int branchId, DateTime from, DateTime to);
    Task<VarianceReport> GetVarianceReportAsync(int branchId, DateTime from, DateTime to);

    /// <summary>What the branch last paid per base unit, by stock item: the newest receipt on the ledger.</summary>
    Task<Dictionary<int, (decimal UnitCost, DateTime At)>> GetLastCostsAsync(int branchId);
    Task<IReadOnlyList<CostHistoryView>> GetCostHistoryAsync(int branchId, int stockItemId, int take);
    Task<IReadOnlyList<RecipeCostView>> GetRecipeCostsAsync(int branchId);
}

public class InventoryQueries(InventoryContext context) : IInventoryQueries
{
    public async Task<IReadOnlyList<StockItemView>> GetStockItemsAsync(bool includeInactive)
        => await context.StockItems
            .AsNoTracking()
            .Where(s => includeInactive || s.IsActive)
            .OrderBy(s => s.Name.En)
            .Select(s => ToView(s))
            .ToListAsync();

    public async Task<StockItemView?> GetStockItemAsync(int id)
    {
        var item = await context.StockItems.AsNoTracking().FirstOrDefaultAsync(s => s.Id == id);
        return item is null ? null : ToView(item);
    }

    public async Task<IReadOnlyList<StockLevelView>> GetLevelsAsync(int branchId, bool lowOnly, bool includeRetired = false)
    {
        // Retired items keep their level rows; the admin asks for them to restore one
        var items = await context.StockItems.AsNoTracking()
            .Where(s => s.IsActive || includeRetired)
            .OrderBy(s => s.Name.En)
            .ToListAsync();
        var levels = await context.StockLevels.AsNoTracking().Where(l => l.BranchId == branchId).ToDictionaryAsync(l => l.StockItemId);
        var lastCosts = await GetLastCostsAsync(branchId);

        var views = items.Select(s =>
        {
            levels.TryGetValue(s.Id, out var level);
            var onHand = level?.OnHand ?? 0;
            var reorder = level?.ReorderLevel;
            var avg = level?.AvgUnitCost ?? 0;
            var last = lastCosts.TryGetValue(s.Id, out var l) ? l : default((decimal UnitCost, DateTime At)?);
            return new StockLevelView(
                s.Id, s.Name, s.Unit, s.PackSize, s.PackName, s.AutoSoldOut, s.IsActive,
                onHand, reorder, avg,
                IsLow: reorder is { } r && onHand <= r,
                Value: StockValue(onHand, avg),
                LastCost: last?.UnitCost,
                LastCostAt: last?.At);
        });

        return (lowOnly ? views.Where(v => v.IsLow) : views).ToList();
    }

    public async Task<PagedResult<MovementView>> GetMovementsAsync(int branchId, int? stockItemId, MovementType? type, DateTime? from, DateTime? to, int pageIndex, int pageSize)
    {
        var query = context.StockMovements.AsNoTracking().Where(m => m.BranchId == branchId);

        if (stockItemId is { } id)
            query = query.Where(m => m.StockItemId == id);
        if (type is { } kind)
            query = query.Where(m => m.Type == kind);
        if (from is { } f)
            query = query.Where(m => m.RecordedAt >= f);
        if (to is { } t)
            query = query.Where(m => m.RecordedAt < t);

        var total = await query.CountAsync();

        var rows = await query
            .OrderByDescending(m => m.RecordedAt)
            .ThenByDescending(m => m.Id)
            .Skip(pageIndex * pageSize)
            .Take(pageSize)
            .Join(context.StockItems.AsNoTracking(), m => m.StockItemId, s => s.Id, (m, s) => new MovementView(
                m.Id, m.StockItemId, s.Name, s.Unit, m.Type.ToString(), m.Quantity, m.UnitCost,
                m.Reference, m.Reason, m.RecordedBy, m.RecordedAt))
            .ToListAsync();

        return new PagedResult<MovementView>(rows, total);
    }

    public async Task<PagedResult<PurchaseView>> GetPurchasesAsync(int branchId, int pageIndex, int pageSize)
    {
        var query = context.Purchases.AsNoTracking().Where(p => p.BranchId == branchId);
        var total = await query.CountAsync();
        var rows = await query.OrderByDescending(p => p.ReceivedAt).ThenByDescending(p => p.Id).Skip(pageIndex * pageSize).Take(pageSize).ToListAsync();
        var names = await NamesAsync(rows.SelectMany(p => p.Lines).Select(l => l.StockItemId));
        return new PagedResult<PurchaseView>(rows.Select(p => ToView(p, names)).ToList(), total);
    }

    public async Task<PurchaseView?> GetPurchaseAsync(int id)
    {
        var purchase = await context.Purchases.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id);
        if (purchase is null) return null;
        return ToView(purchase, await NamesAsync(purchase.Lines.Select(l => l.StockItemId)));
    }

    public async Task<PagedResult<StockCountView>> GetStockCountsAsync(int branchId, int pageIndex, int pageSize)
    {
        var query = context.StockCounts.AsNoTracking().Where(c => c.BranchId == branchId);
        var total = await query.CountAsync();
        var rows = await query.OrderByDescending(c => c.CountedAt).ThenByDescending(c => c.Id).Skip(pageIndex * pageSize).Take(pageSize).ToListAsync();
        var names = await NamesAsync(rows.SelectMany(c => c.Lines).Select(l => l.StockItemId));
        return new PagedResult<StockCountView>(rows.Select(c => ToView(c, names)).ToList(), total);
    }

    public async Task<StockCountView?> GetStockCountAsync(int id)
    {
        var count = await context.StockCounts.AsNoTracking().FirstOrDefaultAsync(c => c.Id == id);
        if (count is null) return null;
        return ToView(count, await NamesAsync(count.Lines.Select(l => l.StockItemId)));
    }

    public async Task<IReadOnlyList<RecipeView>> GetRecipesAsync()
    {
        var recipes = await context.Recipes.AsNoTracking().OrderBy(r => r.CatalogItemId).ToListAsync();
        var names = await NamesAsync(recipes.SelectMany(r => r.Lines).Select(l => l.StockItemId));
        return recipes.Select(r => ToView(r, names)).ToList();
    }

    public async Task<RecipeView?> GetRecipeAsync(int catalogItemId)
    {
        var recipe = await context.Recipes.AsNoTracking().FirstOrDefaultAsync(r => r.CatalogItemId == catalogItemId);
        if (recipe is null) return null;
        return ToView(recipe, await NamesAsync(recipe.Lines.Select(l => l.StockItemId)));
    }

    public async Task<PagedResult<TransferView>> GetTransfersAsync(int branchId, int pageIndex, int pageSize)
    {
        var query = context.Transfers.AsNoTracking().Where(t => t.FromBranchId == branchId || t.ToBranchId == branchId);
        var total = await query.CountAsync();
        var rows = await query.OrderByDescending(t => t.SentAt).ThenByDescending(t => t.Id).Skip(pageIndex * pageSize).Take(pageSize).ToListAsync();
        var names = await NamesAsync(rows.SelectMany(t => t.Lines).Select(l => l.StockItemId));
        return new PagedResult<TransferView>(rows.Select(t => ToView(t, names)).ToList(), total);
    }

    public async Task<TransferView?> GetTransferAsync(int id)
    {
        var transfer = await context.Transfers.AsNoTracking().FirstOrDefaultAsync(t => t.Id == id);
        if (transfer is null) return null;
        return ToView(transfer, await NamesAsync(transfer.Lines.Select(l => l.StockItemId)));
    }

    public async Task<UsageReport> GetUsageReportAsync(int branchId, DateTime from, DateTime to)
    {
        // Each movement is valued at the cost it was posted with, so the
        // period's figures never move when a later receipt changes the average
        var sums = await context.StockMovements
            .AsNoTracking()
            .Where(m => m.BranchId == branchId && m.RecordedAt >= from && m.RecordedAt < to)
            .GroupBy(m => new { m.StockItemId, m.Type })
            .Select(g => new
            {
                g.Key.StockItemId,
                g.Key.Type,
                Quantity = g.Sum(m => m.Quantity),
                Value = g.Sum(m => m.Quantity * m.UnitCost),
            })
            .ToListAsync();

        var byItem = sums.GroupBy(s => s.StockItemId).ToDictionary(g => g.Key, g => g.ToList());
        var names = await NamesAsync(byItem.Keys);

        var rows = byItem
            .Select(kv =>
            {
                decimal Qty(MovementType type) => kv.Value.Where(s => s.Type == type).Sum(s => s.Quantity);
                decimal Val(MovementType type) => Math.Round(kv.Value.Where(s => s.Type == type).Sum(s => s.Value), 2, MidpointRounding.AwayFromZero);

                return new UsageReportRow(
                    kv.Key, Name(names, kv.Key), Unit(names, kv.Key),
                    Purchased: Qty(MovementType.Purchase), PurchasedValue: Val(MovementType.Purchase),
                    Sold: -Qty(MovementType.Sale), SoldValue: -Val(MovementType.Sale),
                    Wasted: -Qty(MovementType.Waste), WastedValue: -Val(MovementType.Waste),
                    Adjusted: Qty(MovementType.Adjustment), AdjustedValue: Val(MovementType.Adjustment),
                    CountVariance: Qty(MovementType.Count), CountVarianceValue: Val(MovementType.Count),
                    TransferredIn: Qty(MovementType.TransferIn), TransferredOut: -Qty(MovementType.TransferOut),
                    TransferredValue: Val(MovementType.TransferIn) + Val(MovementType.TransferOut));
            })
            .OrderBy(r => r.Name.En)
            .ToList();

        var stockValue = await context.StockLevels
            .AsNoTracking()
            .Where(l => l.BranchId == branchId)
            .Select(l => new { l.OnHand, l.AvgUnitCost })
            .ToListAsync();

        return new UsageReport(
            from, to, rows,
            PurchasedValue: rows.Sum(r => r.PurchasedValue),
            SoldValue: rows.Sum(r => r.SoldValue),
            WastedValue: rows.Sum(r => r.WastedValue),
            CountVarianceValue: rows.Sum(r => r.CountVarianceValue),
            StockValue: stockValue.Sum(l => StockValue(l.OnHand, l.AvgUnitCost)));
    }

    public async Task<VarianceReport> GetVarianceReportAsync(int branchId, DateTime from, DateTime to)
    {
        // The period's movements by item and type, valued as posted (the
        // usage report's principle); what was there before the period is
        // the ledger summed up to it
        var within = await context.StockMovements
            .AsNoTracking()
            .Where(m => m.BranchId == branchId && m.RecordedAt >= from && m.RecordedAt < to)
            .GroupBy(m => new { m.StockItemId, m.Type })
            .Select(g => new
            {
                g.Key.StockItemId,
                g.Key.Type,
                Quantity = g.Sum(m => m.Quantity),
                Value = g.Sum(m => m.Quantity * m.UnitCost),
            })
            .ToListAsync();

        var opening = await context.StockMovements
            .AsNoTracking()
            .Where(m => m.BranchId == branchId && m.RecordedAt < from)
            .GroupBy(m => m.StockItemId)
            .Select(g => new { StockItemId = g.Key, Quantity = g.Sum(m => m.Quantity) })
            .ToDictionaryAsync(x => x.StockItemId, x => x.Quantity);

        var ids = within.Select(s => s.StockItemId).Concat(opening.Keys).Distinct().ToList();
        var names = await NamesAsync(ids);
        var averages = await context.StockLevels
            .AsNoTracking()
            .Where(l => l.BranchId == branchId && ids.Contains(l.StockItemId))
            .ToDictionaryAsync(l => l.StockItemId, l => l.AvgUnitCost);
        var byItem = within.GroupBy(s => s.StockItemId).ToDictionary(g => g.Key, g => g.ToList());

        var rows = ids
            .Select(id =>
            {
                byItem.TryGetValue(id, out var sums);
                sums ??= [];
                decimal Qty(MovementType type) => sums.Where(s => s.Type == type).Sum(s => s.Quantity);
                decimal Val(MovementType type) => Money(sums.Where(s => s.Type == type).Sum(s => s.Value));

                var open = opening.GetValueOrDefault(id);
                var close = open + sums.Sum(s => s.Quantity);
                var avg = averages.GetValueOrDefault(id);
                var theoretical = -Qty(MovementType.Sale);
                var countVariance = Qty(MovementType.Count);

                return new VarianceRow(
                    id, Name(names, id), Unit(names, id),
                    Opening: open, OpeningValue: StockValue(open, avg),
                    Received: Qty(MovementType.Purchase), ReceivedValue: Val(MovementType.Purchase),
                    TransferredIn: Qty(MovementType.TransferIn), TransferredOut: -Qty(MovementType.TransferOut),
                    TransferredValue: Val(MovementType.TransferIn) + Val(MovementType.TransferOut),
                    Theoretical: theoretical, TheoreticalValue: -Val(MovementType.Sale),
                    Wasted: -Qty(MovementType.Waste), WastedValue: -Val(MovementType.Waste),
                    Adjusted: Qty(MovementType.Adjustment), AdjustedValue: Val(MovementType.Adjustment),
                    CountVariance: countVariance, CountVarianceValue: Val(MovementType.Count),
                    Closing: close, ClosingValue: StockValue(close, avg),
                    VariancePercent: theoretical > 0 ? Math.Round(countVariance / theoretical * 100, 1, MidpointRounding.AwayFromZero) : null);
            })
            .Where(r => r.Opening != 0 || r.Closing != 0 || byItem.ContainsKey(r.StockItemId))
            .OrderBy(r => r.Name.En)
            .ToList();

        return new VarianceReport(
            from, to, rows,
            OpeningValue: rows.Sum(r => r.OpeningValue),
            ReceivedValue: rows.Sum(r => r.ReceivedValue),
            TheoreticalValue: rows.Sum(r => r.TheoreticalValue),
            WastedValue: rows.Sum(r => r.WastedValue),
            CountVarianceValue: rows.Sum(r => r.CountVarianceValue),
            ClosingValue: rows.Sum(r => r.ClosingValue));
    }

    public async Task<Dictionary<int, (decimal UnitCost, DateTime At)>> GetLastCostsAsync(int branchId)
    {
        // The newest receipt per item; Postgres' DISTINCT ON does it in one pass
        var newest = await context.StockMovements
            .FromSqlInterpolated($"""
                SELECT DISTINCT ON ("StockItemId") *
                FROM inventory.stock_movements
                WHERE "BranchId" = {branchId} AND "Type" = {nameof(MovementType.Purchase)}
                ORDER BY "StockItemId", "RecordedAt" DESC, "Id" DESC
                """)
            .AsNoTracking()
            .ToListAsync();

        return newest.ToDictionary(m => m.StockItemId, m => (m.UnitCost, m.RecordedAt));
    }

    public async Task<IReadOnlyList<CostHistoryView>> GetCostHistoryAsync(int branchId, int stockItemId, int take)
    {
        var receipts = await context.StockMovements
            .AsNoTracking()
            .Where(m => m.BranchId == branchId && m.StockItemId == stockItemId && m.Type == MovementType.Purchase)
            .OrderByDescending(m => m.RecordedAt).ThenByDescending(m => m.Id)
            .Take(take)
            .Select(m => new { m.RecordedAt, m.Reference, m.Quantity, m.UnitCost })
            .ToListAsync();

        // A receipt's reference is purchase:{id}; the purchase names the supplier
        var purchaseIds = receipts
            .Select(r => PurchaseIdOf(r.Reference))
            .Where(id => id is not null)
            .Select(id => id!.Value)
            .Distinct()
            .ToList();
        var suppliers = await context.Purchases
            .AsNoTracking()
            .Where(p => purchaseIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, p => p.Supplier);

        return receipts.Select(r =>
        {
            var purchaseId = PurchaseIdOf(r.Reference);
            return new CostHistoryView(r.RecordedAt, purchaseId, purchaseId is { } id ? suppliers.GetValueOrDefault(id) : null, r.Quantity, r.UnitCost);
        }).ToList();
    }

    public async Task<IReadOnlyList<RecipeCostView>> GetRecipeCostsAsync(int branchId)
    {
        var recipes = await context.Recipes.AsNoTracking().OrderBy(r => r.CatalogItemId).ToListAsync();
        var items = await NamesAsync(recipes.SelectMany(r => r.Lines).Select(l => l.StockItemId));
        var averages = await context.StockLevels
            .AsNoTracking()
            .Where(l => l.BranchId == branchId)
            .ToDictionaryAsync(l => l.StockItemId, l => l.AvgUnitCost);

        return recipes.Select(r => RecipeCosting.Cost(r, averages, items)).ToList();
    }

    private static int? PurchaseIdOf(string? reference)
        => reference is not null && reference.StartsWith("purchase:", StringComparison.Ordinal)
            && int.TryParse(reference.AsSpan("purchase:".Length), out var id)
            ? id
            : null;

    private static decimal Money(decimal value) => Math.Round(value, 2, MidpointRounding.AwayFromZero);

    private static decimal StockValue(decimal onHand, decimal avgUnitCost)
        => onHand <= 0 ? 0 : Math.Round(onHand * avgUnitCost, 2, MidpointRounding.AwayFromZero);

    private static TransferView ToView(Transfer t, Dictionary<int, StockItem> names)
        => new(t.Id, t.FromBranchId, t.ToBranchId, t.Note, t.SentBy, t.SentAt,
            t.Lines.Select(l => new TransferLineView(l.StockItemId, Name(names, l.StockItemId), Unit(names, l.StockItemId), l.Quantity)).ToList());

    private async Task<Dictionary<int, StockItem>> NamesAsync(IEnumerable<int> stockItemIds)
    {
        var ids = stockItemIds.Distinct().ToList();
        return await context.StockItems.AsNoTracking().Where(s => ids.Contains(s.Id)).ToDictionaryAsync(s => s.Id);
    }

    private static StockItemView ToView(StockItem s)
        => new(s.Id, s.Name, s.Unit, s.PackSize, s.PackName, s.AutoSoldOut, s.IsActive);

    private static PurchaseView ToView(Purchase p, Dictionary<int, StockItem> names)
        => new(p.Id, p.BranchId, p.Supplier, p.InvoiceRef, p.ReceivedBy, p.ReceivedAt, p.Total,
            p.Lines.Select(l => new PurchaseLineView(l.StockItemId, Name(names, l.StockItemId), Unit(names, l.StockItemId), l.Quantity, l.UnitCost, l.Total)).ToList(),
            p.SupplierId);

    private static StockCountView ToView(StockCount c, Dictionary<int, StockItem> names)
        => new(c.Id, c.BranchId, c.Note, c.CountedBy, c.CountedAt, c.Lines.Count, c.Differences.Count(),
            c.Lines.Select(l => new StockCountLineView(l.StockItemId, Name(names, l.StockItemId), Unit(names, l.StockItemId), l.Expected, l.Counted, l.Variance)).ToList());

    private static RecipeView ToView(Recipe r, Dictionary<int, StockItem> names)
        => new(r.CatalogItemId,
            // Ids climb in the order the lines were saved: the back office's own order
            r.Lines.OrderBy(l => l.Slot).ThenBy(l => l.Id).Select(l => new RecipeLineView(l.Id, l.StockItemId, Name(names, l.StockItemId), Unit(names, l.StockItemId), l.Quantity, l.OptionIds, l.Slot, l.Scalable, l.IsNone)).ToList(),
            r.Scales.Select(s => new RecipeScaleView(s.OptionId, s.Factor)).ToList());

    private static LocalizedText Name(Dictionary<int, StockItem> names, int id)
        => names.TryGetValue(id, out var s) ? s.Name : new LocalizedText($"#{id}");

    private static string Unit(Dictionary<int, StockItem> names, int id)
        => names.TryGetValue(id, out var s) ? s.Unit : string.Empty;
}
