namespace Ninja.Catalog.API.IntegrationEvents.EventHandling;

public class OrderStatusChangedToPaidIntegrationEventHandler(
    ILogger<OrderStatusChangedToPaidIntegrationEventHandler> logger) :
    IIntegrationEventHandler<OrderStatusChangedToPaidIntegrationEvent>
{
    public Task Handle(OrderStatusChangedToPaidIntegrationEvent @event)
    {
        // For cafe orders, we don't track stock/inventory
        // Orders are confirmed and sent to POS
        logger.LogInformation("Order {OrderId} has been paid. Items: {@OrderStockItems}",
            @event.OrderId, @event.OrderStockItems);

        return Task.CompletedTask;
    }
}
