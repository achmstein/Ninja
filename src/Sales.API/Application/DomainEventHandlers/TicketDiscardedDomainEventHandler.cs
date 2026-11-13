using Ninja.Sales.API.Application.IntegrationEvents.Events;
using Ninja.Sales.Domain.Events;

namespace Ninja.Sales.API.Application.DomainEventHandlers;

/// <summary>
/// An empty bill thrown away tells Ordering, when it was a table's or a room's: Ordering was told
/// which place it was the bill of when it opened, and is told now that it no longer is.
/// </summary>
public class TicketDiscardedDomainEventHandler(
    ISalesIntegrationEventService integrationEvents,
    ILogger<TicketDiscardedDomainEventHandler> logger) : INotificationHandler<TicketDiscardedDomainEvent>
{
    public async Task Handle(TicketDiscardedDomainEvent notification, CancellationToken cancellationToken)
    {
        var ticket = notification.Ticket;
        if (ticket.PlaceId is null) return;

        logger.LogInformation("Ticket {TicketId} discarded - telling Ordering it is no longer place {PlaceId}'s", ticket.Id, ticket.PlaceId);

        await integrationEvents.AddAndSaveEventAsync(new TicketDiscardedIntegrationEvent(ticket.Id, ticket.BranchId));
    }
}
