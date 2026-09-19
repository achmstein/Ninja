#nullable enable
using Ninja.EventBus.Abstractions;
using Ninja.Sales.API.Application.IntegrationEvents.Events;

namespace Ninja.Sales.API.Application.IntegrationEvents.EventHandling;

/// <summary>
/// Somebody joined a room session: they belong on its ticket, so the receipt
/// is theirs to read once the bill is paid. Idempotent — the ticket ignores
/// a member it already has.
/// </summary>
public class SessionMemberJoinedIntegrationEventHandler(
    ITicketRepository ticketRepository,
    SalesTransaction transaction,
    ILogger<SessionMemberJoinedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<SessionMemberJoinedIntegrationEvent>
{
    public Task Handle(SessionMemberJoinedIntegrationEvent @event)
        => transaction.RunAsync(nameof(SessionMemberJoinedIntegrationEvent), () => Note(@event));

    private async Task Note(SessionMemberJoinedIntegrationEvent @event)
    {
        var ticket = await ticketRepository.FindOpenBySessionAsync(@event.ReservationId);
        if (ticket is null)
        {
            logger.LogWarning("Member {UserId} joined session {SessionId}, which has no open ticket", @event.MemberUserId, @event.ReservationId);
            return;
        }
        if (!ticket.AddMember(@event.MemberUserId))
        {
            return;
        }
        await ticketRepository.UnitOfWork.SaveEntitiesAsync();
        logger.LogInformation("Ticket {TicketId} notes member {UserId} of session {SessionId}", ticket.Id, @event.MemberUserId, @event.ReservationId);
    }
}
