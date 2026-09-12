using Chillax.EventBus.Abstractions;
using Chillax.Notification.API.Hubs;
using Chillax.Notification.API.IntegrationEvents.Events;
using Microsoft.AspNetCore.SignalR;

namespace Chillax.Notification.API.IntegrationEvents.EventHandling;

/// <summary>
/// Tells the staff screens that a stock item at a branch has dropped to its
/// reorder level. Staff-only and SignalR-only in v1: no FCM, no customer
/// audience — the admin and the till are already open in front of the people
/// who reorder.
/// </summary>
public class StockLowIntegrationEventHandler(
    IHubContext<NotificationHub> hubContext,
    ILogger<StockLowIntegrationEventHandler> logger) : IIntegrationEventHandler<StockLowIntegrationEvent>
{
    public async Task Handle(StockLowIntegrationEvent @event)
    {
        logger.LogInformation("Stock item {StockItemId} low at branch {BranchId} ({OnHand} {Unit} <= {ReorderLevel}) - notifying admin group",
            @event.StockItemId, @event.BranchId, @event.OnHand, @event.Unit, @event.ReorderLevel);

        await hubContext.Clients.Group("admin").SendAsync("StockLow", new
        {
            branchId = @event.BranchId,
            stockItemId = @event.StockItemId,
            name = @event.Name,
            unit = @event.Unit,
            onHand = @event.OnHand,
            reorderLevel = @event.ReorderLevel
        });
    }
}
