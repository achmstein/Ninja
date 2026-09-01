using Chillax.EventBus.Abstractions;
using Chillax.Notification.API.Hubs;
using Chillax.Notification.API.IntegrationEvents.Events;
using Chillax.Notification.API.Localization;
using Chillax.Notification.API.Model;
using Chillax.Notification.API.Services;
using Microsoft.AspNetCore.SignalR;

namespace Chillax.Notification.API.IntegrationEvents.EventHandling;

public class OrderCancelledIntegrationEventHandler(
    NotificationContext context,
    IFcmService fcmService,
    IHubContext<NotificationHub> hubContext,
    ILogger<OrderCancelledIntegrationEventHandler> logger) : IIntegrationEventHandler<OrderStatusChangedToCancelledIntegrationEvent>
{
    public async Task Handle(OrderStatusChangedToCancelledIntegrationEvent @event)
    {
        logger.LogInformation("Handling OrderStatusChangedToCancelledIntegrationEvent for order {OrderId}, buyer {BuyerGuid}",
            @event.OrderId, @event.BuyerIdentityGuid);

        // Check if buyer has order status notifications enabled
        var preferences = await context.Preferences
            .FirstOrDefaultAsync(p => p.UserId == @event.BuyerIdentityGuid);

        if (preferences is { OrderStatusUpdates: false })
        {
            logger.LogInformation("User {BuyerGuid} has disabled order status notifications, skipping FCM",
                @event.BuyerIdentityGuid);
        }
        else
        {
            // Find the buyer's user order notification subscription
            var subscriptions = await context.Subscriptions
                .Where(s => s.UserId == @event.BuyerIdentityGuid && s.Type == SubscriptionType.UserOrderNotification)
                .ToListAsync();

            if (subscriptions.Count > 0)
            {
                foreach (var subscription in subscriptions)
                {
                    var lang = subscription.PreferredLanguage;
                    var title = NotificationMessages.OrderCancelledTitle.GetText(lang);
                    var body = NotificationMessages.OrderCancelledBody(@event.OrderId).GetText(lang);

                    var success = await fcmService.SendNotificationAsync(
                        subscription.FcmToken,
                        title,
                        body,
                        new Dictionary<string, string>
                        {
                            { "type", "order_cancelled" },
                            { "orderId", @event.OrderId.ToString() }
                        });

                    logger.LogInformation("FCM notification to buyer {BuyerGuid} ({Lang}): {Result}",
                        @event.BuyerIdentityGuid, lang, success ? "sent" : "failed");
                }
            }
            else
            {
                logger.LogInformation("No user order notification subscription found for buyer {BuyerGuid}",
                    @event.BuyerIdentityGuid);
            }
        }

        // Broadcast via SignalR to the customer's personal group — their
        // identity when signed in, their guest id when not
        var customerGroup = !string.IsNullOrEmpty(@event.BuyerIdentityGuid)
            ? $"user:{@event.BuyerIdentityGuid}"
            : !string.IsNullOrEmpty(@event.GuestId)
                ? $"guest:{@event.GuestId}"
                : null;

        if (customerGroup is not null)
        {
            await hubContext.Clients.Group(customerGroup).SendAsync("OrderStatusChanged", new
            {
                type = "order_cancelled",
                orderId = @event.OrderId
            });
        }

        // Also notify admin group
        await hubContext.Clients.Group("admin").SendAsync("OrderStatusChanged", new
        {
            type = "order_cancelled",
            orderId = @event.OrderId,
            buyerName = @event.BuyerName
        });
    }
}
