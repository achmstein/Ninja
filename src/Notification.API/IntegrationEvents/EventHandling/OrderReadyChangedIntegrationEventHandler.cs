using Ninja.EventBus.Abstractions;
using Ninja.Notification.API.Hubs;
using Ninja.Notification.API.IntegrationEvents.Events;
using Ninja.Notification.API.Localization;
using Ninja.Notification.API.Model;
using Ninja.Notification.API.Services;
using Microsoft.AspNetCore.SignalR;

namespace Ninja.Notification.API.IntegrationEvents.EventHandling;

/// <summary>
/// Nudges the kitchen screens (and any till that cares) when an order is
/// marked ready or brought back: a kitchen display is a screen that is
/// already on, and the customer is deliberately not told. A delivery's rider,
/// still waiting at the branch, is told too: their list moves either way,
/// and their phone rings when it becomes ready to collect.
/// </summary>
public class OrderReadyChangedIntegrationEventHandler(
    NotificationContext context,
    IFcmService fcmService,
    IHubContext<NotificationHub> hubContext,
    ILogger<OrderReadyChangedIntegrationEventHandler> logger) : IIntegrationEventHandler<OrderReadyChangedIntegrationEvent>
{
    public async Task Handle(OrderReadyChangedIntegrationEvent @event)
    {
        logger.LogInformation("Order {OrderId} ready -> {IsReady} - notifying admin group",
            @event.OrderId, @event.IsReady);

        await hubContext.Clients.Group("admin").SendAsync("OrderStatusChanged", new
        {
            type = "order_ready",
            orderId = @event.OrderId,
            branchId = @event.BranchId,
            isReady = @event.IsReady
        });

        if (string.IsNullOrEmpty(@event.RiderUserId))
        {
            return;
        }

        // The rider's list shows it ready (or being made again) at once
        await hubContext.Clients.Group($"user:{@event.RiderUserId}").SendAsync("DeliveryChanged", new
        {
            type = "delivery_ready",
            orderId = @event.OrderId,
            branchId = @event.BranchId,
            isReady = @event.IsReady
        });

        // Brought back to the board is nothing to ring a phone for
        if (!@event.IsReady)
        {
            return;
        }

        var subscriptions = await context.Subscriptions
            .Where(s => s.UserId == @event.RiderUserId && s.Type == SubscriptionType.RiderDeliveries)
            .ToListAsync();

        foreach (var subscription in subscriptions)
        {
            var lang = subscription.PreferredLanguage;
            var sent = await fcmService.SendNotificationAsync(
                subscription.FcmToken,
                NotificationMessages.DeliveryReadyTitle.Get(lang),
                NotificationMessages.DeliveryReadyBody(@event.OrderId).Get(lang),
                new Dictionary<string, string>
                {
                    { "type", "delivery_ready" },
                    { "orderId", @event.OrderId.ToString() },
                });
            logger.LogInformation("Rider push delivery_ready to {Rider} ({Lang}): {Result}", @event.RiderUserId, lang, sent ? "sent" : "failed");
        }
    }
}
