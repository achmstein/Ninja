using Ninja.EventBus.Abstractions;
using Ninja.Notification.API.Hubs;
using Ninja.Notification.API.IntegrationEvents.Events;
using Ninja.Notification.API.Localization;
using Ninja.Notification.API.Model;
using Ninja.Notification.API.Services;
using Microsoft.AspNetCore.SignalR;

namespace Ninja.Notification.API.IntegrationEvents.EventHandling;

/// <summary>
/// A delivery moved on. The rider it was given to gets a push and a live
/// nudge (and the one it was taken from, both too); the customer gets a push
/// when it leaves and when it arrives; every screen at the till refreshes.
/// </summary>
public class OrderDeliveryChangedIntegrationEventHandler(
    NotificationContext context,
    IFcmService fcmService,
    IHubContext<NotificationHub> hubContext,
    TenantArabic arabic,
    ILogger<OrderDeliveryChangedIntegrationEventHandler> logger) : IIntegrationEventHandler<OrderDeliveryChangedIntegrationEvent>
{
    public async Task Handle(OrderDeliveryChangedIntegrationEvent @event)
    {
        logger.LogInformation("Delivery {OrderId} -> {Stage} (rider {Rider}, was {Previous})",
            @event.OrderId, @event.Stage, @event.RiderUserId, @event.PreviousRiderUserId);

        var payload = new
        {
            type = "delivery_changed",
            orderId = @event.OrderId,
            branchId = @event.BranchId,
            stage = @event.Stage,
            riderUserId = @event.RiderUserId,
            cashHandedIn = @event.CashHandedIn,
        };

        // The till's screens and the riders involved, live
        await hubContext.Clients.Group("admin").SendAsync("DeliveryChanged", payload);
        foreach (var rider in new[] { @event.RiderUserId, @event.PreviousRiderUserId }.Where(r => !string.IsNullOrEmpty(r)).Distinct())
        {
            await hubContext.Clients.Group($"user:{rider}").SendAsync("DeliveryChanged", payload);
        }

        if (@event.CashHandedIn)
        {
            return;
        }

        // The customer's app follows its order the way it follows a confirmation
        var customerGroup = !string.IsNullOrEmpty(@event.BuyerIdentityGuid)
            ? $"user:{@event.BuyerIdentityGuid}"
            : !string.IsNullOrEmpty(@event.GuestId) ? $"guest:{@event.GuestId}" : null;
        if (customerGroup is not null)
        {
            await hubContext.Clients.Group(customerGroup).SendAsync("OrderStatusChanged", payload);
        }

        // A new delivery in the rider's hand: the one push a rider must not miss
        if (@event.Stage == "Assigned" && !string.IsNullOrEmpty(@event.RiderUserId)
            && @event.PreviousRiderUserId != @event.RiderUserId)
        {
            await PushRiderAsync(@event.RiderUserId, NotificationMessages.NewDeliveryTitle,
                NotificationMessages.NewDeliveryBody(@event.OrderId, @event.Address), @event, "delivery_assigned");
        }

        if (!string.IsNullOrEmpty(@event.PreviousRiderUserId) && @event.PreviousRiderUserId != @event.RiderUserId)
        {
            await PushRiderAsync(@event.PreviousRiderUserId, NotificationMessages.DeliveryTakenBackTitle,
                NotificationMessages.DeliveryTakenBackBody(@event.OrderId), @event, "delivery_unassigned");
        }

        if (!string.IsNullOrEmpty(@event.BuyerIdentityGuid) && @event.Stage is "OnTheWay" or "Delivered")
        {
            await PushCustomerAsync(@event);
        }
    }

    private async Task PushRiderAsync(string riderUserId, LocalizedText title, LocalizedText body, OrderDeliveryChangedIntegrationEvent @event, string type)
    {
        var subscriptions = await context.Subscriptions
            .Where(s => s.UserId == riderUserId && s.Type == SubscriptionType.RiderDeliveries)
            .ToListAsync();

        foreach (var subscription in subscriptions)
        {
            var lang = subscription.PreferredLanguage;
            var sent = await fcmService.SendNotificationAsync(
                subscription.FcmToken,
                title.Get(lang),
                body.Get(lang),
                new Dictionary<string, string>
                {
                    { "type", type },
                    { "orderId", @event.OrderId.ToString() },
                });
            logger.LogInformation("Rider push {Type} to {Rider} ({Lang}): {Result}", type, riderUserId, lang, sent ? "sent" : "failed");
        }
    }

    private async Task PushCustomerAsync(OrderDeliveryChangedIntegrationEvent @event)
    {
        var preferences = await context.Preferences.FirstOrDefaultAsync(p => p.UserId == @event.BuyerIdentityGuid);
        if (preferences is { OrderStatusUpdates: false })
        {
            return;
        }

        var onTheWay = @event.Stage == "OnTheWay";
        var title = (onTheWay ? NotificationMessages.OrderOnTheWayTitle : NotificationMessages.OrderDeliveredTitle).For(arabic.Standard);
        var body = (onTheWay
            ? NotificationMessages.OrderOnTheWayBody(@event.OrderId, @event.RiderName)
            : NotificationMessages.OrderDeliveredBody(@event.OrderId)).For(arabic.Standard);

        var subscriptions = await context.Subscriptions
            .Where(s => s.UserId == @event.BuyerIdentityGuid && s.Type == SubscriptionType.UserOrderNotification)
            .ToListAsync();

        foreach (var subscription in subscriptions)
        {
            var lang = subscription.PreferredLanguage;
            await fcmService.SendNotificationAsync(
                subscription.FcmToken,
                title.Get(lang),
                body.Get(lang),
                new Dictionary<string, string>
                {
                    { "type", onTheWay ? "order_on_the_way" : "order_delivered" },
                    { "orderId", @event.OrderId.ToString() },
                });
        }
    }
}
