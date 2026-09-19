#nullable enable
using Ninja.EventBus.Abstractions;
using Ninja.Sales.API.Application.IntegrationEvents.Events;

namespace Ninja.Sales.API.Application.IntegrationEvents.EventHandling;

/// <summary>
/// A session was cancelled rather than completed, so no time will ever land
/// on its ticket. A reservation that never started has no ticket at all; an
/// active session's still-empty ticket is dropped so it stops sitting on the
/// floor. One that already carries orders stays open — somebody served
/// those, so somebody settles or voids them — and a warning names it.
/// </summary>
public class ReservationCancelledIntegrationEventHandler(
    ITicketRepository ticketRepository,
    SalesTransaction transaction,
    ILogger<ReservationCancelledIntegrationEventHandler> logger)
    : IIntegrationEventHandler<ReservationCancelledIntegrationEvent>
{
    // One transaction per event, its floor nudge published after the commit
    public Task Handle(ReservationCancelledIntegrationEvent @event)
        => transaction.RunAsync(nameof(ReservationCancelledIntegrationEvent), () => Assemble(@event));

    private async Task Assemble(ReservationCancelledIntegrationEvent @event)
    {
        var ticket = await ticketRepository.FindOpenBySessionAsync(@event.ReservationId);

        if (ticket is null)
        {
            logger.LogInformation("Session {SessionId} cancelled with no open ticket - nothing to drop", @event.ReservationId);
            return;
        }

        if (ticket.Lines.Count > 0)
        {
            logger.LogWarning(
                "Session {SessionId} cancelled but ticket {TicketId} already has {Lines} line(s) - left open to settle or void",
                @event.ReservationId, ticket.Id, ticket.Lines.Count);

            // No time will ever land on it now; recording that is what lets the
            // owner settle or void it (a running session blocks both)
            ticket.MarkSessionCancelled();
            await ticketRepository.UnitOfWork.SaveEntitiesAsync();
            return;
        }

        ticket.DiscardForCancelledSession();
        ticketRepository.Remove(ticket);

        await ticketRepository.UnitOfWork.SaveEntitiesAsync();

        logger.LogInformation("Dropped empty ticket {TicketId} of cancelled session {SessionId}", ticket.Id, @event.ReservationId);
    }
}
