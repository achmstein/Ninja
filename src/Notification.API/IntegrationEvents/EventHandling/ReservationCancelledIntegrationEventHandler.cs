using Ninja.EventBus.Abstractions;
using Ninja.Notification.API.Hubs;
using Ninja.Notification.API.IntegrationEvents.Events;
using Ninja.Notification.API.Localization;
using Ninja.Notification.API.Model;
using Ninja.Notification.API.Services;
using Microsoft.AspNetCore.SignalR;

namespace Ninja.Notification.API.IntegrationEvents.EventHandling;

public class ReservationCancelledIntegrationEventHandler(
    NotificationContext context,
    IFcmService fcmService,
    IHubContext<NotificationHub> hubContext,
    TenantArabic arabic,
    ILogger<ReservationCancelledIntegrationEventHandler> logger) : IIntegrationEventHandler<ReservationCancelledIntegrationEvent>
{
    public async Task Handle(ReservationCancelledIntegrationEvent @event)
    {
        logger.LogInformation("Handling ReservationCancelledIntegrationEvent: ReservationId={ReservationId}, Place={PlaceName}, Customer={CustomerName}",
            @event.ReservationId, @event.PlaceName.En, @event.CustomerName);

        // Broadcast via SignalR first — live dashboards must not depend on
        // whether any FCM push subscriptions exist
        await hubContext.Clients.Group("rooms").SendAsync("RoomStatusChanged", new
        {
            type = "reservation_cancelled",
            placeId = @event.PlaceId,
            placeKind = @event.PlaceKind,
            reservationId = @event.ReservationId
        });

        if (!string.IsNullOrEmpty(@event.CustomerId))
        {
            await hubContext.Clients.Group($"user:{@event.CustomerId}").SendAsync("RoomStatusChanged", new
            {
                type = "reservation_cancelled",
                placeId = @event.PlaceId,
                placeKind = @event.PlaceKind,
                reservationId = @event.ReservationId
            });
        }

        // Get admin reservation notification subscriptions for this branch
        var subscriptions = await context.Subscriptions
            .Where(s => s.Type == SubscriptionType.AdminReservationNotification
                && (s.BranchId == null || s.BranchId == @event.BranchId))
            .ToListAsync();

        if (subscriptions.Count == 0)
        {
            logger.LogInformation("No admin subscriptions found for reservation cancellation notifications");
            return;
        }

        logger.LogInformation("Found {Count} admin subscriptions to notify about cancellation", subscriptions.Count);

        var customerDisplay = @event.CustomerName ?? "Customer";
        var totalSuccess = 0;
        var allUnregisteredTokens = new List<string>();

        // Group by language and send localized notifications
        foreach (var group in subscriptions.GroupBy(s => s.PreferredLanguage))
        {
            var lang = group.Key;
            var tokens = group.Select(s => s.FcmToken).ToList();
            var title = NotificationMessages.ReservationCancelledTitle.GetText(lang);
            var body = NotificationMessages.ReservationCancelledBody(customerDisplay, @event.PlaceName, lang).GetText(lang);

            var result = await fcmService.SendBatchNotificationsAsync(
                tokens,
                title,
                body,
                new Dictionary<string, string>
                {
                    { "type", "reservation_cancelled" },
                    { "reservationId", @event.ReservationId.ToString() },
                    { "placeId", @event.PlaceId.ToString() },
                    { "placeKind", @event.PlaceKind },
                    { "placeName", @event.PlaceName.GetText(lang) },
                    { "customerName", @event.CustomerName ?? "" },
                    { "customerId", @event.CustomerId ?? "" }
                });

            totalSuccess += result.SuccessCount;
            allUnregisteredTokens.AddRange(result.UnregisteredTokens);
            logger.LogInformation("Sent {SuccessCount}/{TotalCount} cancellation notifications in {Lang}",
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

        logger.LogInformation("Sent {SuccessCount}/{TotalCount} admin cancellation notifications successfully",
            totalSuccess, subscriptions.Count);

        // Send FCM notification to the customer whose reservation was cancelled
        if (!string.IsNullOrEmpty(@event.CustomerId))
        {
            var customerSubscriptions = await context.Subscriptions
                .Where(s => s.UserId == @event.CustomerId && s.Type == SubscriptionType.UserOrderNotification)
                .ToListAsync();

            foreach (var subscription in customerSubscriptions)
            {
                var lang = subscription.PreferredLanguage;
                var title = NotificationMessages.YourReservationCancelledTitle.For(arabic.Standard).GetText(lang);
                var body = NotificationMessages.YourReservationCancelledBody(@event.PlaceName, lang).For(arabic.Standard).GetText(lang);

                var success = await fcmService.SendNotificationAsync(
                    subscription.FcmToken,
                    title,
                    body,
                    new Dictionary<string, string>
                    {
                        { "type", "reservation_cancelled" },
                        { "reservationId", @event.ReservationId.ToString() },
                        { "placeId", @event.PlaceId.ToString() },
                        { "placeKind", @event.PlaceKind },
                        { "placeName", @event.PlaceName.GetText(lang) }
                    });

                logger.LogInformation("FCM reservation cancelled notification to customer {CustomerId} ({Lang}): {Result}",
                    @event.CustomerId, lang, success ? "sent" : "failed");
            }
        }
    }
}
