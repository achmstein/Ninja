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
    decimal Value);

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
    IReadOnlyList<PurchaseLineView> Lines);

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
