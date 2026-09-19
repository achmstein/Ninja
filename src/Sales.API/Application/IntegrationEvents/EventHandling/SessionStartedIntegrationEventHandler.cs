#nullable enable
using Ninja.EventBus.Abstractions;
using Ninja.Sales.API.Application.IntegrationEvents.Events;

namespace Ninja.Sales.API.Application.IntegrationEvents.EventHandling;

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
            if (@event.CustomerId is not null && existing.AddMember(@event.CustomerId))
            {
                await ticketRepository.UnitOfWork.SaveEntitiesAsync();
            }
            return;
        }

        // LEGACY(places): a publisher older than the Places remodel sends no place fields; its RoomId/RoomName are the place's — remove when every till and customer app is on /api/places and /api/stays.
        var ticket = Ticket.OpenForSession(
            @event.ReservationId,
            @event.PlaceId != 0 ? @event.PlaceId : @event.RoomId,
            @event.PlaceName ?? @event.RoomName,
            @event.BranchId,
            @event.PlaceKind);

        // The reserving customer sat in the room from the start
        if (@event.CustomerId is not null)
        {
            ticket.AddMember(@event.CustomerId);
        }
        ticketRepository.Add(ticket);
        await ticketRepository.UnitOfWork.SaveEntitiesAsync();

        logger.LogInformation("Opened ticket {TicketId} for session {SessionId} at place {PlaceId}", ticket.Id, @event.ReservationId, ticket.PlaceId);
    }
}
