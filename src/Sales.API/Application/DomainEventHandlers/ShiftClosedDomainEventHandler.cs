using Chillax.Sales.API.Application.IntegrationEvents.Events;
using Chillax.Sales.Domain.Events;

namespace Chillax.Sales.API.Application.DomainEventHandlers;

/// <summary>
/// Closing the shift closes the branch: same outbox path as the open, so the
/// flags never go off for a close that rolled back.
/// </summary>
public class ShiftClosedDomainEventHandler(
    ISalesIntegrationEventService integrationEvents,
    ILogger<ShiftClosedDomainEventHandler> logger) : INotificationHandler<ShiftClosedDomainEvent>
{
    public async Task Handle(ShiftClosedDomainEvent notification, CancellationToken cancellationToken)
    {
        var shift = notification.Shift;

        logger.LogInformation("Shift {ShiftId} closed for branch {BranchId} - queueing the branch close", shift.Id, shift.BranchId);

        await integrationEvents.AddAndSaveEventAsync(new ShiftClosedIntegrationEvent(
            shift.Id,
            shift.BranchId,
            shift.ClosedBy!,
            shift.ClosedAt!.Value));
    }
}
