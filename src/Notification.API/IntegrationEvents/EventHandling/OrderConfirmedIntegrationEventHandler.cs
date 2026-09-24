using Ninja.EventBus.Abstractions;
using Ninja.Notification.API.Hubs;
using Ninja.Notification.API.IntegrationEvents.Events;
using Ninja.Notification.API.Localization;
using Ninja.Notification.API.Model;
using Ninja.Notification.API.Services;
using Microsoft.AspNetCore.SignalR;

namespace Ninja.Notification.API.IntegrationEvents.EventHandling;

public class OrderConfirmedIntegrationEventHandler(
    NotificationContext context,
    IFcmService fcmService,
    IHubContext<NotificationHub> hubContext,
    TenantArabic arabic,
    ILogger<OrderConfirmedIntegrationEventHandler> logger) : IIntegrationEventHandler<OrderStatusChangedToConfirmedIntegrationEvent>
{
    public async Task Handle(OrderStatusChangedToConfirmedIntegrationEvent @event)
    {
        logger.LogInformation("Handling OrderStatusChangedToConfirmedIntegrationEvent for order {OrderId}, buyer {BuyerGuid}",
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
                    var title = NotificationMessages.OrderConfirmedTitle.For(arabic.Standard).GetText(lang);
                    var body = NotificationMessages.OrderConfirmedBody(@event.OrderId).For(arabic.Standard).GetText(lang);

                    var success = await fcmService.SendNotificationAsync(
                        subscription.FcmToken,
                        title,
                        body,
                        new Dictionary<string, string>
                        {
                            { "type", "order_confirmed" },
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
                type = "order_confirmed",
                orderId = @event.OrderId
            });
        }

        // Also notify admin group — with the branch, so a kitchen display
        // only chimes for its own orders (missing from older producers,
        // which every screen reads as "for everyone")
        await hubContext.Clients.Group("admin").SendAsync("OrderStatusChanged", new
        {
            type = "order_confirmed",
            orderId = @event.OrderId,
            buyerName = @event.BuyerName,
            branchId = @event.BranchId
        });
    }
}
