using Chillax.EventBus.Abstractions;
using Chillax.Notification.API.Hubs;
using Chillax.Notification.API.IntegrationEvents.Events;
using Chillax.Notification.API.Localization;
using Chillax.Notification.API.Model;
using Chillax.Notification.API.Services;
using Microsoft.AspNetCore.SignalR;

namespace Chillax.Notification.API.IntegrationEvents.EventHandling;

public class OrderSubmittedIntegrationEventHandler(
    NotificationContext context,
    IFcmService fcmService,
    IHubContext<NotificationHub> hubContext,
    ILogger<OrderSubmittedIntegrationEventHandler> logger) : IIntegrationEventHandler<OrderStatusChangedToSubmittedIntegrationEvent>
{
    public async Task Handle(OrderStatusChangedToSubmittedIntegrationEvent @event)
    {
        logger.LogInformation("Handling OrderStatusChangedToSubmittedIntegrationEvent for order {OrderId} from {BuyerName}",
            @event.OrderId, @event.BuyerName);

        // Broadcast via SignalR first — live dashboards must not depend on
        // whether any FCM push subscriptions exist
        // branchId lets branch-scoped dashboards ignore other branches' orders
        // (their pending list is filtered by X-Branch-Id and can never show them)
        await hubContext.Clients.Group("admin").SendAsync("OrderStatusChanged", new
        {
            type = "order_submitted",
            orderId = @event.OrderId,
            buyerName = @event.BuyerName,
            branchId = @event.BranchId
        });

        // The customer's personal group — their identity when signed in, their
        // guest id when not
        var customerGroup = !string.IsNullOrEmpty(@event.BuyerIdentityGuid)
            ? $"user:{@event.BuyerIdentityGuid}"
            : !string.IsNullOrEmpty(@event.GuestId)
                ? $"guest:{@event.GuestId}"
                : null;

        if (customerGroup is not null)
        {
            await hubContext.Clients.Group(customerGroup).SendAsync("OrderStatusChanged", new
            {
                type = "order_submitted",
                orderId = @event.OrderId
            });
        }

        // Get admin order notification subscriptions for this branch
        var subscriptions = await context.Subscriptions
            .Where(s => s.Type == SubscriptionType.AdminOrderNotification
                && (s.BranchId == null || s.BranchId == @event.BranchId))
            .ToListAsync();

        if (subscriptions.Count == 0)
        {
            logger.LogInformation("No admin subscriptions found for order notifications");
            return;
        }

        logger.LogInformation("Found {Count} admin subscriptions to notify", subscriptions.Count);

        var buyerName = @event.BuyerName ?? "Customer";
        var totalSuccess = 0;
        var allUnregisteredTokens = new List<string>();

        // Group by language and send localized notifications
        foreach (var group in subscriptions.GroupBy(s => s.PreferredLanguage))
        {
            var lang = group.Key;
            var tokens = group.Select(s => s.FcmToken).ToList();
            var title = NotificationMessages.NewOrderTitle.GetText(lang);
            var body = NotificationMessages.NewOrderBody(@event.OrderId, buyerName).GetText(lang);

            var result = await fcmService.SendBatchNotificationsAsync(
                tokens,
                title,
                body,
                new Dictionary<string, string>
                {
                    { "type", "new_order" },
                    { "orderId", @event.OrderId.ToString() },
                    { "buyerName", @event.BuyerName ?? "" },
                    { "buyerId", @event.BuyerIdentityGuid ?? "" }
                });

            totalSuccess += result.SuccessCount;
            allUnregisteredTokens.AddRange(result.UnregisteredTokens);
            logger.LogInformation("Sent {SuccessCount}/{TotalCount} notifications in {Lang}",
                result.SuccessCount, tokens.Count, lang);
        }

        // Clean up subscriptions with invalid/expired FCM tokens
        if (allUnregisteredTokens.Count > 0)
        {
            var staleSubscriptions = subscriptions
                .Where(s => allUnregisteredTokens.Contains(s.FcmToken))
                .ToList();
            context.Subscriptions.RemoveRange(staleSubscriptions);
            await context.SaveChangesAsync();
            logger.LogWarning("Removed {Count} subscriptions with unregistered FCM tokens", staleSubscriptions.Count);
        }

        logger.LogInformation("Sent {SuccessCount}/{TotalCount} admin notifications successfully",
            totalSuccess, subscriptions.Count);
    }
}
