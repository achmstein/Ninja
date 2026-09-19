using Ninja.EventBus.Abstractions;
using Ninja.Notification.API.Hubs;
using Ninja.Notification.API.IntegrationEvents.Events;
using Microsoft.AspNetCore.SignalR;

namespace Ninja.Notification.API.IntegrationEvents.EventHandling;

/// <summary>
/// Nudges the kitchen screens (and any till that cares) when an order is
/// marked ready or brought back. Staff group only, no FCM: a kitchen display
/// is a screen that is already on, and the customer is deliberately not told.
/// </summary>
public class OrderReadyChangedIntegrationEventHandler(
    IHubContext<NotificationHub> hubContext,
    ILogger<OrderReadyChangedIntegrationEventHandler> logger) : IIntegrationEventHandler<OrderReadyChangedIntegrationEvent>
{
    public async Task Handle(OrderReadyChangedIntegrationEvent @event)
    {
        logger.LogInformation("Order {OrderId} ready -> {IsReady} - notifying admin group",
            @event.OrderId, @event.IsReady);

        await hubContext.Clients.Group("admin").SendAsync("OrderStatusChanged", new
        {
            type = "order_ready",
            orderId = @event.OrderId,
            branchId = @event.BranchId,
            isReady = @event.IsReady
        });
    }
}
