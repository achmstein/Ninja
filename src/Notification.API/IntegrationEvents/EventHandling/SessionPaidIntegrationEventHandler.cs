using Ninja.EventBus.Abstractions;
using Ninja.Notification.API.Hubs;
using Ninja.Notification.API.IntegrationEvents.Events;
using Microsoft.AspNetCore.SignalR;

namespace Ninja.Notification.API.IntegrationEvents.EventHandling;

/// <summary>
/// A room bill was paid: nudge everyone who sat in the room, over the same
/// "RoomStatusChanged" message both apps already refetch their sessions on.
/// </summary>
public class SessionPaidIntegrationEventHandler(
    IHubContext<NotificationHub> hubContext,
    ILogger<SessionPaidIntegrationEventHandler> logger)
    : IIntegrationEventHandler<SessionPaidIntegrationEvent>
{
    public async Task Handle(SessionPaidIntegrationEvent @event)
    {
        logger.LogInformation("Session {SessionId} paid (receipt #{Receipt}) - nudging {Count} member(s)",
            @event.ReservationId, @event.ReceiptNumber, @event.MemberIds.Count);
        foreach (var memberId in @event.MemberIds.Distinct())
        {
            await hubContext.Clients.Group($"user:{memberId}").SendAsync("RoomStatusChanged", new
            {
                type = "session_paid",
                sessionId = @event.ReservationId,
                placeId = @event.PlaceId,
                placeKind = @event.PlaceKind,
                receiptNumber = @event.ReceiptNumber
            });
        }
    }
}
