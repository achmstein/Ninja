using Ninja.Catalog.API.Application;

namespace Ninja.Catalog.API.IntegrationEvents.EventHandling;

/// <summary>
/// The menu's say on an order before anyone makes it. Each line must be an
/// item on the menu, on at this branch, with options that are the item's own
/// and not sold out here; and it costs what the menu says — the branch's
/// price, the offer as it stood when the order was placed, each option's
/// price — not what the app sent. A line the menu prices higher than the app
/// showed fails the order, so nobody pays more than they were shown; one it
/// prices lower goes through at the menu's price. The promo code is then
/// judged on the menu's total. A Talabat order (no price check) is checked
/// for what can be sold only; Talabat charged its own prices.
/// </summary>
public class OrderStatusChangedToAwaitingValidationIntegrationEventHandler(
    CatalogContext catalogContext,
    ICatalogIntegrationEventService catalogIntegrationEventService,
    ILogger<OrderStatusChangedToAwaitingValidationIntegrationEventHandler> logger) :
    IIntegrationEventHandler<OrderStatusChangedToAwaitingValidationIntegrationEvent>
{
    public async Task Handle(OrderStatusChangedToAwaitingValidationIntegrationEvent @event)
    {
        logger.LogInformation("Handling integration event: {IntegrationEventId} - ({@IntegrationEvent})", @event.Id, @event);

        // An Ordering from before lines names products only: those are checked, nothing is priced
        var priced = @event.Lines is not null && @event.PriceCheck;
        var lines = @event.Lines
            ?? @event.OrderStockItems.Select(s => new OrderValidationLine(0, s.ProductId, s.Units, 0, null)).ToList();

        // The branch's menu, priced as the till's price check prices it (BranchMenu)
        var menu = await BranchMenu.LoadAsync(catalogContext, @event.BranchId, lines.Select(l => l.ProductId));

        // The offer the customer saw is the one running when they ordered
        var placedLocal = TenantClock.ToLocal(@event.PlacedAt ?? TenantClock.UtcNow());

        var failures = new List<OrderValidationFailure>();
        var prices = new Dictionary<int, decimal>();
        var categories = new Dictionary<int, int>();

        foreach (var line in lines)
        {
            if (menu.Item(line.ProductId) is { } item)
                categories[item.Id] = item.CatalogTypeId;

            var lineAt = menu.Price(line.ProductId, line.OptionIds, placedLocal);
            var price = lineAt.Price;
            var reason = lineAt.Reason;
            if (reason is null && priced && BranchMenu.CostsMore(price, line.UnitPrice))
                reason = OrderValidationReasons.PriceChanged;

            if (reason is not null)
            {
                failures.Add(new(line.LineId, line.ProductId, reason));
                continue;
            }

            if (!priced)
                continue;

            prices[line.LineId] = price;
            if (price != line.UnitPrice)
            {
                // A claim under the menu's price is refused above; one over
                // it is corrected here. Either way the app sent a price it
                // should not have: an old app, or someone writing their own
                logger.LogWarning(
                    "Order {OrderId}: line {LineId} ({ProductId}) came at {Claimed}, the menu says {Price}",
                    @event.OrderId, line.LineId, line.ProductId, line.UnitPrice, price);
            }
        }

        IntegrationEvent answer;
        if (failures.Count > 0)
        {
            answer = new OrderValidationFailedIntegrationEvent(@event.OrderId, failures);
        }
        else
        {
            var itemsTotal = priced ? lines.Sum(l => prices[l.LineId] * l.Units) : @event.ItemsTotal;
            answer = await ValidateWithPromoAsync(@event, itemsTotal) with
            {
                Categories = categories,
                Prices = priced ? prices : null,
            };
        }

        await catalogIntegrationEventService.SaveEventAndCatalogContextChangesAsync(answer);
        await catalogIntegrationEventService.PublishThroughEventBusAsync(answer);
    }

    /// <summary>
    /// The lines are in: redeem the promo code the order carried, if any,
    /// against the items total the menu priced. Redeemed once per order (a
    /// redelivered event finds its redemption and repeats the same answer),
    /// and a code that does not apply validates the order at full price with
    /// the reason — the cart quoted it, so the customer only loses the
    /// discount if the code ran out in between.
    /// </summary>
    private async Task<OrderValidatedIntegrationEvent> ValidateWithPromoAsync(OrderStatusChangedToAwaitingValidationIntegrationEvent @event, decimal itemsTotal)
    {
        if (string.IsNullOrWhiteSpace(@event.PromoCode))
            return new OrderValidatedIntegrationEvent(@event.OrderId);

        var code = PromoCode.Normalize(@event.PromoCode);

        var already = await catalogContext.PromoRedemptions.FirstOrDefaultAsync(r => r.OrderId == @event.OrderId);
        if (already is not null)
            return new OrderValidatedIntegrationEvent(@event.OrderId, already.Code, already.Discount);

        var promo = await catalogContext.PromoCodes.FirstOrDefaultAsync(p => p.Code == code);
        if (promo is null)
            return new OrderValidatedIntegrationEvent(@event.OrderId, code, 0, PromoRefusal.NotFound);

        var customerKey = @event.CustomerKey ?? string.Empty;
        var used = customerKey.Length > 0
            && await catalogContext.PromoRedemptions.AnyAsync(r => r.Code == code && r.CustomerKey == customerKey);

        var quote = promo.Evaluate(itemsTotal, used, DateTime.UtcNow);
        if (!quote.Valid)
        {
            logger.LogInformation("Promo {Code} not applied to order {OrderId}: {Reason}", code, @event.OrderId, quote.Reason);
            return new OrderValidatedIntegrationEvent(@event.OrderId, code, 0, quote.Reason);
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

        return new OrderValidatedIntegrationEvent(@event.OrderId, code, quote.Discount);
    }
}
