#nullable enable
using Ninja.Inventory.Domain.Services;

namespace Ninja.Inventory.Infrastructure;

/// <summary>
/// The ledger over Postgres. A level row is locked (SELECT ... FOR UPDATE)
/// for the length of the caller's transaction, so two postings against the
/// same item at the same branch land one after the other and each sees the
/// figure the other left; the movement is appended in the same transaction.
/// Nothing here goes through the change tracker for the level itself: an
/// optimistic conflict in a bus handler would be a lost message, a row lock
/// is a short wait.
/// </summary>
public class StockLedger(InventoryContext context) : IStockLedger
{
    public async Task<IReadOnlyList<LevelChange>> PostAsync(int branchId, IReadOnlyList<MovementDraft> drafts, string actor)
    {
        if (!context.HasActiveTransaction)
            throw new InvalidOperationException("Stock is posted inside a transaction.");

        var changes = new List<LevelChange>(drafts.Count);

        // Fixed order, so two postings touching the same items lock them the
        // same way round and cannot deadlock
        foreach (var draft in drafts.OrderBy(d => d.StockItemId))
        {
            if (draft.Quantity == 0)
                continue;

            if (draft.UnitCost is { } && draft.Quantity < 0)
                throw new InventoryDomainException("A unit cost goes with stock coming in, not out.");

            await context.Database.ExecuteSqlInterpolatedAsync($"""
                INSERT INTO inventory.stock_levels ("BranchId", "StockItemId", "OnHand", "AvgUnitCost")
                VALUES ({branchId}, {draft.StockItemId}, 0, 0)
                ON CONFLICT DO NOTHING
                """);

            var level = await context.StockLevels
                .FromSqlInterpolated($"""
                    SELECT * FROM inventory.stock_levels
                    WHERE "BranchId" = {branchId} AND "StockItemId" = {draft.StockItemId}
                    FOR UPDATE
                    """)
                .AsNoTracking()
                .SingleAsync();

            var pre = level.OnHand;
            var post = pre + draft.Quantity;
            var avg = draft.UnitCost is { } cost
                ? StockLevel.NextAverageCost(pre, level.AvgUnitCost, draft.Quantity, cost)
                : level.AvgUnitCost;

            await context.StockLevels
                .Where(l => l.BranchId == branchId && l.StockItemId == draft.StockItemId)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(l => l.OnHand, post)
                    .SetProperty(l => l.AvgUnitCost, avg));

            // What the movement was worth: a receipt at its own price, anything
            // else at the average it left behind
            context.StockMovements.Add(new StockMovement(
                branchId,
                draft.StockItemId,
                draft.Type,
                draft.Quantity,
                draft.UnitCost ?? level.AvgUnitCost,
                draft.Reference,
                draft.Reason,
                actor));

            changes.Add(new LevelChange(draft.StockItemId, pre, post, level.ReorderLevel, avg));
        }

        return changes;
    }

    public Task<bool> HasReferenceAsync(string reference)
        => context.StockMovements.AnyAsync(m => m.Reference == reference);

    public async Task<Dictionary<int, decimal>> GetOnHandAsync(int branchId, IEnumerable<int> stockItemIds)
    {
        var ids = stockItemIds.Distinct().ToList();

        var known = await context.StockLevels
            .AsNoTracking()
            .Where(l => l.BranchId == branchId && ids.Contains(l.StockItemId))
            .ToDictionaryAsync(l => l.StockItemId, l => l.OnHand);

        foreach (var id in ids)
            known.TryAdd(id, 0);

        return known;
    }

    public async Task<Dictionary<int, DateTime>> GetLastCountedAtAsync(int branchId, IEnumerable<int> stockItemIds)
    {
        var ids = stockItemIds.Distinct().ToList();

        return await context.StockMovements
            .AsNoTracking()
            .Where(m => m.BranchId == branchId && m.Type == MovementType.Count && ids.Contains(m.StockItemId))
            .GroupBy(m => m.StockItemId)
            .Select(g => new { StockItemId = g.Key, At = g.Max(m => m.RecordedAt) })
            .ToDictionaryAsync(x => x.StockItemId, x => x.At);
    }

    public async Task<int> RebuildAsync(int branchId)
    {
        // Every level the branch has (or should have): the sum of its ledger.
        // Cost averages are left alone; only the on-hand figure is derived.
        await context.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO inventory.stock_levels ("BranchId", "StockItemId", "OnHand", "AvgUnitCost")
            SELECT {branchId}, m."StockItemId", 0, 0
            FROM inventory.stock_movements m
            WHERE m."BranchId" = {branchId}
            GROUP BY m."StockItemId"
            ON CONFLICT DO NOTHING
            """);

        return await context.Database.ExecuteSqlInterpolatedAsync($"""
            UPDATE inventory.stock_levels l
            SET "OnHand" = s.total
            FROM (
                SELECT lv."StockItemId", COALESCE(SUM(m."Quantity"), 0) AS total
                FROM inventory.stock_levels lv
                LEFT JOIN inventory.stock_movements m
                    ON m."BranchId" = lv."BranchId" AND m."StockItemId" = lv."StockItemId"
                WHERE lv."BranchId" = {branchId}
                GROUP BY lv."StockItemId"
            ) s
            WHERE l."BranchId" = {branchId} AND l."StockItemId" = s."StockItemId" AND l."OnHand" <> s.total
            """);
    }

    public async Task SetReorderLevelAsync(int branchId, int stockItemId, decimal? reorderLevel)
    {
        await context.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO inventory.stock_levels ("BranchId", "StockItemId", "OnHand", "AvgUnitCost")
            VALUES ({branchId}, {stockItemId}, 0, 0)
            ON CONFLICT DO NOTHING
            """);

        await context.StockLevels
            .Where(l => l.BranchId == branchId && l.StockItemId == stockItemId)
            .ExecuteUpdateAsync(s => s.SetProperty(l => l.ReorderLevel, reorderLevel));
    }
}
