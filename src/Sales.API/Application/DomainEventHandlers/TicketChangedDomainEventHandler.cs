using Chillax.EventBus.Abstractions;
using Chillax.Sales.API.Application.IntegrationEvents.Events;
using Chillax.Sales.Domain.Events;

namespace Chillax.Sales.API.Application.DomainEventHandlers;

/// <summary>
/// Any change to a ticket nudges the POS floor to refetch.
/// </summary>
public class TicketChangedDomainEventHandler(
    IEventBus eventBus,
    ILogger<TicketChangedDomainEventHandler> logger) : INotificationHandler<TicketChangedDomainEvent>
{
    public async Task Handle(TicketChangedDomainEvent notification, CancellationToken cancellationToken)
    {
        logger.LogInformation("Ticket {TicketId} changed - publishing update", notification.Ticket.Id);

        await eventBus.PublishAsync(new TicketUpdatedIntegrationEvent(
            notification.Ticket.Id,
            notification.Ticket.BranchId));
    }
}
