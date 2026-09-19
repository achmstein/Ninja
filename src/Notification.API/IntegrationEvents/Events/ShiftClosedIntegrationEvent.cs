using Ninja.EventBus.Events;

namespace Ninja.Notification.API.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the event Sales publishes when a drawer shift closes,
/// carrying the Z report's figures: what the day's digest to the owner is
/// made of. Amounts are the branch's currency; rates never travel here.
/// </summary>
public record ShiftClosedIntegrationEvent(
    int ShiftId,
    int BranchId,
    string ClosedBy,
    DateTime ClosedAt,
    decimal SalesTotal = 0,
    int TicketsSettled = 0,
    decimal Discounts = 0,
    decimal RefundsTotal = 0,
    decimal TabPaymentsTotal = 0,
    decimal PayInsTotal = 0,
    decimal PayOutsTotal = 0,
    decimal OpeningFloat = 0,
    decimal ExpectedCash = 0,
    decimal ClosingCount = 0,
    decimal OverShort = 0,
    IReadOnlyCollection<ShiftTenderTotal>? TenderTotals = null) : IntegrationEvent;

/// <summary>One tender's share of the shift's sales: "Cash", "Card", "InstaPay" or "Account".</summary>
public record ShiftTenderTotal(string Tender, decimal Amount, int Count);
