#nullable enable
namespace Ninja.Sales.API.Application.Queries;

/// <summary>
/// A shift with its drawer math — the X report while open, the Z report once
/// closed (where <see cref="ExpectedCash"/>/<see cref="OverShort"/> are the
/// frozen verdict).
/// </summary>
public record ShiftView
{
    public int Id { get; init; }
    public int BranchId { get; init; }
    public string Status { get; init; } = string.Empty;
    public DateTime OpenedAt { get; init; }
    public string OpenedBy { get; init; } = string.Empty;
    public decimal OpeningFloat { get; init; }
    public DateTime? ClosedAt { get; init; }
    public string? ClosedBy { get; init; }
    public decimal? ClosingCount { get; init; }
    public decimal? ExpectedCash { get; init; }
    public decimal? OverShort { get; init; }
    public List<CashMovementView> Movements { get; init; } = [];
    public int TicketsSettled { get; init; }
    public decimal SalesTotal { get; init; }
    /// <summary>Bill discounts, line discounts and loyalty lines on the shift's tickets, as a positive number.</summary>
    public decimal Discounts { get; init; }
    public List<TenderTotal> TenderTotals { get; init; } = [];
    public decimal ChangeGiven { get; init; }
    /// <summary>Credit notes issued during the shift, all tenders.</summary>
    public decimal RefundsTotal { get; init; }
    /// <summary>The part of those that left the drawer as cash.</summary>
    public decimal CashRefunds { get; init; }
    public decimal PayInsTotal { get; init; }
    public decimal PayOutsTotal { get; init; }
    /// <summary>
    /// Money taken against customers' tabs during the shift, all tenders.
    /// Not sales — those were counted when the bills went on account — so
    /// it sits beside <see cref="SalesTotal"/>, never inside it.
    /// </summary>
    public decimal TabPaymentsTotal { get; init; }
    /// <summary>The part of those that went into the drawer as cash.</summary>
    public decimal CashTabPayments { get; init; }
    public List<TenderTotal> TabPaymentTenderTotals { get; init; } = [];
    /// <summary>The slips themselves, newest first.</summary>
    public List<TabPaymentView> TabPayments { get; init; } = [];
    /// <summary>Live drawer expectation; equals ExpectedCash once closed.</summary>
    public decimal ExpectedInDrawer { get; init; }
}

/// <summary>A tab payment slip: money a customer handed the till against their tab.</summary>
public record TabPaymentView(
    int Id,
    int Number,
    int BranchId,
    string CustomerId,
    string? CustomerName,
    string Tender,
    decimal Amount,
    string RecordedBy,
    DateTime RecordedAt,
    int? ShiftId);

public record CashMovementView(string Type, decimal Amount, string Reason, string RecordedBy, DateTime RecordedAt, string Kind = "Other", int? EmployeeId = null, string? EmployeeName = null,
    int? SupplierId = null, string? SupplierName = null, int? PartnerId = null, string? PartnerName = null, int? CategoryId = null);

public record TenderTotal(string Tender, decimal Amount, int Count);

/// <summary>
/// Settled sales over a caller-chosen window — the business-day report when
/// the caller passes the branch's day window (the SPA fetches the window from
/// Branch.API; Sales never asks another service, per D5b).
/// </summary>
public record RangeReport
{
    public DateTime From { get; init; }
    public DateTime To { get; init; }
    public int TicketsSettled { get; init; }
    /// <summary>Σ ticket totals — what customers actually paid.</summary>
    public decimal Net { get; init; }
    /// <summary>Bill discounts, line discounts and loyalty (negative) lines, as a positive number.</summary>
    public decimal Discounts { get; init; }
    public decimal ChangeGiven { get; init; }
    public List<TenderTotal> TenderTotals { get; init; } = [];
    public List<TypeTotal> ByType { get; init; } = [];
    /// <summary>Menu money of the settled tickets, before service charge and VAT.</summary>
    public decimal Subtotal { get; init; }
    public decimal ServiceCharge { get; init; }
    public decimal Vat { get; init; }
    /// <summary>Credit notes issued in the window, all tenders — not netted out of <see cref="Net"/>.</summary>
    public decimal Refunds { get; init; }
    public int RefundCount { get; init; }
    /// <summary>Tab payments taken in the window, all tenders — beside <see cref="Net"/>, never inside it.</summary>
    public decimal TabPayments { get; init; }
    public int TabPaymentCount { get; init; }
    public List<TenderTotal> TabPaymentTenderTotals { get; init; } = [];
}

public record TypeTotal(string Type, int Count, decimal Net);

/// <summary>
/// The same window cut four ways: by the hour and weekday the bills were
/// settled (in the caller's clock, hence the offset), by who settled them,
/// and by what was sold. Every figure is settled money; voids are counted
/// beside the cashier who gave them, refunds beside who issued them.
/// </summary>
public record BreakdownReport
{
    public DateTime From { get; init; }
    public DateTime To { get; init; }
    /// <summary>Minutes the caller's clock is ahead of UTC; the hours and weekdays below are in it.</summary>
    public int OffsetMinutes { get; init; }
    public List<HourTotal> ByHour { get; init; } = [];
    public List<WeekdayTotal> ByWeekday { get; init; } = [];
    public List<CashierTotal> ByCashier { get; init; } = [];
    /// <summary>
    /// What sold, by the line's name, biggest first - every item, so the back
    /// office can fold the list into categories through CatalogItemId.
    /// </summary>
    public List<ItemTotal> ByItem { get; init; } = [];
}

public record HourTotal(int Hour, int Count, decimal Net);

/// <summary>0 is Sunday, like <see cref="DayOfWeek"/>.</summary>
public record WeekdayTotal(int Weekday, int Count, decimal Net);

public record CashierTotal(string Name, int Count, decimal Net, decimal Discounts, int Voids, decimal Refunds);

/// <param name="CatalogItemId">The catalog item, when the lines carried one; null groups as uncategorised.</param>
public record ItemTotal(LocalizedText Description, decimal Qty, decimal Amount, int Tickets, int? CatalogItemId = null);
