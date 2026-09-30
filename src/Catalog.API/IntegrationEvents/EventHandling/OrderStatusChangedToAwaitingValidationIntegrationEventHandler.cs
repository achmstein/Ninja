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
    /// <summary>Half a piastre: what rounding may leave between the app's sum and the menu's.</summary>
    private const decimal Tolerance = 0.005m;

    public async Task Handle(OrderStatusChangedToAwaitingValidationIntegrationEvent @event)
    {
        logger.LogInformation("Handling integration event: {IntegrationEventId} - ({@IntegrationEvent})", @event.Id, @event);

        // An Ordering from before lines names products only: those are checked, nothing is priced
        var priced = @event.Lines is not null && @event.PriceCheck;
        var lines = @event.Lines
            ?? @event.OrderStockItems.Select(s => new OrderValidationLine(0, s.ProductId, s.Units, 0, null)).ToList();

        var productIds = lines.Select(l => l.ProductId).Distinct().ToList();
        var items = await catalogContext.CatalogItems
            .Include(i => i.Customizations)
                .ThenInclude(c => c.Options)
            .AsSplitQuery()
            .Where(i => productIds.Contains(i.Id))
            .ToDictionaryAsync(i => i.Id);
        var branchOverrides = await catalogContext.BranchItemOverrides
            .Where(o => o.BranchId == @event.BranchId && productIds.Contains(o.CatalogItemId))
            .ToDictionaryAsync(o => o.CatalogItemId);
        var optionStockOuts = await CatalogApi.GetBranchOptionStockOuts(catalogContext, @event.BranchId);

        // The offer the customer saw is the one running when they ordered
        var placedLocal = TenantClock.ToLocal(@event.PlacedAt ?? TenantClock.UtcNow());

        var failures = new List<OrderValidationFailure>();
        var prices = new Dictionary<int, decimal>();
        var categories = new Dictionary<int, int>();

        foreach (var line in lines)
        {
            if (!items.TryGetValue(line.ProductId, out var item))
            {
                failures.Add(new(line.LineId, line.ProductId, OrderValidationReasons.UnknownItem));
                continue;
            }

            categories[item.Id] = item.CatalogTypeId;
            branchOverrides.TryGetValue(item.Id, out var branch);

            var (price, reason) = PriceLine(item, branch, line, optionStockOuts, placedLocal);
            if (reason is null && priced && price > line.UnitPrice + Tolerance)
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
    /// What one line costs at the menu's prices, or why it cannot be sold:
    /// the item off (a branch override can only restrict, the global flag
    /// always wins, an Inventory stock-out restricts like a manual sold-out),
    /// an option that is not the item's, or one this branch ran out of.
    /// </summary>
    internal static (decimal Price, string? Reason) PriceLine(
        CatalogItem item,
        BranchItemOverride? branch,
        OrderValidationLine line,
        IReadOnlySet<int> optionStockOuts,
        DateTime placedLocal)
    {
        var isAvailable = item.IsAvailable && (branch is null || (branch.IsAvailable && !branch.IsOutOfStock));
        if (!isAvailable)
            return (0, OrderValidationReasons.Unavailable);

        var options = item.Customizations.SelectMany(c => c.Options).ToDictionary(o => o.Id);
        var adjustments = 0m;
        // Ordering keeps each chosen option once, as the line is priced
        foreach (var optionId in (line.OptionIds ?? []).Distinct())
        {
            if (!options.TryGetValue(optionId, out var option))
                return (0, OrderValidationReasons.UnknownOption);
            if (optionStockOuts.Contains(optionId))
                return (0, OrderValidationReasons.OptionUnavailable);
            adjustments += option.PriceAdjustment;
        }

        return (item.PriceAt(branch, placedLocal).Effective + adjustments, null);
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
