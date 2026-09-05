using Chillax.EventBus.Abstractions;
using Chillax.Notification.API.Hubs;
using Chillax.Notification.API.IntegrationEvents.Events;
using Microsoft.AspNetCore.SignalR;

namespace Chillax.Notification.API.IntegrationEvents.EventHandling;

/// <summary>
/// Nudges the kitchen screens (and any till that cares) when an order moves
/// in the kitchen. Staff group only, no FCM: a kitchen display is a screen
/// that is already on, and the customer is deliberately not told.
/// </summary>
public class OrderPreparationChangedIntegrationEventHandler(
    IHubContext<NotificationHub> hubContext,
    ILogger<OrderPreparationChangedIntegrationEventHandler> logger) : IIntegrationEventHandler<OrderPreparationChangedIntegrationEvent>
{
    public async Task Handle(OrderPreparationChangedIntegrationEvent @event)
    {
        logger.LogInformation("Order {OrderId} preparation -> {Preparation} - notifying admin group",
            @event.OrderId, @event.Preparation);

        await hubContext.Clients.Group("admin").SendAsync("OrderStatusChanged", new
        {
            type = "order_preparation",
            orderId = @event.OrderId,
            branchId = @event.BranchId,
            preparation = @event.Preparation
        });
    }
}
