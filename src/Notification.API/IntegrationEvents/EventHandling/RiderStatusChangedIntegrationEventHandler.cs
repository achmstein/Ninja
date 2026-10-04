using Ninja.EventBus.Abstractions;
using Ninja.Notification.API.Hubs;
using Ninja.Notification.API.IntegrationEvents.Events;
using Microsoft.AspNetCore.SignalR;

namespace Ninja.Notification.API.IntegrationEvents.EventHandling;

/// <summary>
/// A rider started or stopped: every screen at the till refreshes its riders,
/// so the one who just went on duty is offered at once. Nothing is pushed to
/// a phone; it is the till's list that moves.
/// </summary>
public class RiderStatusChangedIntegrationEventHandler(
    IHubContext<NotificationHub> hubContext,
    ILogger<RiderStatusChangedIntegrationEventHandler> logger) : IIntegrationEventHandler<RiderStatusChangedIntegrationEvent>
{
    public async Task Handle(RiderStatusChangedIntegrationEvent @event)
    {
        logger.LogInformation("Rider {Rider} at branch {BranchId} on duty: {OnDuty}", @event.UserId, @event.BranchId, @event.OnDuty);

        await hubContext.Clients.Group("admin").SendAsync("RiderStatusChanged", new
        {
            type = "rider_status_changed",
            branchId = @event.BranchId,
            onDuty = @event.OnDuty,
        });
    }
}
