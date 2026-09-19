using Ninja.Sales.API.Application.IntegrationEvents.Events;
using Ninja.Sales.API.Application.Queries;
using Ninja.Sales.Domain.Events;

namespace Ninja.Sales.API.Application.DomainEventHandlers;

/// <summary>
/// Closing the shift closes the branch: same outbox path as the open, so the
/// flags never go off for a close that rolled back. The event carries the Z
/// figures for the owner's digest: the sales side from the settled tickets
/// (committed long before this), the drawer side from the aggregate itself,
/// since domain events are dispatched before the close is saved.
/// </summary>
public class ShiftClosedDomainEventHandler(
    ISalesIntegrationEventService integrationEvents,
    IShiftQueries queries,
    ILogger<ShiftClosedDomainEventHandler> logger) : INotificationHandler<ShiftClosedDomainEvent>
{
    public async Task Handle(ShiftClosedDomainEvent notification, CancellationToken cancellationToken)
    {
        var shift = notification.Shift;

        logger.LogInformation("Shift {ShiftId} closed for branch {BranchId} - queueing the branch close and the digest", shift.Id, shift.BranchId);

        var sales = await queries.GetShiftAsync(shift.Id);

        await integrationEvents.AddAndSaveEventAsync(new ShiftClosedIntegrationEvent(
            shift.Id,
            shift.BranchId,
            shift.ClosedBy!,
            shift.ClosedAt!.Value,
            SalesTotal: sales?.SalesTotal ?? 0,
            TicketsSettled: sales?.TicketsSettled ?? 0,
            Discounts: sales?.Discounts ?? 0,
            RefundsTotal: sales?.RefundsTotal ?? 0,
            TabPaymentsTotal: sales?.TabPaymentsTotal ?? 0,
            PayInsTotal: shift.GetPayInsTotal(),
            PayOutsTotal: shift.GetPayOutsTotal(),
            OpeningFloat: shift.OpeningFloat,
            ExpectedCash: shift.ExpectedCash ?? 0,
            ClosingCount: shift.ClosingCount ?? 0,
            OverShort: shift.OverShort ?? 0,
            TenderTotals: sales?.TenderTotals
                .Select(t => new ShiftTenderTotal(t.Tender, t.Amount, t.Count))
                .ToList()));
    }
}
