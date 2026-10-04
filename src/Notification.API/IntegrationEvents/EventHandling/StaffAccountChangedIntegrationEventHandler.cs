using Ninja.EventBus.Abstractions;
using Ninja.Notification.API.IntegrationEvents.Events;
using Ninja.Notification.API.Model;

namespace Ninja.Notification.API.IntegrationEvents.EventHandling;

/// <summary>
/// A staff account changed. One that can no longer be a rider (switched off,
/// gone, the role taken away) has its phone's rider pushes dropped: the
/// deliveries and the customers' addresses in them stop reaching it.
/// </summary>
public class StaffAccountChangedIntegrationEventHandler(
    NotificationContext context,
    ILogger<StaffAccountChangedIntegrationEventHandler> logger) : IIntegrationEventHandler<StaffAccountChangedIntegrationEvent>
{
    public async Task Handle(StaffAccountChangedIntegrationEvent @event)
    {
        if (@event.Enabled && @event.Roles.Contains(RoleNames.Rider, StringComparer.OrdinalIgnoreCase))
        {
            return;
        }

        var subscriptions = await context.Subscriptions
            .Where(s => s.UserId == @event.UserId && s.Type == SubscriptionType.RiderDeliveries)
            .ToListAsync();
        if (subscriptions.Count == 0)
        {
            return;
        }

        context.Subscriptions.RemoveRange(subscriptions);
        await context.SaveChangesAsync();
        logger.LogInformation("Staff account {UserId} is no rider now: its rider pushes stop", @event.UserId);
    }
}
