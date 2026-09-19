using Ninja.EventBus.Abstractions;
using Ninja.Notification.API.Hubs;
using Ninja.Notification.API.IntegrationEvents.Events;
using Ninja.Notification.API.Localization;
using Ninja.Notification.API.Model;
using Ninja.Notification.API.Services;
using Microsoft.AspNetCore.SignalR;

namespace Ninja.Notification.API.IntegrationEvents.EventHandling;

public class RoomReservedIntegrationEventHandler(
    NotificationContext context,
    IFcmService fcmService,
    IHubContext<NotificationHub> hubContext,
    ILogger<RoomReservedIntegrationEventHandler> logger) : IIntegrationEventHandler<RoomReservedIntegrationEvent>
{
    public async Task Handle(RoomReservedIntegrationEvent @event)
    {
        logger.LogInformation("Handling RoomReservedIntegrationEvent: ReservationId={ReservationId}, Place={PlaceName}, Customer={CustomerName}",
            @event.ReservationId, @event.PlaceName.En, @event.CustomerName);

        // Broadcast via SignalR first — live dashboards must not depend on
        // whether any FCM push subscriptions exist
        await hubContext.Clients.Group("rooms").SendAsync("RoomStatusChanged", new
        {
            type = "room_reserved",
            placeId = @event.PlaceId,
            placeKind = @event.PlaceKind,
            reservationId = @event.ReservationId
        });

        // Get admin reservation notification subscriptions for this branch
        var subscriptions = await context.Subscriptions
            .Where(s => s.Type == SubscriptionType.AdminReservationNotification
                && (s.BranchId == null || s.BranchId == @event.BranchId))
            .ToListAsync();

        if (subscriptions.Count == 0)
        {
            logger.LogInformation("No admin subscriptions found for reservation notifications");
            return;
        }

        logger.LogInformation("Found {Count} admin subscriptions to notify about reservation", subscriptions.Count);

        var customerDisplay = @event.CustomerName ?? "Customer";
        var totalSuccess = 0;
        var allUnregisteredTokens = new List<string>();

        // Group by language and send localized notifications
        foreach (var group in subscriptions.GroupBy(s => s.PreferredLanguage))
        {
            var lang = group.Key;
            var tokens = group.Select(s => s.FcmToken).ToList();
            var title = NotificationMessages.NewReservationTitle.GetText(lang);
            var body = NotificationMessages.NewReservationBody(customerDisplay, @event.PlaceName, lang).GetText(lang);

            var result = await fcmService.SendBatchNotificationsAsync(
                tokens,
                title,
                body,
                new Dictionary<string, string>
                {
                    { "type", "new_reservation" },
                    { "reservationId", @event.ReservationId.ToString() },
                    { "placeId", @event.PlaceId.ToString() },
                    { "placeKind", @event.PlaceKind },
                    { "placeName", @event.PlaceName.GetText(lang) },
                    { "customerName", @event.CustomerName ?? "" },
                    { "customerId", @event.CustomerId ?? "" }
                });

            totalSuccess += result.SuccessCount;
            allUnregisteredTokens.AddRange(result.UnregisteredTokens);
            logger.LogInformation("Sent {SuccessCount}/{TotalCount} notifications in {Lang}",
                result.SuccessCount, tokens.Count, lang);
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

        logger.LogInformation("Sent {SuccessCount}/{TotalCount} admin reservation notifications successfully",
            totalSuccess, subscriptions.Count);

        // Note: Admin subscriptions are persistent - do NOT delete them
    }
}
