using Ninja.EventBus.Abstractions;
using Ninja.Notification.API.Hubs;
using Ninja.Notification.API.IntegrationEvents.Events;
using Microsoft.AspNetCore.SignalR;

namespace Ninja.Notification.API.IntegrationEvents.EventHandling;

/// <summary>
/// Wakes the print hosts (a till, a kitchen tablet) when a ticket waits for
/// a kitchen printer. A pointer only: they fetch the queue and claim from it.
/// </summary>
public class KitchenTicketQueuedIntegrationEventHandler(
    IHubContext<NotificationHub> hubContext,
    ILogger<KitchenTicketQueuedIntegrationEventHandler> logger) : IIntegrationEventHandler<KitchenTicketQueuedIntegrationEvent>
{
    public async Task Handle(KitchenTicketQueuedIntegrationEvent @event)
    {
        logger.LogInformation("Kitchen ticket queued at branch {BranchId} - notifying admin group", @event.BranchId);

        await hubContext.Clients.Group("admin").SendAsync("OrderStatusChanged", new
        {
            type = "kitchen_ticket",
            branchId = @event.BranchId
        });
    }
}
