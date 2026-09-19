using Ninja.EventBus.Abstractions;
using Ninja.Notification.API.Hubs;
using Ninja.Notification.API.IntegrationEvents.Events;
using Microsoft.AspNetCore.SignalR;

namespace Ninja.Notification.API.IntegrationEvents.EventHandling;

public class CatalogItemAvailabilityChangedIntegrationEventHandler(
    IHubContext<NotificationHub> hubContext,
    ILogger<CatalogItemAvailabilityChangedIntegrationEventHandler> logger) : IIntegrationEventHandler<CatalogItemAvailabilityChangedIntegrationEvent>
{
    public async Task Handle(CatalogItemAvailabilityChangedIntegrationEvent @event)
    {
        logger.LogInformation("Catalog item availability changed: ItemId={ItemId}, BranchId={BranchId}, IsAvailable={IsAvailable}",
            @event.ItemId, @event.BranchId, @event.IsAvailable);

        var data = new
        {
            itemId = @event.ItemId,
            branchId = @event.BranchId,
            isAvailable = @event.IsAvailable
        };

        // Broadcast to all connected clients: the till, the customer apps and
        // the admin board all refetch the menu for their own branch
        await hubContext.Clients.All.SendAsync("CatalogChanged", data);
    }
}
