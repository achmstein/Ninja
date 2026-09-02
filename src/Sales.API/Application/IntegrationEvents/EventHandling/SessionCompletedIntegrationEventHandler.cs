#nullable enable
using Chillax.EventBus.Abstractions;
using Chillax.Sales.API.Application.IntegrationEvents.Events;

namespace Chillax.Sales.API.Application.IntegrationEvents.EventHandling;

/// <summary>
/// The session ended — its authoritative time lines land on the ticket.
/// Rounding stays owned by Spaces; this handler never recomputes, and
/// <see cref="Ticket.AppendSessionTime"/> makes redelivery a no-op.
/// </summary>
public class SessionCompletedIntegrationEventHandler(
    ITicketRepository ticketRepository,
    SalesTransaction transaction,
    ILogger<SessionCompletedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<SessionCompletedIntegrationEvent>
{
    // One transaction per event, its floor nudge published after the commit
    public Task Handle(SessionCompletedIntegrationEvent @event)
        => transaction.RunAsync(nameof(SessionCompletedIntegrationEvent), () => Assemble(@event));

    private async Task Assemble(SessionCompletedIntegrationEvent @event)
    {
        var ticket = await ticketRepository.FindOpenBySessionAsync(@event.ReservationId);

        if (ticket is null)
        {
            // The time is the bulk of a room bill — never drop it just
            // because the start event was missed
            ticket = ticketRepository.Add(Ticket.OpenForSession(
                @event.ReservationId,
                @event.RoomId,
                @event.RoomName,
                @event.BranchId));

            logger.LogWarning("No open ticket for completed session {SessionId} - opened one late", @event.ReservationId);
        }

        // The time is the owner's: it lands with their account, so a room
        // that only bought time can still go on their tab at settle. Their
        // name is the label the ticket opened with — the one snapshot of it
        // Sales holds.
        ticket.AppendSessionTime(
            @event.SingleDuration, @event.SingleCost, @event.MultiDuration, @event.MultiCost,
            customerId: @event.CustomerId,
            customerName: ticket.Label);

        await ticketRepository.UnitOfWork.SaveEntitiesAsync();

        logger.LogInformation(
            "Session {SessionId} time ({Total}) appended to ticket {TicketId}",
            @event.ReservationId, @event.TotalCost, ticket.Id);
    }
}
