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

        // A stay is always somewhere: one that names no place is a broken
        // contract, and dead-letters rather than opening a ticket nowhere
        if (@event.PlaceId == 0)
            throw new SalesDomainException($"Session {@event.ReservationId} started without a place - no ticket to open.");

        var ticket = Ticket.OpenForSession(
            @event.ReservationId,
            @event.PlaceId,
            @event.PlaceName,
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
