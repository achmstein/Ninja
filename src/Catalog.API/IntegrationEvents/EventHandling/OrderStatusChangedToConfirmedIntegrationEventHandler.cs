using Ninja.Catalog.API.Model;

namespace Ninja.Catalog.API.IntegrationEvents.EventHandling;

/// <summary>
/// Records what each customer orders, one purchase fact per (customer, item,
/// order), so the till and the customer menu can offer their "usuals". Idempotent:
/// the unique index on (UserId, CatalogItemId, OrderId) means a redelivered or
/// re-confirmed order adds nothing. Guest/walk-in orders (no identity) are skipped.
/// </summary>
public class OrderStatusChangedToConfirmedIntegrationEventHandler(
    CatalogContext catalogContext,
    ILogger<OrderStatusChangedToConfirmedIntegrationEventHandler> logger) :
    IIntegrationEventHandler<OrderStatusChangedToConfirmedIntegrationEvent>
{
    public async Task Handle(OrderStatusChangedToConfirmedIntegrationEvent @event)
    {
        // No account, nothing to attribute (guest / walk-in).
        if (string.IsNullOrEmpty(@event.BuyerIdentityGuid) || @event.Items.Count == 0)
        {
            return;
        }

        // One item can appear on several lines of an order (different
        // customizations) — collapse to one fact per product, units summed.
        var perProduct = @event.Items
            .GroupBy(i => i.ProductId)
            .Select(g => new { ProductId = g.Key, Units = g.Sum(i => i.Units) })
            .ToList();

        var productIds = perProduct.Select(p => p.ProductId).ToList();

        // Which facts already exist for this order (idempotency for redelivery).
        var already = await catalogContext.CustomerItemPurchases
            .Where(p => p.UserId == @event.BuyerIdentityGuid
                && p.OrderId == @event.OrderId
                && productIds.Contains(p.CatalogItemId))
            .Select(p => p.CatalogItemId)
            .ToListAsync();

        var added = 0;
        foreach (var item in perProduct)
        {
            if (already.Contains(item.ProductId))
            {
                continue;
            }

            catalogContext.CustomerItemPurchases.Add(new CustomerItemPurchase
            {
                UserId = @event.BuyerIdentityGuid,
                CatalogItemId = item.ProductId,
                OrderId = @event.OrderId,
                Units = item.Units,
                OrderedAt = DateTime.UtcNow,
            });
            added++;
        }

        if (added > 0)
        {
            await catalogContext.SaveChangesAsync();
        }

        logger.LogInformation(
            "Recorded {Added} item purchase(s) for user {UserId} from order {OrderId}",
            added, @event.BuyerIdentityGuid, @event.OrderId);
    }
}
