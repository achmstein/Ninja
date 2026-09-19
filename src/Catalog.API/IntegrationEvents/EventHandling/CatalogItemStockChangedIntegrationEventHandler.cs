namespace Ninja.Catalog.API.IntegrationEvents.EventHandling;

/// <summary>
/// Applies an Inventory stock-out (or its end) to the branch overrides of the
/// affected menu items and tells the rest of the system what those items'
/// effective availability at that branch now is. Idempotent: a redelivery
/// that changes nothing saves and publishes nothing.
/// </summary>
public class CatalogItemStockChangedIntegrationEventHandler(
    CatalogContext catalogContext,
    ICatalogIntegrationEventService catalogIntegrationEventService,
    ILogger<CatalogItemStockChangedIntegrationEventHandler> logger) :
    IIntegrationEventHandler<CatalogItemStockChangedIntegrationEvent>
{
    public async Task Handle(CatalogItemStockChangedIntegrationEvent @event)
    {
        logger.LogInformation("Handling integration event: {IntegrationEventId} - ({@IntegrationEvent})", @event.Id, @event);

        var requestedIds = @event.CatalogItemIds.Distinct().ToList();
        var items = await catalogContext.CatalogItems
            .Where(i => requestedIds.Contains(i.Id))
            .ToListAsync();

        var missingIds = requestedIds.Except(items.Select(i => i.Id)).ToList();
        if (missingIds.Count > 0)
        {
            logger.LogWarning("Stock change for branch {BranchId} names unknown catalog items {CatalogItemIds}; skipping them",
                @event.BranchId, missingIds);
        }

        var overrides = await catalogContext.BranchItemOverrides
            .Where(o => o.BranchId == @event.BranchId && requestedIds.Contains(o.CatalogItemId))
            .ToDictionaryAsync(o => o.CatalogItemId);

        var isOutOfStock = !@event.InStock;
        var changedEvents = new List<IntegrationEvent>();

        foreach (var item in items)
        {
            if (overrides.TryGetValue(item.Id, out var branchOverride))
            {
                if (branchOverride.IsOutOfStock == isOutOfStock)
                {
                    continue;
                }

                branchOverride.IsOutOfStock = isOutOfStock;
            }
            else
            {
                branchOverride = new BranchItemOverride
                {
                    BranchId = @event.BranchId,
                    CatalogItemId = item.Id,
                    IsAvailable = true,
                    IsOutOfStock = isOutOfStock,
                };
                catalogContext.BranchItemOverrides.Add(branchOverride);
            }

            // A branch can only restrict: the effective state is what the
            // branch's menus now show
            var effective = item.IsAvailable && branchOverride.IsAvailable && !branchOverride.IsOutOfStock;
            changedEvents.Add(new CatalogItemAvailabilityChangedIntegrationEvent(item.Id, @event.BranchId, effective));
        }

        if (changedEvents.Count == 0)
        {
            return;
        }

        await catalogIntegrationEventService.SaveEventsAndCatalogContextChangesAsync(changedEvents);
        foreach (var changedEvent in changedEvents)
        {
            await catalogIntegrationEventService.PublishThroughEventBusAsync(changedEvent);
        }
    }
}
