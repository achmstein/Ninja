#nullable enable
using Chillax.EventBus.Abstractions;
using Chillax.Sales.API.Application.IntegrationEvents.Events;

namespace Chillax.Sales.API.Application.IntegrationEvents.EventHandling;

/// <summary>
/// A walk-in session got its customer: they belong on its ticket, so the
/// receipt is theirs to read once the bill is paid. Idempotent.
/// </summary>
public class SessionCustomerAssignedIntegrationEventHandler(
    ITicketRepository ticketRepository,
    SalesTransaction transaction,
    ILogger<SessionCustomerAssignedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<SessionCustomerAssignedIntegrationEvent>
{
    public Task Handle(SessionCustomerAssignedIntegrationEvent @event)
        => transaction.RunAsync(nameof(SessionCustomerAssignedIntegrationEvent), () => Note(@event));

    private async Task Note(SessionCustomerAssignedIntegrationEvent @event)
    {
        var ticket = await ticketRepository.FindOpenBySessionAsync(@event.ReservationId);
        if (ticket is null)
        {
            logger.LogWarning("Customer {UserId} assigned to session {SessionId}, which has no open ticket", @event.CustomerId, @event.ReservationId);
            return;
        }
        if (!ticket.AddMember(@event.CustomerId))
        {
            return;
        }
        await ticketRepository.UnitOfWork.SaveEntitiesAsync();
        logger.LogInformation("Ticket {TicketId} notes customer {UserId} of session {SessionId}", ticket.Id, @event.CustomerId, @event.ReservationId);
    }
}
