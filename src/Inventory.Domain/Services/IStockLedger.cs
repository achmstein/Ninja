#nullable enable
using Chillax.Inventory.Domain.AggregatesModel.LedgerAggregate;

namespace Chillax.Inventory.Domain.Services;

/// <summary>
/// A movement about to be posted. <paramref name="UnitCost"/> is what a base
/// unit cost, for a receipt or an opening-stock adjustment; null keeps the
/// branch's average.
/// </summary>
public record MovementDraft(
    int StockItemId,
    MovementType Type,
    decimal Quantity,
    string? Reference = null,
    string? Reason = null,
    decimal? UnitCost = null);

/// <summary>
/// What posting did to one level: the figures before and after. A draft
/// that was dropped before posting (a replayed sale already absorbed by a
/// later count) reports no change and is not in the list.
/// </summary>
public record LevelChange(int StockItemId, decimal Pre, decimal Post, decimal? ReorderLevel, decimal AvgUnitCost);

/// <summary>
/// The only way stock moves. Posts the drafts as movements, moves the levels
/// under a row lock, and reports each change so the caller can tell the
/// menu and the back office. Runs inside the caller's transaction.
/// </summary>
public interface IStockLedger
{
    Task<IReadOnlyList<LevelChange>> PostAsync(int branchId, IReadOnlyList<MovementDraft> drafts, string actor);

    /// <summary>Whether any movement carries this reference: the redelivery guard.</summary>
    Task<bool> HasReferenceAsync(string reference);

    /// <summary>The branch's current on-hand figures for these items (0 when never moved).</summary>
    Task<Dictionary<int, decimal>> GetOnHandAsync(int branchId, IEnumerable<int> stockItemIds);

    Task SetReorderLevelAsync(int branchId, int stockItemId, decimal? reorderLevel);

    /// <summary>When each of these items was last counted at the branch; absent when never.</summary>
    Task<Dictionary<int, DateTime>> GetLastCountedAtAsync(int branchId, IEnumerable<int> stockItemIds);

    /// <summary>
    /// Recompute every level of the branch from its movements. The ledger is
    /// the truth; this is the repair when a level and its history disagree.
    /// Returns how many levels changed.
    /// </summary>
    Task<int> RebuildAsync(int branchId);
}
