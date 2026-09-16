using Chillax.EventBus.Abstractions;
using Chillax.Spaces.API.Application.IntegrationEvents.Events;
using Chillax.Spaces.Domain.AggregatesModel.ReservationAggregate;
using Microsoft.Extensions.Logging;

namespace Chillax.Spaces.API.Application.IntegrationEvents.EventHandling;

/// <summary>
/// The till paid a room bill: the session it covered learns its receipt
/// number and tender, which is what the customer's session list shows next
/// to the cost. A direct write like the branch-settings projection — the
/// aggregate raises no domain event for this. Idempotent: a receipt already
/// carried is ignored.
/// </summary>
public class TicketSettledIntegrationEventHandler(
    IReservationRepository reservations,
    IEventBus eventBus,
    ILogger<TicketSettledIntegrationEventHandler> logger)
    : IIntegrationEventHandler<TicketSettledIntegrationEvent>
{
    public async Task Handle(TicketSettledIntegrationEvent @event)
    {
        if (@event.SessionId is not { } sessionId)
        {
            return;
        }
        var reservation = await reservations.GetWithMembersAsync(sessionId);
        if (reservation is null)
        {
            logger.LogWarning("Ticket {TicketId} settled session {SessionId}, which Spaces does not know", @event.TicketId, sessionId);
            return;
        }
        var at = @event.SettledAt == default ? @event.CreationDate : @event.SettledAt;
        if (!reservation.MarkPaid(@event.ReceiptNumber, @event.Tender ?? "Mixed", at, @event.TicketId))
        {
            return;
        }
        reservations.Update(reservation);
        await reservations.UnitOfWork.SaveEntitiesAsync();
        logger.LogInformation("Session {SessionId} paid on receipt #{Receipt} ({Tender})", sessionId, @event.ReceiptNumber, @event.Tender);

        // Everyone who sat in the room gets their session list refreshed
        var members = reservation.SessionMembers.Select(m => m.CustomerId)
            .Concat(reservation.CustomerId is { } owner ? [owner] : [])
            .Where(id => !string.IsNullOrEmpty(id))
            .Distinct()
            .ToList();
        await eventBus.PublishAsync(new SessionPaidIntegrationEvent(
            reservation.Id, reservation.RoomId, members, @event.ReceiptNumber, @event.BranchId));
    }
}
