using Chillax.EventBus.Abstractions;
using Chillax.Notification.API.Hubs;
using Chillax.Notification.API.IntegrationEvents.Events;
using Chillax.Notification.API.Model;
using Chillax.Notification.API.Services;
using Microsoft.AspNetCore.SignalR;

namespace Chillax.Notification.API.IntegrationEvents.EventHandling;

public class SessionEndedIntegrationEventHandler(
    NotificationContext context,
    IFcmService fcmService,
    IHubContext<NotificationHub> hubContext,
    ILogger<SessionEndedIntegrationEventHandler> logger) : IIntegrationEventHandler<SessionEndedIntegrationEvent>
{
    public async Task Handle(SessionEndedIntegrationEvent @event)
    {
        logger.LogInformation("Handling SessionEndedIntegrationEvent: ReservationId={ReservationId}, RoomId={RoomId}, Members={MemberCount}",
            @event.ReservationId, @event.RoomId, @event.MemberUserIds.Count);

        // Broadcast via SignalR
        await hubContext.Clients.Group("rooms").SendAsync("RoomStatusChanged", new
        {
            type = "session_ended",
            // LEGACY(places): roomId beside placeId, and the RoomId fallback for a PlaceId-less event — remove when every till and customer app is on /api/places and /api/stays.
            roomId = @event.RoomId,
            placeId = @event.PlaceId != 0 ? @event.PlaceId : @event.RoomId,
            placeKind = @event.PlaceKind,
            reservationId = @event.ReservationId
        });

        if (@event.MemberUserIds.Count == 0)
            return;

        // Get all session notification subscriptions for these members
        var subscriptions = await context.Subscriptions
            .Where(s => @event.MemberUserIds.Contains(s.UserId)
                && s.Type == SubscriptionType.UserSessionNotification)
            .ToListAsync();

        if (subscriptions.Count == 0)
        {
            logger.LogInformation("No session notification subscriptions found for session members");
            return;
        }

        var data = new Dictionary<string, string>
        {
            { "type", "session_ended" },
            { "sessionId", @event.ReservationId.ToString() },
            { "roomId", @event.RoomId.ToString() }
        };

        var tokens = subscriptions.Select(s => s.FcmToken).ToList();
        var result = await fcmService.SendBatchDataMessagesAsync(tokens, data);

        logger.LogInformation("Sent {SuccessCount}/{TotalCount} session ended FCM notifications",
            result.SuccessCount, tokens.Count);

        if (result.UnregisteredTokens.Count > 0)
        {
            var staleSubscriptions = subscriptions
                .Where(s => result.UnregisteredTokens.Contains(s.FcmToken))
                .ToList();
            context.Subscriptions.RemoveRange(staleSubscriptions);
            await context.SaveChangesAsync();
            logger.LogWarning("Removed {Count} subscriptions with unregistered FCM tokens", staleSubscriptions.Count);
        }
    }
}
