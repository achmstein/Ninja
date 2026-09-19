using Ninja.Sales.API.Application.IntegrationEvents.Events;
using Ninja.Sales.Domain.Events;

namespace Ninja.Sales.API.Application.DomainEventHandlers;

/// <summary>
/// Any change to a ticket nudges the POS floor to refetch.
/// </summary>
public class TicketChangedDomainEventHandler(
    ISalesIntegrationEventService integrationEvents,
    ILogger<TicketChangedDomainEventHandler> logger) : INotificationHandler<TicketChangedDomainEvent>
{
    public async Task Handle(TicketChangedDomainEvent notification, CancellationToken cancellationToken)
    {
        logger.LogInformation("Ticket {TicketId} changed - queueing the floor nudge", notification.Ticket.Id);

        await integrationEvents.AddAndSaveEventAsync(new TicketUpdatedIntegrationEvent(
            notification.Ticket.Id,
            notification.Ticket.BranchId));
    }
}
