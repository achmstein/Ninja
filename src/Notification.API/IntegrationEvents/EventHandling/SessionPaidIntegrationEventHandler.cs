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
                // LEGACY(places): roomId beside placeId, and the RoomId fallback for a PlaceId-less event — remove when every till and customer app is on /api/places and /api/stays.
                roomId = @event.RoomId,
                placeId = @event.PlaceId != 0 ? @event.PlaceId : @event.RoomId,
                placeKind = @event.PlaceKind,
                receiptNumber = @event.ReceiptNumber
            });
        }
    }
}
