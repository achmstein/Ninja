using Ninja.EventBus.Abstractions;
using Ninja.Notification.API.Hubs;
using Ninja.Notification.API.IntegrationEvents.Events;
using Ninja.Notification.API.Localization;
using Ninja.Notification.API.Model;
using Ninja.Notification.API.Services;
using Microsoft.AspNetCore.SignalR;

namespace Ninja.Notification.API.IntegrationEvents.EventHandling;

public class RoomBecameAvailableIntegrationEventHandler(
    NotificationContext context,
    IFcmService fcmService,
    IHubContext<NotificationHub> hubContext,
    ILogger<RoomBecameAvailableIntegrationEventHandler> logger) : IIntegrationEventHandler<RoomBecameAvailableIntegrationEvent>
{
    public async Task Handle(RoomBecameAvailableIntegrationEvent @event)
    {
        logger.LogInformation("Handling RoomBecameAvailableIntegrationEvent for room {RoomId}: {RoomName}",
            @event.RoomId, @event.RoomName.En);

        // Get room availability subscriptions for this branch
        var subscriptions = await context.Subscriptions
            .Where(s => s.Type == SubscriptionType.RoomAvailability
                && (s.BranchId == null || s.BranchId == @event.BranchId))
            .ToListAsync();

        if (subscriptions.Count > 0)
        {
            logger.LogInformation("Found {Count} subscriptions to notify", subscriptions.Count);

            // Group by language and send localized notifications
            var totalSuccess = 0;
            foreach (var group in subscriptions.GroupBy(s => s.PreferredLanguage))
            {
                var lang = group.Key;
                var tokens = group.Select(s => s.FcmToken).ToList();
                var title = NotificationMessages.RoomAvailableTitle.GetText(lang);
                var body = NotificationMessages.RoomAvailableBody(@event.RoomName, lang).GetText(lang);

                var result = await fcmService.SendBatchNotificationsAsync(
                    tokens,
                    title,
                    body,
                    new Dictionary<string, string>
                    {
                        { "type", "room_available" },
                        { "roomId", @event.RoomId.ToString() },
                        { "roomName", @event.RoomName.GetText(lang) }
                    });

                totalSuccess += result.SuccessCount;
                logger.LogInformation("Sent {SuccessCount}/{TotalCount} notifications in {Lang}",
                    result.SuccessCount, tokens.Count, lang);
            }

            logger.LogInformation("Sent {SuccessCount}/{TotalCount} total notifications successfully",
                totalSuccess, subscriptions.Count);

            // Delete all subscriptions (one-time notification)
            context.Subscriptions.RemoveRange(subscriptions);
            await context.SaveChangesAsync();

            logger.LogInformation("Deleted {Count} subscriptions after notification", subscriptions.Count);
        }
        else
        {
            logger.LogInformation("No subscriptions found for room availability notifications");
        }

        // Always broadcast via SignalR to connected clients
        await hubContext.Clients.Group("rooms").SendAsync("RoomStatusChanged", new
        {
            type = "room_available",
            // LEGACY(places): roomId beside placeId, and the RoomId fallback for a PlaceId-less event — remove when every till and customer app is on /api/places and /api/stays.
            roomId = @event.RoomId,
            placeId = @event.PlaceId != 0 ? @event.PlaceId : @event.RoomId,
            placeKind = @event.PlaceKind
        });
    }
}
