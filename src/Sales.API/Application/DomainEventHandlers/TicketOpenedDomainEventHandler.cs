using Ninja.Sales.API.Application.IntegrationEvents.Events;
using Ninja.Sales.Domain.Events;

namespace Ninja.Sales.API.Application.DomainEventHandlers;

/// <summary>
/// A bill opened at a table or a room tells Ordering which place it is the bill of, with the save
/// that opened it. A counter bill has no place and says nothing.
/// </summary>
public class TicketOpenedDomainEventHandler(
    ISalesIntegrationEventService integrationEvents,
    ILogger<TicketOpenedDomainEventHandler> logger) : INotificationHandler<TicketOpenedDomainEvent>
{
    public async Task Handle(TicketOpenedDomainEvent notification, CancellationToken cancellationToken)
    {
        var ticket = notification.Ticket;
        if (ticket.PlaceId is not { } placeId) return;

        logger.LogInformation("Ticket {TicketId} opened at place {PlaceId} - telling Ordering", ticket.Id, placeId);

        await integrationEvents.AddAndSaveEventAsync(new TicketOpenedIntegrationEvent(
            ticket.Id, ticket.BranchId, placeId, ticket.PlaceKind, ticket.LocationName));
    }
}
