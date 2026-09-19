using Ninja.EventBus.Abstractions;
using Ninja.Notification.API.Hubs;
using Ninja.Notification.API.IntegrationEvents.Events;
using Ninja.Notification.API.Model;
using Ninja.Notification.API.Services;
using Microsoft.AspNetCore.SignalR;

namespace Ninja.Notification.API.IntegrationEvents.EventHandling;

public class SessionStartedIntegrationEventHandler(
    NotificationContext context,
    IFcmService fcmService,
    IHubContext<NotificationHub> hubContext,
    ILogger<SessionStartedIntegrationEventHandler> logger) : IIntegrationEventHandler<SessionStartedIntegrationEvent>
{
    public async Task Handle(SessionStartedIntegrationEvent @event)
    {
        logger.LogInformation("Handling SessionStartedIntegrationEvent: ReservationId={ReservationId}, PlaceId={PlaceId}",
            @event.ReservationId, @event.PlaceId);

        // Broadcast via SignalR to rooms group so client screens refresh
        await hubContext.Clients.Group("rooms").SendAsync("RoomStatusChanged", new
        {
            type = "session_started",
            placeId = @event.PlaceId,
            placeKind = @event.PlaceKind,
            reservationId = @event.ReservationId
        });

        // Also notify the specific customer if they're connected
        if (!string.IsNullOrEmpty(@event.CustomerId))
        {
            await hubContext.Clients.Group($"user:{@event.CustomerId}").SendAsync("RoomStatusChanged", new
            {
                type = "session_started",
                placeId = @event.PlaceId,
                placeKind = @event.PlaceKind,
                reservationId = @event.ReservationId
            });

            // Send FCM data message to the customer for session notification
            await SendSessionStartedFcm(@event, @event.CustomerId);
        }
    }

    private async Task SendSessionStartedFcm(SessionStartedIntegrationEvent @event, string userId)
    {
        var subscriptions = await context.Subscriptions
            .Where(s => s.UserId == userId && s.Type == SubscriptionType.UserSessionNotification)
            .ToListAsync();

        if (subscriptions.Count == 0)
        {
            logger.LogInformation("No session notification subscription found for user {UserId}", userId);
            return;
        }

        var startTimeMs = @event.ActualStartTime?.ToUniversalTime()
            .Subtract(DateTime.UnixEpoch).TotalMilliseconds.ToString("0") ?? "";

        var allUnregisteredTokens = new List<string>();

        foreach (var group in subscriptions.GroupBy(s => s.PreferredLanguage))
        {
            var lang = group.Key;
            var tokens = group.Select(s => s.FcmToken).ToList();
            var data = new Dictionary<string, string>
            {
                { "type", "session_started" },
                { "sessionId", @event.ReservationId.ToString() },
                { "placeId", @event.PlaceId.ToString() },
                { "placeKind", @event.PlaceKind },
                { "placeName", @event.PlaceName.GetText(lang) },
                { "placeNameEn", @event.PlaceName.GetText("en") },
                { "placeNameAr", @event.PlaceName.GetText("ar") },
                { "startTimeMs", startTimeMs },
                { "locale", lang },
                { "optionCode", @event.OptionCode ?? string.Empty }
            };

            var result = await fcmService.SendBatchDataMessagesAsync(tokens, data);
            allUnregisteredTokens.AddRange(result.UnregisteredTokens);
            logger.LogInformation("Sent {SuccessCount}/{TotalCount} session started FCM to user {UserId} in {Lang}",
                result.SuccessCount, tokens.Count, userId, lang);
        }

        if (allUnregisteredTokens.Count > 0)
        {
            var staleSubscriptions = subscriptions
                .Where(s => allUnregisteredTokens.Contains(s.FcmToken))
                .ToList();
            context.Subscriptions.RemoveRange(staleSubscriptions);
            await context.SaveChangesAsync();
            logger.LogWarning("Removed {Count} subscriptions with unregistered FCM tokens", staleSubscriptions.Count);
        }
    }
}
