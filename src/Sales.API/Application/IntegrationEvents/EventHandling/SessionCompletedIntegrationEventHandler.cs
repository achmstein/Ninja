#nullable enable
using Ninja.EventBus.Abstractions;
using Ninja.Sales.API.Application.IntegrationEvents.Events;

namespace Ninja.Sales.API.Application.IntegrationEvents.EventHandling;

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
        // Every tariff has at least one rate option, so a stay that ends
        // without its breakdown is a broken contract, not free time: it
        // dead-letters rather than landing as no time at all
        if (@event.Costs is not { Count: > 0 } costs)
            throw new SalesDomainException($"Session {@event.ReservationId} completed without its cost breakdown - its time cannot land.");

        var ticket = await ticketRepository.FindOpenBySessionAsync(@event.ReservationId);

        if (ticket is null)
        {
            // The time is the bulk of a room bill — never drop it just
            // because the start event was missed. A stay is always
            // somewhere, so one that names no place is a broken contract.
            if (@event.PlaceId == 0)
                throw new SalesDomainException($"Session {@event.ReservationId} completed without a place - no ticket to open its time on.");

            ticket = ticketRepository.Add(Ticket.OpenForSession(
                @event.ReservationId,
                @event.PlaceId,
                @event.PlaceName,
                @event.BranchId,
                @event.PlaceKind));

            logger.LogWarning("No open ticket for completed session {SessionId} - opened one late", @event.ReservationId);
        }

        // The time is the room's, not anyone's: it sits under the room's own
        // heading on the bill, and the group splits it at settle however they
        // agree, each share typed onto its own tab. Stamping the owner on it
        // used to put the whole room on one person with a single tap.
        ticket.AppendSessionTime(costs
            .Select(c => new SessionTimeLine(c.OptionName, c.Hours, c.Cost))
            .ToList());

        // Nothing ever landed — no time billed, no orders. An empty room ticket
        // left open would keep the room busy on the floor and block the next
        // session, so it goes the way an emptied table ticket does: discarded
        // in the same transaction (the floor still gets the nudge).
        if (ticket.Lines.Count == 0)
        {
            ticket.Discard();
            ticketRepository.Remove(ticket);
            await ticketRepository.UnitOfWork.SaveEntitiesAsync();

            logger.LogInformation(
                "Session {SessionId} ended with nothing on it - empty ticket {TicketId} discarded",
                @event.ReservationId, ticket.Id);
            return;
        }

        await ticketRepository.UnitOfWork.SaveEntitiesAsync();

        logger.LogInformation(
            "Session {SessionId} time ({Total}) appended to ticket {TicketId}",
            @event.ReservationId, @event.TotalCost, ticket.Id);
    }
}
