#nullable enable
using Chillax.Sales.API.Application.IntegrationEvents.Events;
using Chillax.Sales.Domain.Events;

namespace Chillax.Sales.API.Application.DomainEventHandlers;

/// <summary>
/// A supplier, expense or partner movement rides the outbox with the
/// movement that recorded it, so Finance hears of it only once the drawer
/// row is committed.
/// </summary>
public class CashMovedDomainEventHandler(
    ISalesIntegrationEventService integrationEvents,
    ILogger<CashMovedDomainEventHandler> logger) : INotificationHandler<CashMovedDomainEvent>
{
    public async Task Handle(CashMovedDomainEvent notification, CancellationToken cancellationToken)
    {
        var (shift, movement) = notification;

        logger.LogInformation(
            "{Kind} {Type} of {Amount} on shift {ShiftId} - queueing for Finance",
            movement.Kind, movement.Type, movement.Amount, shift.Id);

        await integrationEvents.AddAndSaveEventAsync(new CashMovedIntegrationEvent(
            shift.Id,
            movement.Id,
            shift.BranchId,
            movement.Type.ToString(),
            movement.Kind.ToString(),
            movement.Amount,
            movement.Reason,
            movement.SupplierId,
            movement.PartnerId,
            movement.CategoryId,
            shift.OpenedAt,
            movement.RecordedAt,
            movement.RecordedBy));
    }
}
