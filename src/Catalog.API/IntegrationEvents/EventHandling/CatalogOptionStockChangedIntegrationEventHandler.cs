namespace Chillax.Catalog.API.IntegrationEvents.EventHandling;

/// <summary>
/// Applies an Inventory option stock-out (or its end) to the branch's
/// <see cref="BranchOptionStockOut"/> rows, then republishes the parent items'
/// effective availability at that branch so every client refetches them and
/// picks up the option flag. Idempotent: a redelivery that changes nothing
/// saves and publishes nothing.
/// </summary>
public class CatalogOptionStockChangedIntegrationEventHandler(
    CatalogContext catalogContext,
    ICatalogIntegrationEventService catalogIntegrationEventService,
    ILogger<CatalogOptionStockChangedIntegrationEventHandler> logger) :
    IIntegrationEventHandler<CatalogOptionStockChangedIntegrationEvent>
{
    public async Task Handle(CatalogOptionStockChangedIntegrationEvent @event)
    {
        logger.LogInformation("Handling integration event: {IntegrationEventId} - ({@IntegrationEvent})", @event.Id, @event);

        var requestedIds = @event.OptionIds.Distinct().ToList();
        var options = await catalogContext.CustomizationOptions
            .Include(o => o.ItemCustomization)
            .Where(o => requestedIds.Contains(o.Id))
            .ToListAsync();

        var missingIds = requestedIds.Except(options.Select(o => o.Id)).ToList();
        if (missingIds.Count > 0)
        {
            logger.LogWarning("Option stock change for branch {BranchId} names unknown customization options {OptionIds}; skipping them",
                @event.BranchId, missingIds);
        }

        var stockOuts = await catalogContext.BranchOptionStockOuts
            .Where(s => s.BranchId == @event.BranchId && requestedIds.Contains(s.CustomizationOptionId))
            .ToDictionaryAsync(s => s.CustomizationOptionId);

        var affectedItemIds = new HashSet<int>();

        foreach (var option in options)
        {
            var hasRow = stockOuts.TryGetValue(option.Id, out var stockOut);

            if (@event.InStock)
            {
                if (!hasRow)
                {
                    continue;
                }

                catalogContext.BranchOptionStockOuts.Remove(stockOut!);
            }
            else
            {
                if (hasRow)
                {
                    continue;
                }

                catalogContext.BranchOptionStockOuts.Add(new BranchOptionStockOut
                {
                    BranchId = @event.BranchId,
                    CustomizationOptionId = option.Id,
                });
            }

            affectedItemIds.Add(option.ItemCustomization!.CatalogItemId);
        }

        if (affectedItemIds.Count == 0)
        {
            return;
        }

        // The item itself did not move, but one of its options did: republish
        // the item's effective branch availability so the CatalogChanged push
        // makes every client refetch it and pick up the option flag
        var items = await catalogContext.CatalogItems
            .Where(i => affectedItemIds.Contains(i.Id))
            .ToListAsync();
        var overrides = await catalogContext.BranchItemOverrides
            .Where(o => o.BranchId == @event.BranchId && affectedItemIds.Contains(o.CatalogItemId))
            .ToDictionaryAsync(o => o.CatalogItemId);

        var changedEvents = new List<IntegrationEvent>();
        foreach (var item in items)
        {
            var branchOverride = overrides.GetValueOrDefault(item.Id);
            var effective = item.IsAvailable
                && (branchOverride is null || (branchOverride.IsAvailable && !branchOverride.IsOutOfStock));
            changedEvents.Add(new CatalogItemAvailabilityChangedIntegrationEvent(item.Id, @event.BranchId, effective));
        }

        await catalogIntegrationEventService.SaveEventsAndCatalogContextChangesAsync(changedEvents);
        foreach (var changedEvent in changedEvents)
        {
            await catalogIntegrationEventService.PublishThroughEventBusAsync(changedEvent);
        }
    }
}
