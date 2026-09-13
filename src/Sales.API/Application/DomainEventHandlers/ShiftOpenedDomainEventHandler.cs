using Chillax.Sales.API.Application.IntegrationEvents.Events;
using Chillax.Sales.Domain.Events;

namespace Chillax.Sales.API.Application.DomainEventHandlers;

/// <summary>
/// Opening the shift opens the branch: the event goes through the outbox so
/// Branch.API flips the flags only once the shift row is committed.
/// </summary>
public class ShiftOpenedDomainEventHandler(
    ISalesIntegrationEventService integrationEvents,
    ILogger<ShiftOpenedDomainEventHandler> logger) : INotificationHandler<ShiftOpenedDomainEvent>
{
    public async Task Handle(ShiftOpenedDomainEvent notification, CancellationToken cancellationToken)
    {
        var shift = notification.Shift;

        logger.LogInformation("Shift {ShiftId} opened for branch {BranchId} - queueing the branch open", shift.Id, shift.BranchId);

        await integrationEvents.AddAndSaveEventAsync(new ShiftOpenedIntegrationEvent(
            shift.Id,
            shift.BranchId,
            shift.OpenedBy,
            shift.OpenedAt,
            shift.OpenedByUserId));
    }
}
