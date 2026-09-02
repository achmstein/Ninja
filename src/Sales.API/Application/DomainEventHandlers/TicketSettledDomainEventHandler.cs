using Chillax.Sales.API.Application.IntegrationEvents.Events;
using Chillax.Sales.Domain.Events;

namespace Chillax.Sales.API.Application.DomainEventHandlers;

/// <summary>
/// A settled ticket leaves the floor — same refresh nudge; the richer
/// settled event (with the receipt number) is published by the settle
/// command handler once the receipt exists.
/// </summary>
public class TicketSettledDomainEventHandler(
    ISalesIntegrationEventService integrationEvents,
    ILogger<TicketSettledDomainEventHandler> logger) : INotificationHandler<TicketSettledDomainEvent>
{
    public async Task Handle(TicketSettledDomainEvent notification, CancellationToken cancellationToken)
    {
        logger.LogInformation("Ticket {TicketId} settled - queueing the floor nudge", notification.Ticket.Id);

        await integrationEvents.AddAndSaveEventAsync(new TicketUpdatedIntegrationEvent(
            notification.Ticket.Id,
            notification.Ticket.BranchId));
    }
}
