using Ninja.EventBus.Abstractions;
using Ninja.Notification.API.Hubs;
using Ninja.Notification.API.IntegrationEvents.Events;
using Ninja.Notification.API.Localization;
using Ninja.Notification.API.Model;
using Ninja.Notification.API.Services;
using Microsoft.AspNetCore.SignalR;

namespace Ninja.Notification.API.IntegrationEvents.EventHandling;

public class OrderReminderIntegrationEventHandler(
    NotificationContext context,
    IFcmService fcmService,
    IHubContext<NotificationHub> hubContext,
    ILogger<OrderReminderIntegrationEventHandler> logger) : IIntegrationEventHandler<OrderReminderIntegrationEvent>
{
    public async Task Handle(OrderReminderIntegrationEvent @event)
    {
        logger.LogInformation(
            "Handling OrderReminderIntegrationEvent for order {OrderId}, reminder #{ReminderCount}, pending {Minutes} min",
            @event.OrderId, @event.ReminderCount, @event.MinutesPending);

        // Broadcast via SignalR first — live dashboards must not depend on
        // whether any FCM push subscriptions exist
        await hubContext.Clients.Group("admin").SendAsync("OrderStatusChanged", new
        {
            type = "order_reminder",
            orderId = @event.OrderId,
            buyerName = @event.BuyerName,
            reminderCount = @event.ReminderCount,
            minutesPending = @event.MinutesPending,
            branchId = @event.BranchId
        });

        // Get admin order notification subscriptions for this branch
        var subscriptions = await context.Subscriptions
            .Where(s => s.Type == SubscriptionType.AdminOrderNotification
                && (s.BranchId == null || s.BranchId == @event.BranchId))
            .ToListAsync();

        if (subscriptions.Count == 0)
        {
            logger.LogInformation("No admin subscriptions found for order reminder notifications");
            return;
        }

        var buyerName = @event.BuyerName ?? "Customer";
        var totalSuccess = 0;
        var allUnregisteredTokens = new List<string>();

        // Group by language and send localized notifications
        foreach (var group in subscriptions.GroupBy(s => s.PreferredLanguage))
        {
            var lang = group.Key;
            var tokens = group.Select(s => s.FcmToken).ToList();
            var title = NotificationMessages.OrderReminderTitle(@event.ReminderCount).GetText(lang);
            var body = NotificationMessages.OrderReminderBody(@event.OrderId, buyerName, @event.MinutesPending).GetText(lang);

            var data = new Dictionary<string, string>
            {
                { "type", "order_reminder" },
                { "orderId", @event.OrderId.ToString() },
                { "buyerName", @event.BuyerName ?? "" },
                { "reminderCount", @event.ReminderCount.ToString() },
                { "minutesPending", @event.MinutesPending.ToString() },
                { "title", title },
                { "body", body }
            };

            // Send as data-only to Android (native code builds the notification
            // with custom sound/full-screen intent based on reminderCount).
            // iOS gets APNs alert since data-only is silent on iOS.
            var result = await fcmService.SendBatchDataWithApnsAlertAsync(
                tokens, title, body, data);

            totalSuccess += result.SuccessCount;
            allUnregisteredTokens.AddRange(result.UnregisteredTokens);
            logger.LogInformation("Sent {SuccessCount}/{TotalCount} reminder notifications in {Lang}",
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

        logger.LogInformation("Sent {SuccessCount}/{TotalCount} admin reminder notifications for order {OrderId}",
            totalSuccess, subscriptions.Count, @event.OrderId);
    }
}
