using Ninja.EventBus.Abstractions;
using Ninja.Notification.API.Hubs;
using Ninja.Notification.API.IntegrationEvents.Events;
using Ninja.Notification.API.Model;
using Ninja.Notification.API.Services;
using Microsoft.AspNetCore.SignalR;

namespace Ninja.Notification.API.IntegrationEvents.EventHandling;

/// <summary>
/// A delivery on its way got closer: the customer's card and their open app
/// move, silently. Nothing else hears of it: not the till, not the kitchen,
/// not the rider. Told only forwards (the bus promises no order), and only
/// while the delivery is still on its way as far as this service has told:
/// progress arriving after "delivered" moves nothing.
/// </summary>
public class DeliveryProgressedIntegrationEventHandler(
    NotificationContext context,
    IFcmService fcmService,
    IHubContext<NotificationHub> hubContext,
    TimeProvider time,
    ILogger<DeliveryProgressedIntegrationEventHandler> logger) : IIntegrationEventHandler<DeliveryProgressedIntegrationEvent>
{
    public async Task Handle(DeliveryProgressedIntegrationEvent @event)
    {
        var notice = await context.DeliveryNotices.FindAsync(@event.OrderId);
        if (notice is null
            || notice.LastStage != nameof(DeliveryStage.OnTheWay)
            || notice.LastVersion > @event.Version
            || @event.Progress <= notice.LastProgress)
        {
            logger.LogInformation("Delivery {OrderId} progress {Progress}: late, or not on its way any more - nobody told", @event.OrderId, @event.Progress);
            return;
        }

        notice.LastProgress = @event.Progress;
        notice.UpdatedAt = time.GetUtcNow().UtcDateTime;
        try
        {
            await context.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // A step of the same delivery told at the same moment: its word stands
            return;
        }

        var customerGroup = !string.IsNullOrEmpty(@event.BuyerIdentityGuid)
            ? $"user:{@event.BuyerIdentityGuid}"
            : !string.IsNullOrEmpty(@event.GuestId) ? $"guest:{@event.GuestId}" : null;
        if (customerGroup is not null)
        {
            await hubContext.Clients.Group(customerGroup).SendAsync("OrderStatusChanged", new
            {
                type = "delivery_progress",
                orderId = @event.OrderId,
                stage = nameof(DeliveryStage.OnTheWay),
                version = @event.Version,
                progress = @event.Progress,
                etaMinutes = @event.EtaMinutes,
            });
        }

        if (string.IsNullOrEmpty(@event.BuyerIdentityGuid))
        {
            return;
        }

        var preferences = await context.Preferences.FirstOrDefaultAsync(p => p.UserId == @event.BuyerIdentityGuid);
        if (preferences is { OrderStatusUpdates: false })
        {
            return;
        }

        var phones = (await context.Subscriptions
                .Where(s => s.UserId == @event.BuyerIdentityGuid && s.Type == SubscriptionType.UserOrderNotification)
                .ToListAsync())
            .Where(DeliveryCard.HasCard)
            .Select(s => s.FcmToken)
            .ToList();
        if (phones.Count > 0)
        {
            await fcmService.SendBatchDataMessagesAsync(
                phones, DeliveryCard.Progress(@event.OrderId, @event.Version, @event.Progress, @event.EtaMinutes));
        }
    }
}
