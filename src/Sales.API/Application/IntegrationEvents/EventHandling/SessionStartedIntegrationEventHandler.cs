#nullable enable
using Chillax.EventBus.Abstractions;
using Chillax.Sales.API.Application.IntegrationEvents.Events;

namespace Chillax.Sales.API.Application.IntegrationEvents.EventHandling;

/// <summary>
/// A room session started — open its ticket. Idempotent: the bus promises
/// at-least-once, so an already-open ticket for the session wins.
/// </summary>
public class SessionStartedIntegrationEventHandler(
    ITicketRepository ticketRepository,
    SalesTransaction transaction,
    ILogger<SessionStartedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<SessionStartedIntegrationEvent>
{
    // One transaction per event, its floor nudge published after the commit
    public Task Handle(SessionStartedIntegrationEvent @event)
        => transaction.RunAsync(nameof(SessionStartedIntegrationEvent), () => Assemble(@event));

    private async Task Assemble(SessionStartedIntegrationEvent @event)
    {
        var existing = await ticketRepository.FindOpenBySessionAsync(@event.ReservationId);

        if (existing is not null)
        {
            logger.LogInformation("Ticket {TicketId} already open for session {SessionId}", existing.Id, @event.ReservationId);
            return;
        }

        var ticket = Ticket.OpenForSession(
            @event.ReservationId,
            @event.RoomId,
            @event.RoomName,
            @event.BranchId);

        ticketRepository.Add(ticket);
        await ticketRepository.UnitOfWork.SaveEntitiesAsync();

        logger.LogInformation("Opened ticket {TicketId} for session {SessionId} in room {RoomId}", ticket.Id, @event.ReservationId, @event.RoomId);
    }
}
