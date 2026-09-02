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
    ILogger<SessionCompletedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<SessionCompletedIntegrationEvent>
{
    public async Task Handle(SessionCompletedIntegrationEvent @event)
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
                @event.BranchId,
                @event.CustomerId,
                customerName: null));

            logger.LogWarning("No open ticket for completed session {SessionId} - opened one late", @event.ReservationId);
        }

        ticket.AppendSessionTime(@event.SingleDuration, @event.SingleCost, @event.MultiDuration, @event.MultiCost);

        await ticketRepository.UnitOfWork.SaveEntitiesAsync();

        logger.LogInformation(
            "Session {SessionId} time ({Total}) appended to ticket {TicketId}",
            @event.ReservationId, @event.TotalCost, ticket.Id);
    }
}
