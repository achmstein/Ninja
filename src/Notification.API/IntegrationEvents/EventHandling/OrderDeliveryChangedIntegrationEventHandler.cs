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
/// when it leaves, when it arrives, and when it could not be handed over;
/// every screen at the till refreshes. Each move is told once: an event heard
/// again, or one older than the last told, rings nobody (<see cref="DeliveryNotice"/>).
/// </summary>
public class OrderDeliveryChangedIntegrationEventHandler(
    NotificationContext context,
    IFcmService fcmService,
    IHubContext<NotificationHub> hubContext,
    TenantArabic arabic,
    TimeProvider time,
    ILogger<OrderDeliveryChangedIntegrationEventHandler> logger) : IIntegrationEventHandler<OrderDeliveryChangedIntegrationEvent>
{
    /// <summary>Ordering's stage name as this copy knows it; a newer one it does not know is Unknown, and pushes nothing.</summary>
    public static DeliveryStage StageOf(string? stage) =>
        Enum.TryParse<DeliveryStage>(stage, ignoreCase: true, out var known) && Enum.IsDefined(known) ? known : DeliveryStage.Unknown;

    public async Task Handle(OrderDeliveryChangedIntegrationEvent @event)
    {
        var stage = StageOf(@event.Stage);
        logger.LogInformation("Delivery {OrderId} -> {Stage} (v{Version}, rider {Rider}, was {Previous})",
            @event.OrderId, stage, @event.Version, @event.RiderUserId, @event.PreviousRiderUserId);

        if (!await FirstTellingAsync(@event))
        {
            logger.LogInformation("Delivery {OrderId} v{Version}: already told, or older than what was - nobody rung", @event.OrderId, @event.Version);
            return;
        }

        // The till and the riders: who has it, so their lists move
        var staffPayload = new
        {
            type = "delivery_changed",
            orderId = @event.OrderId,
            branchId = @event.BranchId,
            stage = stage.ToString(),
            riderUserId = @event.RiderUserId,
            cashHandedIn = @event.CashHandedIn,
        };

        await hubContext.Clients.Group("admin").SendAsync("DeliveryChanged", staffPayload);
        foreach (var rider in new[] { @event.RiderUserId, @event.PreviousRiderUserId }.Where(r => !string.IsNullOrEmpty(r)).Distinct())
        {
            await hubContext.Clients.Group($"user:{rider}").SendAsync("DeliveryChanged", staffPayload);
        }

        if (@event.CashHandedIn)
        {
            return;
        }

        // The customer's app follows its order the way it follows a confirmation: where it has got
        // to, never whose account carries it (the rider's name comes with the push that needs it)
        var customerGroup = !string.IsNullOrEmpty(@event.BuyerIdentityGuid)
            ? $"user:{@event.BuyerIdentityGuid}"
            : !string.IsNullOrEmpty(@event.GuestId) ? $"guest:{@event.GuestId}" : null;
        if (customerGroup is not null)
        {
            await hubContext.Clients.Group(customerGroup).SendAsync("OrderStatusChanged", new
            {
                type = "delivery_changed",
                orderId = @event.OrderId,
                stage = stage.ToString(),
            });
        }

        // A new delivery in the rider's hand: the one push a rider must not miss
        if (stage == DeliveryStage.Assigned && !string.IsNullOrEmpty(@event.RiderUserId)
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

        if (stage == DeliveryStage.Failed && !string.IsNullOrEmpty(@event.RiderUserId))
        {
            await PushRiderAsync(@event.RiderUserId, NotificationMessages.DeliveryFailedTitle,
                NotificationMessages.DeliveryFailedBody(@event.OrderId), @event, "delivery_failed");
        }

        if (!string.IsNullOrEmpty(@event.BuyerIdentityGuid) && stage is DeliveryStage.OnTheWay or DeliveryStage.Delivered or DeliveryStage.Failed)
        {
            await PushCustomerAsync(@event, stage);
        }
    }

    /// <summary>
    /// Whether this move is news: not the event last told again, and not older than it. Remembered
    /// before anyone is rung, so a crash after a push tells nobody twice (a lost push beats a doubled one).
    /// </summary>
    private async Task<bool> FirstTellingAsync(OrderDeliveryChangedIntegrationEvent @event)
    {
        var notice = await context.DeliveryNotices.FindAsync(@event.OrderId);
        if (notice is not null && (notice.LastEventId == @event.Id || (@event.Version > 0 && @event.Version <= notice.LastVersion)))
        {
            return false;
        }

        notice ??= context.DeliveryNotices.Add(new DeliveryNotice { OrderId = @event.OrderId }).Entity;
        notice.LastEventId = @event.Id;
        notice.LastVersion = Math.Max(notice.LastVersion, @event.Version);
        notice.UpdatedAt = time.GetUtcNow().UtcDateTime;
        try
        {
            await context.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // The same move told at the same moment by another consumer of the queue: theirs stands
            return false;
        }
        return true;
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

    private async Task PushCustomerAsync(OrderDeliveryChangedIntegrationEvent @event, DeliveryStage stage)
    {
        var preferences = await context.Preferences.FirstOrDefaultAsync(p => p.UserId == @event.BuyerIdentityGuid);
        if (preferences is { OrderStatusUpdates: false })
        {
            return;
        }

        var (title, body, type) = stage switch
        {
            DeliveryStage.OnTheWay => (NotificationMessages.OrderOnTheWayTitle, NotificationMessages.OrderOnTheWayBody(@event.OrderId, @event.RiderName), "order_on_the_way"),
            DeliveryStage.Failed => (NotificationMessages.OrderNotDeliveredTitle, NotificationMessages.OrderNotDeliveredBody(@event.OrderId), "order_not_delivered"),
            _ => (NotificationMessages.OrderDeliveredTitle, NotificationMessages.OrderDeliveredBody(@event.OrderId), "order_delivered"),
        };
        var titleText = title.For(arabic.Standard);
        var bodyText = body.For(arabic.Standard);

        var subscriptions = await context.Subscriptions
            .Where(s => s.UserId == @event.BuyerIdentityGuid && s.Type == SubscriptionType.UserOrderNotification)
            .ToListAsync();

        foreach (var subscription in subscriptions)
        {
            var lang = subscription.PreferredLanguage;
            await fcmService.SendNotificationAsync(
                subscription.FcmToken,
                titleText.Get(lang),
                bodyText.Get(lang),
                new Dictionary<string, string>
                {
                    { "type", type },
                    { "orderId", @event.OrderId.ToString() },
                });
        }
    }
}
