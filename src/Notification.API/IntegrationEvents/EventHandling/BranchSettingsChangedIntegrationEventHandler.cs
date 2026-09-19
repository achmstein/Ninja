using Ninja.EventBus.Abstractions;
using Ninja.Notification.API.Hubs;
using Ninja.Notification.API.IntegrationEvents.Events;
using Microsoft.AspNetCore.SignalR;

namespace Ninja.Notification.API.IntegrationEvents.EventHandling;

public class BranchSettingsChangedIntegrationEventHandler(
    IHubContext<NotificationHub> hubContext,
    ILogger<BranchSettingsChangedIntegrationEventHandler> logger) : IIntegrationEventHandler<BranchSettingsChangedIntegrationEvent>
{
    public async Task Handle(BranchSettingsChangedIntegrationEvent @event)
    {
        logger.LogInformation("Branch settings changed: BranchId={BranchId}, Ordering={Ordering}, Reservations={Reservations}",
            @event.BranchId, @event.IsOrderingEnabled, @event.IsReservationsEnabled);

        var data = new
        {
            branchId = @event.BranchId,
            isOrderingEnabled = @event.IsOrderingEnabled,
            isReservationsEnabled = @event.IsReservationsEnabled
        };

        // Broadcast to all connected clients
        await hubContext.Clients.All.SendAsync("BranchSettingsChanged", data);
    }
}
