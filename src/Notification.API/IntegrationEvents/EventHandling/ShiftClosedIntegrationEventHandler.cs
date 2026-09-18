using Chillax.EventBus.Abstractions;
using Chillax.Notification.API.IntegrationEvents.Events;
using Chillax.Notification.API.Localization;
using Chillax.Notification.API.Model;
using Chillax.Notification.API.Services;
using Microsoft.EntityFrameworkCore;

namespace Chillax.Notification.API.IntegrationEvents.EventHandling;

/// <summary>
/// The day's digest: when the till closes its shift, the Z figures go to the
/// admin devices of that branch as one push. Sales, the tender split, the
/// drawer's over or short, and what left as discounts, refunds and tab
/// payments. It is the one message a day the owner reads without opening
/// anything; the full report stays in the back office.
/// </summary>
public class ShiftClosedIntegrationEventHandler(
    NotificationContext context,
    IFcmService fcmService,
    ILogger<ShiftClosedIntegrationEventHandler> logger) : IIntegrationEventHandler<ShiftClosedIntegrationEvent>
{
    public async Task Handle(ShiftClosedIntegrationEvent @event)
    {
        logger.LogInformation("Shift {ShiftId} closed at branch {BranchId}: sales {Sales}, {Tickets} bills, drawer {OverShort}",
            @event.ShiftId, @event.BranchId, @event.SalesTotal, @event.TicketsSettled, @event.OverShort);

        // The same devices that hear about new orders: the branch's, or those subscribed to every branch
        var subscriptions = await context.Subscriptions
            .Where(s => s.Type == SubscriptionType.AdminOrderNotification
                && (s.BranchId == null || s.BranchId == @event.BranchId))
            .ToListAsync();

        if (subscriptions.Count == 0)
        {
            logger.LogInformation("No admin subscriptions for branch {BranchId} - the digest has nobody to go to", @event.BranchId);
            return;
        }

        var unregistered = new List<string>();
        foreach (var group in subscriptions.GroupBy(s => s.PreferredLanguage))
        {
            var lang = group.Key;
            var result = await fcmService.SendBatchNotificationsAsync(
                group.Select(s => s.FcmToken).ToList(),
                NotificationMessages.ShiftClosedTitle.GetText(lang),
                NotificationMessages.ShiftClosedBody(@event).GetText(lang),
                new Dictionary<string, string>
                {
                    { "type", "shift_closed" },
                    { "shiftId", @event.ShiftId.ToString() },
                    { "branchId", @event.BranchId.ToString() },
                });
            unregistered.AddRange(result.UnregisteredTokens);
            logger.LogInformation("Sent the shift digest to {SuccessCount}/{TotalCount} devices in {Lang}",
                result.SuccessCount, group.Count(), lang);
        }

        // Clean up subscriptions with invalid/expired FCM tokens
        if (unregistered.Count > 0)
        {
            var stale = subscriptions.Where(s => unregistered.Contains(s.FcmToken)).ToList();
            context.Subscriptions.RemoveRange(stale);
            await context.SaveChangesAsync();
            logger.LogWarning("Removed {Count} subscriptions with unregistered FCM tokens", stale.Count);
        }
    }
}
