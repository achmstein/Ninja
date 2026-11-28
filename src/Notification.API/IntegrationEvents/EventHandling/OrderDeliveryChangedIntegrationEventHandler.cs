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
/// nudge (and the one it was taken from, both too), and hears when the
/// customer says they are coming down; every screen at the till refreshes.
/// The customer follows it on one live card where their app draws one
/// (<see cref="DeliveryCard"/>): an Android phone gets the card's data alone,
/// an iPhone the card's data beside the three plain pushes (left, arrived,
/// could not be handed over), and a phone on an older build the three plain
/// pushes as before. Each move is told once: an event heard again, or one
/// older than the last told, rings nobody (<see cref="DeliveryNotice"/>).
/// </summary>
public class OrderDeliveryChangedIntegrationEventHandler(
    NotificationContext context,
    IFcmService fcmService,
    IHubContext<NotificationHub> hubContext,
    TenantArabic arabic,
    TimeProvider time,
    ILogger<OrderDeliveryChangedIntegrationEventHandler> logger) : IIntegrationEventHandler<OrderDeliveryChangedIntegrationEvent>
{
    /// <summary>The rider came near the door: news, not a step.</summary>
    public const string NoteNearby = "Nearby";

    /// <summary>The customer said they are coming down: news, not a step.</summary>
    public const string NoteCustomerComing = "CustomerComing";

    /// <summary>Ordering's stage name as this copy knows it; a newer one it does not know is Unknown, and pushes nothing.</summary>
    public static DeliveryStage StageOf(string? stage) =>
        Enum.TryParse<DeliveryStage>(stage, ignoreCase: true, out var known) && Enum.IsDefined(known) ? known : DeliveryStage.Unknown;

    public async Task Handle(OrderDeliveryChangedIntegrationEvent @event)
    {
        var stage = StageOf(@event.Stage);
        logger.LogInformation("Delivery {OrderId} -> {Stage} (v{Version}, rider {Rider}, was {Previous}, note {Note})",
            @event.OrderId, stage, @event.Version, @event.RiderUserId, @event.PreviousRiderUserId, @event.Note);

        var (news, stageBefore) = await FirstTellingAsync(@event, stage);
        if (!news)
        {
            logger.LogInformation("Delivery {OrderId} v{Version}: already told, or older than what was - nobody rung", @event.OrderId, @event.Version);
            return;
        }

        // A step of the delivery; the rider coming near or the customer coming down is news about one
        var isStep = string.IsNullOrEmpty(@event.Note);

        // The till and the riders: who has it, so their lists move
        var staffPayload = new
        {
            type = "delivery_changed",
            orderId = @event.OrderId,
            branchId = @event.BranchId,
            stage = stage.ToString(),
            riderUserId = @event.RiderUserId,
            cashHandedIn = @event.CashHandedIn,
            note = @event.Note,
            customerComing = @event.CustomerComing,
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
        // to and who is bringing it, never whose account carries it or where they are
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
                version = @event.Version,
                progress = @event.Progress,
                etaMinutes = @event.EtaMinutes,
                riderName = @event.RiderName ?? @event.CourierName,
                riderPhone = @event.RiderPhone,
                nearby = @event.Nearby,
                customerComing = @event.CustomerComing,
                failureReason = @event.FailureReason,
            });
        }

        // A new delivery in the rider's hand: the one push a rider must not miss
        if (isStep && stage == DeliveryStage.Assigned && !string.IsNullOrEmpty(@event.RiderUserId)
            && @event.PreviousRiderUserId != @event.RiderUserId)
        {
            await PushRiderAsync(@event.RiderUserId, NotificationMessages.NewDeliveryTitle,
                NotificationMessages.NewDeliveryBody(@event.OrderId, @event.Address), @event, "delivery_assigned");
        }

        if (isStep && !string.IsNullOrEmpty(@event.PreviousRiderUserId) && @event.PreviousRiderUserId != @event.RiderUserId)
        {
            await PushRiderAsync(@event.PreviousRiderUserId, NotificationMessages.DeliveryTakenBackTitle,
                NotificationMessages.DeliveryTakenBackBody(@event.OrderId), @event, "delivery_unassigned");
        }

        if (isStep && stage == DeliveryStage.Failed && stageBefore != DeliveryStage.Failed && !string.IsNullOrEmpty(@event.RiderUserId))
        {
            await PushRiderAsync(@event.RiderUserId, NotificationMessages.DeliveryFailedTitle,
                NotificationMessages.DeliveryFailedBody(@event.OrderId), @event, "delivery_failed");
        }

        // The customer is on their way down: the rider waits at the door instead of climbing
        if (@event.Note == NoteCustomerComing && !string.IsNullOrEmpty(@event.RiderUserId))
        {
            await PushRiderAsync(@event.RiderUserId, NotificationMessages.CustomerComingTitle,
                NotificationMessages.CustomerComingBody(@event.OrderId), @event, "customer_coming");
        }

        if (!string.IsNullOrEmpty(@event.BuyerIdentityGuid) && stage != DeliveryStage.Unknown)
        {
            await TellCustomerAsync(@event, stage, stageBefore, isStep);
        }
    }

    /// <summary>
    /// Whether this move is news: not the event last told again, and not older than it. Remembered
    /// before anyone is rung, so a crash after a push tells nobody twice (a lost push beats a doubled
    /// one). With it, the stage told before this one: a step that leaves the stage where it was (a
    /// courier named while on the way) rings nobody a second time for that stage.
    /// </summary>
    private async Task<(bool News, DeliveryStage Before)> FirstTellingAsync(OrderDeliveryChangedIntegrationEvent @event, DeliveryStage stage)
    {
        var notice = await context.DeliveryNotices.FindAsync(@event.OrderId);
        if (notice is not null && (notice.LastEventId == @event.Id || (@event.Version > 0 && @event.Version <= notice.LastVersion)))
        {
            return (false, DeliveryStage.Unknown);
        }

        notice ??= context.DeliveryNotices.Add(new DeliveryNotice { OrderId = @event.OrderId }).Entity;
        var before = StageOf(notice.LastStage);
        notice.LastEventId = @event.Id;
        notice.LastVersion = Math.Max(notice.LastVersion, @event.Version);
        notice.LastStage = stage.ToString();
        notice.LastProgress = stage == DeliveryStage.OnTheWay ? Math.Max(notice.LastProgress, @event.Progress ?? 0) : 0;
        notice.UpdatedAt = time.GetUtcNow().UtcDateTime;
        try
        {
            await context.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // The same move told at the same moment by another consumer of the queue: theirs stands
            return (false, DeliveryStage.Unknown);
        }
        return (true, before);
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

    /// <summary>
    /// The customer's phones, each as its app can take it. The card's data goes for every change they
    /// would see; the plain pushes only for the three steps, once each, and never to an Android phone
    /// that draws the card (it would say the same thing twice).
    /// </summary>
    private async Task TellCustomerAsync(OrderDeliveryChangedIntegrationEvent @event, DeliveryStage stage, DeliveryStage stageBefore, bool isStep)
    {
        var preferences = await context.Preferences.FirstOrDefaultAsync(p => p.UserId == @event.BuyerIdentityGuid);
        if (preferences is { OrderStatusUpdates: false })
        {
            return;
        }

        var subscriptions = await context.Subscriptions
            .Where(s => s.UserId == @event.BuyerIdentityGuid && s.Type == SubscriptionType.UserOrderNotification)
            .ToListAsync();
        if (subscriptions.Count == 0)
        {
            return;
        }

        var arrivedAtStage = isStep && stage != stageBefore;

        // The card rings when it leaves, when the rider is near, and when it could not be handed over
        var alert = @event.Note == NoteNearby
            || (arrivedAtStage && stage is DeliveryStage.OnTheWay or DeliveryStage.Failed);
        var cardPhones = subscriptions.Where(DeliveryCard.HasCard).Select(s => s.FcmToken).ToList();
        if (cardPhones.Count > 0)
        {
            await fcmService.SendBatchDataMessagesAsync(cardPhones, DeliveryCard.Step(
                @event.OrderId, stage, @event.Version, @event.Progress, @event.EtaMinutes,
                @event.RiderName ?? @event.CourierName, @event.RiderPhone, @event.Nearby, @event.CustomerComing,
                @event.FailureReason, alert));
        }

        if (!arrivedAtStage || stage is not (DeliveryStage.OnTheWay or DeliveryStage.Delivered or DeliveryStage.Failed))
        {
            return;
        }

        var (title, body, type) = stage switch
        {
            DeliveryStage.OnTheWay => (NotificationMessages.OrderOnTheWayTitle, NotificationMessages.OrderOnTheWayBody(@event.OrderId, @event.RiderName ?? @event.CourierName), "order_on_the_way"),
            DeliveryStage.Failed => (NotificationMessages.OrderNotDeliveredTitle, NotificationMessages.OrderNotDeliveredBody(@event.OrderId), "order_not_delivered"),
            _ => (NotificationMessages.OrderDeliveredTitle, NotificationMessages.OrderDeliveredBody(@event.OrderId), "order_delivered"),
        };
        var titleText = title.For(arabic.Standard);
        var bodyText = body.For(arabic.Standard);

        foreach (var subscription in subscriptions.Where(s => s.Platform != DeliveryCard.Android))
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
