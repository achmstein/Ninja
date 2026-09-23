namespace Ninja.Catalog.API.IntegrationEvents.EventHandling;

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
        var categories = new Dictionary<int, int>();

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
                categories[catalogItem.Id] = catalogItem.CatalogTypeId;
            }
        }

        var confirmedIntegrationEvent = confirmedOrderStockItems.Any(c => !c.HasStock)
            ? (IntegrationEvent)new OrderStockRejectedIntegrationEvent(@event.OrderId, confirmedOrderStockItems)
            : await ConfirmWithPromoAsync(@event) with { Categories = categories };

        await catalogIntegrationEventService.SaveEventAndCatalogContextChangesAsync(confirmedIntegrationEvent);
        await catalogIntegrationEventService.PublishThroughEventBusAsync(confirmedIntegrationEvent);
    }

    /// <summary>
    /// The items are in: redeem the promo code the order carried, if any.
    /// Redeemed once per order (a redelivered event finds its redemption and
    /// repeats the same answer), and a code that does not apply confirms the
    /// order at full price with the reason — the cart quoted it, so the
    /// customer only loses the discount if the code ran out in between.
    /// </summary>
    private async Task<OrderStockConfirmedIntegrationEvent> ConfirmWithPromoAsync(OrderStatusChangedToAwaitingValidationIntegrationEvent @event)
    {
        if (string.IsNullOrWhiteSpace(@event.PromoCode))
            return new OrderStockConfirmedIntegrationEvent(@event.OrderId);

        var code = PromoCode.Normalize(@event.PromoCode);

        var already = await catalogContext.PromoRedemptions.FirstOrDefaultAsync(r => r.OrderId == @event.OrderId);
        if (already is not null)
            return new OrderStockConfirmedIntegrationEvent(@event.OrderId, already.Code, already.Discount);

        var promo = await catalogContext.PromoCodes.FirstOrDefaultAsync(p => p.Code == code);
        if (promo is null)
            return new OrderStockConfirmedIntegrationEvent(@event.OrderId, code, 0, PromoRefusal.NotFound);

        var customerKey = @event.CustomerKey ?? string.Empty;
        var used = customerKey.Length > 0
            && await catalogContext.PromoRedemptions.AnyAsync(r => r.Code == code && r.CustomerKey == customerKey);

        var quote = promo.Evaluate(@event.ItemsTotal, used, DateTime.UtcNow);
        if (!quote.Valid)
        {
            logger.LogInformation("Promo {Code} not applied to order {OrderId}: {Reason}", code, @event.OrderId, quote.Reason);
            return new OrderStockConfirmedIntegrationEvent(@event.OrderId, code, 0, quote.Reason);
        }

        promo.Uses++;
        catalogContext.PromoRedemptions.Add(new PromoRedemption
        {
            Code = code,
            OrderId = @event.OrderId,
            CustomerKey = customerKey,
            Discount = quote.Discount,
            RedeemedAt = DateTime.UtcNow,
        });

        return new OrderStockConfirmedIntegrationEvent(@event.OrderId, code, quote.Discount);
    }
}
