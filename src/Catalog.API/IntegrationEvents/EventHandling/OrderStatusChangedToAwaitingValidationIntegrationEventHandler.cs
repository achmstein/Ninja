namespace Chillax.Catalog.API.IntegrationEvents.EventHandling;

public class OrderStatusChangedToAwaitingValidationIntegrationEventHandler(
    CatalogContext catalogContext,
    ICatalogIntegrationEventService catalogIntegrationEventService,
    ILogger<OrderStatusChangedToAwaitingValidationIntegrationEventHandler> logger) :
    IIntegrationEventHandler<OrderStatusChangedToAwaitingValidationIntegrationEvent>
{
    public async Task Handle(OrderStatusChangedToAwaitingValidationIntegrationEvent @event)
    {
        logger.LogInformation("Handling integration event: {IntegrationEventId} - ({@IntegrationEvent})", @event.Id, @event);

        // Load branch overrides if branch is specified
        var productIds = @event.OrderStockItems.Select(i => i.ProductId).ToList();
        var branchOverrides = await catalogContext.BranchItemOverrides
            .Where(o => o.BranchId == @event.BranchId && productIds.Contains(o.CatalogItemId))
            .ToDictionaryAsync(o => o.CatalogItemId);

        var confirmedOrderStockItems = new List<ConfirmedOrderStockItem>();

        foreach (var orderStockItem in @event.OrderStockItems)
        {
            var catalogItem = await catalogContext.CatalogItems.FindAsync(orderStockItem.ProductId);
            if (catalogItem is not null)
            {
                // A branch override can only restrict: the global flag always wins,
                // and an Inventory stock-out restricts like a manual sold-out
                var isAvailable = catalogItem.IsAvailable &&
                    (!branchOverrides.TryGetValue(catalogItem.Id, out var branchOverride) ||
                     (branchOverride.IsAvailable && !branchOverride.IsOutOfStock));
                var confirmedOrderStockItem = new ConfirmedOrderStockItem(catalogItem.Id, isAvailable);

                confirmedOrderStockItems.Add(confirmedOrderStockItem);
            }
        }

        var confirmedIntegrationEvent = confirmedOrderStockItems.Any(c => !c.HasStock)
            ? (IntegrationEvent)new OrderStockRejectedIntegrationEvent(@event.OrderId, confirmedOrderStockItems)
            : new OrderStockConfirmedIntegrationEvent(@event.OrderId);

        await catalogIntegrationEventService.SaveEventAndCatalogContextChangesAsync(confirmedIntegrationEvent);
        await catalogIntegrationEventService.PublishThroughEventBusAsync(confirmedIntegrationEvent);
    }
}
