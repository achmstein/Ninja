using System.Globalization;

namespace Ninja.Assistant.API.Downstream;

// Minimal mirrors of the services' contracts: only what the tools read or
// send, deserialised case-insensitively (JsonSerializerDefaults.Web). Lists
// are nullable because a missing array is a valid answer.

public sealed record LocalizedText(string? En, string? Ar)
{
    /// <summary>The English name, or the Arabic one when that is all there is.</summary>
    public string Display => !string.IsNullOrWhiteSpace(En) ? En : En ?? Ar ?? "";
}

// --- Branch ------------------------------------------------------------------

public sealed record BranchResponse(
    int Id,
    LocalizedText? Name,
    bool IsActive,
    int DisplayOrder,
    string? DayStartTime,
    string? DayEndTime,
    bool IsOrderingEnabled,
    bool IsReservationsEnabled)
{
    public string DisplayName => Name?.Display is { Length: > 0 } n ? n : $"Branch {Id}";

    /// <summary>When the branch's business day starts ("17:00" for a night cafe); midnight when unset.</summary>
    public TimeOnly DayStart
        => TimeOnly.TryParseExact(DayStartTime, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var t) ? t : TimeOnly.MinValue;
}

public sealed record TenantLocaleDto(string? Country, string? Currency, string? TimeZone, string? Language)
{
    public static readonly TenantLocaleDto Default = new("EG", "EGP", "Africa/Cairo", "ar");
}

public sealed record TenantResponse(LocalizedText? Name, TenantLocaleDto? Locale);

// --- Sales -------------------------------------------------------------------

public sealed record TenderTotal(string Tender, decimal Amount, int Count);

public sealed record TypeTotal(string Type, int Count, decimal Net);

public sealed record RangeReport(
    int TicketsSettled,
    decimal Net,
    decimal Discounts,
    decimal ChangeGiven,
    List<TenderTotal>? TenderTotals,
    List<TypeTotal>? ByType,
    decimal Subtotal,
    decimal ServiceCharge,
    decimal Vat,
    decimal Refunds,
    int RefundCount,
    decimal TabPayments,
    int TabPaymentCount);

public sealed record HourTotal(int Hour, int Count, decimal Net);

public sealed record WeekdayTotal(int Weekday, int Count, decimal Net);

public sealed record CashierTotal(string Name, int Count, decimal Net, decimal Discounts, int Voids, decimal Refunds);

public sealed record ItemTotal(LocalizedText? Description, decimal Qty, decimal Amount, int Tickets, int? CatalogItemId);

public sealed record BreakdownReport(
    List<HourTotal>? ByHour,
    List<WeekdayTotal>? ByWeekday,
    List<CashierTotal>? ByCashier,
    List<ItemTotal>? ByItem);

public sealed record RefundSummary(
    int Id,
    int Number,
    int ReceiptNumber,
    decimal Amount,
    string? Tender,
    string? Reason,
    string? CustomerName,
    string? RefundedBy,
    DateTime RefundedAt);

public sealed record PagedResult<T>(List<T>? Items, int TotalCount);

public sealed record ShiftView(
    int Id,
    int BranchId,
    string? Status,
    DateTime OpenedAt,
    string? OpenedBy,
    decimal OpeningFloat,
    DateTime? ClosedAt,
    string? ClosedBy,
    decimal? ClosingCount,
    decimal? ExpectedCash,
    decimal? OverShort,
    int TicketsSettled,
    decimal SalesTotal,
    decimal RefundsTotal,
    decimal ExpectedInDrawer);

// --- Ordering ----------------------------------------------------------------

public sealed record OrderStatsDay(string? Date, int Orders, decimal Revenue);

public sealed record OrderStatsItem(LocalizedText? ProductName, int Units, decimal Revenue);

public sealed record OrderStats(List<OrderStatsDay>? Days, List<OrderStatsItem>? TopItems);

// --- Finance -----------------------------------------------------------------

public sealed record CategoryTotal(int CategoryId, LocalizedText? CategoryName, decimal Total);

public sealed record PartnerProfitShareView(int PartnerId, string? Name, decimal Percent, decimal Amount);

public sealed record ProfitView(
    int Year,
    int Month,
    decimal Sales,
    decimal Refunds,
    decimal NetSales,
    decimal Vat,
    decimal Goods,
    decimal Waste,
    decimal Labour,
    List<CategoryTotal>? ExpensesByCategory,
    decimal Expenses,
    decimal Profit,
    decimal? PrimeCostRatio,
    decimal? Margin,
    List<PartnerProfitShareView>? PartnerShares);

public sealed record ProfitMonthView(int Year, int Month, decimal NetSales, decimal Goods, decimal Labour, decimal Expenses, decimal Profit);

public sealed record ExpenseView(
    int Id,
    DateOnly Date,
    int CategoryId,
    LocalizedText? CategoryName,
    decimal Amount,
    int PaidFrom,
    string? PartnerName,
    string? Vendor,
    string? Note,
    string? RecordedBy);

public sealed record ExpensesView(decimal Total, List<CategoryTotal>? ByCategory, List<ExpenseView>? Expenses);

public sealed record ExpenseCategoryView(int Id, LocalizedText? Name, bool IsActive);

public sealed record SupplierView(int Id, string? Name, bool IsActive, decimal Balance);

public sealed record PartnerView(int Id, string? Name, bool IsActive, decimal Balance);

/// <summary>Finance's ExpenseRequest; PaidFrom is the numeric enum (Drawer 0, Bank 1, Partner 2).</summary>
public sealed record ExpenseRequest(DateOnly Date, int CategoryId, decimal Amount, int PaidFrom, int? PartnerId, string? Vendor, string? Note);

public sealed record CreatedResponse(int Id);

// --- Inventory ---------------------------------------------------------------

public sealed record StockLevelView(
    int StockItemId,
    LocalizedText? Name,
    string? Unit,
    bool IsActive,
    decimal OnHand,
    decimal? ReorderLevel,
    decimal AvgUnitCost,
    bool IsLow,
    decimal Value,
    decimal? LastCost,
    DateTime? LastCostAt);

public sealed record UsageReportRow(
    int StockItemId,
    LocalizedText? Name,
    string? Unit,
    decimal Purchased,
    decimal PurchasedValue,
    decimal Sold,
    decimal SoldValue,
    decimal Wasted,
    decimal WastedValue,
    decimal CountVariance,
    decimal CountVarianceValue);

public sealed record UsageReport(
    List<UsageReportRow>? Rows,
    decimal PurchasedValue,
    decimal SoldValue,
    decimal WastedValue,
    decimal CountVarianceValue,
    decimal StockValue);

public sealed record VarianceRow(
    int StockItemId,
    LocalizedText? Name,
    string? Unit,
    decimal Opening,
    decimal Received,
    decimal Theoretical,
    decimal Wasted,
    decimal CountVariance,
    decimal CountVarianceValue,
    decimal Closing,
    decimal? VariancePercent);

public sealed record VarianceReport(
    List<VarianceRow>? Rows,
    decimal OpeningValue,
    decimal ReceivedValue,
    decimal TheoreticalValue,
    decimal WastedValue,
    decimal CountVarianceValue,
    decimal ClosingValue);

// --- Payroll -----------------------------------------------------------------

public sealed record EmployeeView(int Id, string? Name, string? JobTitle, int BranchId, DateOnly StartedOn, bool IsActive, decimal Balance);

public sealed record AttendanceView(int EmployeeId, DateOnly Date, int BranchId, int Status, decimal OvertimeHours);

// --- Catalog -----------------------------------------------------------------

public sealed record CatalogItemDto(
    int Id,
    LocalizedText? Name,
    decimal Price,
    int CatalogTypeId,
    LocalizedText? CatalogTypeName,
    bool IsAvailable,
    bool IsOutOfStock);

public sealed record SetAvailabilityRequest(bool IsAvailable);

// --- Branch settings ---------------------------------------------------------

public sealed record UpdateBranchSettingsRequest(bool? IsOrderingEnabled, bool? IsReservationsEnabled, bool? RequireSignInForTableOrders);
