using Chillax.EventBus.Abstractions;
using Chillax.Sales.API.Application.IntegrationEvents.Events;
using Chillax.Sales.Domain.Events;

namespace Chillax.Sales.API.Application.DomainEventHandlers;

/// <summary>
/// A settled ticket leaves the floor — same refresh nudge; the richer
/// settled event (with the receipt number) is published by the settle
/// command handler once the receipt exists.
/// </summary>
public class TicketSettledDomainEventHandler(
    IEventBus eventBus,
    ILogger<TicketSettledDomainEventHandler> logger) : INotificationHandler<TicketSettledDomainEvent>
{
    public async Task Handle(TicketSettledDomainEvent notification, CancellationToken cancellationToken)
    {
        logger.LogInformation("Ticket {TicketId} settled - publishing update", notification.Ticket.Id);

        await eventBus.PublishAsync(new TicketUpdatedIntegrationEvent(
            notification.Ticket.Id,
            notification.Ticket.BranchId));
    }
}
