using Ninja.Sales.API.Application.IntegrationEvents.Events;
using Ninja.Sales.Domain.Events;

namespace Ninja.Sales.API.Application.DomainEventHandlers;

/// <summary>
/// A customer's lines landed on a room's bill: Spaces owns who is in the
/// room, so it is told, and the party comes back to the ticket the way any
/// joiner does (SessionMemberJoined).
/// </summary>
public class CustomersMovedToSessionDomainEventHandler(
    ISalesIntegrationEventService integrationEvents,
    ILogger<CustomersMovedToSessionDomainEventHandler> logger) : INotificationHandler<CustomersMovedToSessionDomainEvent>
{
    public async Task Handle(CustomersMovedToSessionDomainEvent notification, CancellationToken cancellationToken)
    {
        var ticket = notification.Ticket;
        if (ticket.SessionId is not int sessionId || notification.Customers.Count == 0) return;

        logger.LogInformation(
            "{Count} customer(s) moved onto ticket {TicketId} - telling Spaces they are in session {SessionId}",
            notification.Customers.Count, ticket.Id, sessionId);

        await integrationEvents.AddAndSaveEventAsync(new TicketCustomersMovedToSessionIntegrationEvent(
            ticket.Id,
            sessionId,
            ticket.BranchId,
            [.. notification.Customers.Select(c => new MovedSessionCustomer(c.CustomerId, c.CustomerName))]));
    }
}
