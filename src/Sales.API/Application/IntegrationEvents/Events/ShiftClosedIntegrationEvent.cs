using Ninja.EventBus.Events;

namespace Ninja.Sales.API.Application.IntegrationEvents.Events;

/// <summary>
/// The drawer shift was closed. Tenant.API switches the branch's ordering and
/// reservation flags off — the counterpart of <see cref="ShiftOpenedIntegrationEvent"/>
/// — and Notification pushes the figures to the owner's devices as the day's
/// digest. They are the Z report's: sales and bills, the tender split, the
/// drawer's float, expected, counted and over/short, and what left as
/// discounts, refunds, tab payments and cash movements.
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

/// <summary>One tender's share of the shift's sales.</summary>
public record ShiftTenderTotal(string Tender, decimal Amount, int Count);
