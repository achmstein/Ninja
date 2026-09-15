#nullable enable
namespace Chillax.Inventory.API.Application.Queries;

public record StockItemView(
    int Id,
    LocalizedText Name,
    string Unit,
    decimal? PackSize,
    string? PackName,
    bool AutoSoldOut,
    bool IsActive);

/// <summary>A stock item as one branch sees it: what is on the shelf and where the warning line sits.</summary>
public record StockLevelView(
    int StockItemId,
    LocalizedText Name,
    string Unit,
    decimal? PackSize,
    string? PackName,
    bool AutoSoldOut,
    bool IsActive,
    decimal OnHand,
    decimal? ReorderLevel,
    decimal AvgUnitCost,
    bool IsLow,
    /// <summary>What the branch's stock of this item is worth: on hand × average cost (never below zero).</summary>
    decimal Value,
    /// <summary>What the branch last paid per base unit (the newest receipt); null when never received here.</summary>
    decimal? LastCost = null,
    DateTime? LastCostAt = null);

/// <summary>One receipt of an item at the branch, for the cost history.</summary>
public record CostHistoryView(DateTime At, int? PurchaseId, string? Supplier, decimal Quantity, decimal UnitCost);

public record TransferLineView(int StockItemId, LocalizedText Name, string Unit, decimal Quantity);

public record TransferView(
    int Id,
    int FromBranchId,
    int ToBranchId,
    string? Note,
    string SentBy,
    DateTime SentAt,
    IReadOnlyList<TransferLineView> Lines);

/// <summary>
/// One stock item over a period: what came in, what went out and why, each
/// valued at the cost the movements were posted with.
/// </summary>
public record UsageReportRow(
    int StockItemId,
    LocalizedText Name,
    string Unit,
    decimal Purchased,
    decimal PurchasedValue,
    decimal Sold,
    decimal SoldValue,
    decimal Wasted,
    decimal WastedValue,
    decimal Adjusted,
    decimal AdjustedValue,
    decimal CountVariance,
    decimal CountVarianceValue,
    decimal TransferredIn,
    decimal TransferredOut,
    decimal TransferredValue);

public record UsageReport(
    DateTime From,
    DateTime To,
    IReadOnlyList<UsageReportRow> Rows,
    decimal PurchasedValue,
    /// <summary>Cost of what was sold: the goods side of the period's sales.</summary>
    decimal SoldValue,
    decimal WastedValue,
    decimal CountVarianceValue,
    /// <summary>What the branch's stock is worth right now, all items.</summary>
    decimal StockValue);

/// <summary>
/// The usage report reframed as the period the field reads: what was there,
/// what came in, what the recipes say went out, what was thrown away, what
/// the counts found, what is left. Quantities in the item's base unit;
/// movements valued at the cost they were posted with, opening and closing
/// at the branch's current average.
/// </summary>
public record VarianceRow(
    int StockItemId,
    LocalizedText Name,
    string Unit,
    decimal Opening,
    decimal OpeningValue,
    decimal Received,
    decimal ReceivedValue,
    decimal TransferredIn,
    decimal TransferredOut,
    decimal TransferredValue,
    /// <summary>What selling took out through the recipes.</summary>
    decimal Theoretical,
    decimal TheoreticalValue,
    decimal Wasted,
    decimal WastedValue,
    decimal Adjusted,
    decimal AdjustedValue,
    /// <summary>What the counts corrected: negative is stock that went missing.</summary>
    decimal CountVariance,
    decimal CountVarianceValue,
    decimal Closing,
    decimal ClosingValue,
    /// <summary>Count variance over theoretical usage; null when nothing was sold.</summary>
    decimal? VariancePercent);

public record VarianceReport(
    DateTime From,
    DateTime To,
    IReadOnlyList<VarianceRow> Rows,
    decimal OpeningValue,
    decimal ReceivedValue,
    /// <summary>Cost of goods sold: the theoretical usage, valued.</summary>
    decimal TheoreticalValue,
    decimal WastedValue,
    decimal CountVarianceValue,
    decimal ClosingValue);

public record MovementView(
    int Id,
    int StockItemId,
    LocalizedText StockItemName,
    string Unit,
    string Type,
    decimal Quantity,
    decimal UnitCost,
    string? Reference,
    string? Reason,
    string RecordedBy,
    DateTime RecordedAt);

public record PagedResult<T>(IReadOnlyList<T> Items, int TotalCount);

public record PurchaseLineView(int StockItemId, LocalizedText Name, string Unit, decimal Quantity, decimal UnitCost, decimal Total);

public record PurchaseView(
    int Id,
    int BranchId,
    string? Supplier,
    string? InvoiceRef,
    string ReceivedBy,
    DateTime ReceivedAt,
    decimal Total,
    IReadOnlyList<PurchaseLineView> Lines,
    int? SupplierId = null);

public record StockCountLineView(int StockItemId, LocalizedText Name, string Unit, decimal Expected, decimal Counted, decimal Variance);

public record StockCountView(
    int Id,
    int BranchId,
    string? Note,
    string CountedBy,
    DateTime CountedAt,
    int LinesCounted,
    int LinesOff,
    IReadOnlyList<StockCountLineView> Lines);

/// <summary>A line; <paramref name="OptionIds"/> empty for the base recipe, else every option the line needs chosen.</summary>
public record RecipeLineView(int Id, int StockItemId, LocalizedText Name, string Unit, decimal Quantity, IReadOnlyList<int> OptionIds);

public record RecipeView(int CatalogItemId, IReadOnlyList<RecipeLineView> Lines);

/// <summary>A recipe line with what it costs at the branch's average.</summary>
public record RecipeCostLineView(int StockItemId, LocalizedText Name, string Unit, decimal Quantity, IReadOnlyList<int> OptionIds, decimal UnitCost, decimal Cost);

/// <summary>What one option set adds to the cost when those options are picked.</summary>
public record RecipeOptionCostView(IReadOnlyList<int> OptionIds, decimal Cost);

/// <summary>
/// What one sale of a menu item costs at the branch. Inventory knows no
/// prices: the admin app joins Catalog's for the margin.
/// </summary>
/// <param name="BaseCost">The base lines at the branch's average costs.</param>
/// <param name="Options">Each option line set and what it adds.</param>
/// <param name="Uncosted">Ingredients with no cost at this branch yet (never received); the figures are lower bounds.</param>
public record RecipeCostView(int CatalogItemId, decimal BaseCost, IReadOnlyList<RecipeOptionCostView> Options, IReadOnlyList<RecipeCostLineView> Lines, IReadOnlyList<int> Uncosted);
