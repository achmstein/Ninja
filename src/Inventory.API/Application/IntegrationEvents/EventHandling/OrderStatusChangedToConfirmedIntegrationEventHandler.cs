#nullable enable
using Ninja.EventBus.Abstractions;
using Ninja.Inventory.API.Application.IntegrationEvents.Events;
using Ninja.Inventory.API.Application.Services;

namespace Ninja.Inventory.API.Application.IntegrationEvents.EventHandling;

/// <summary>
/// A confirmed order takes its ingredients off the shelf. Idempotent per
/// order: the bus delivers at least once, and the order's reference on its
/// movements (plus the unique index behind it) means a redelivery posts
/// nothing. Items without a recipe are not tracked and post nothing. A
/// void or refund later never puts stock back (the business cannot know whether
/// the drink was made); staff record a return by hand when one happens.
/// </summary>
public class OrderStatusChangedToConfirmedIntegrationEventHandler(
    IRecipeRepository recipes,
    IStockLedger ledger,
    IStockPostingService posting,
    InventoryTransaction transaction,
    ILogger<OrderStatusChangedToConfirmedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<OrderStatusChangedToConfirmedIntegrationEvent>
{
    public Task Handle(OrderStatusChangedToConfirmedIntegrationEvent @event)
        => transaction.RunAsync(nameof(OrderStatusChangedToConfirmedIntegrationEvent), () => Deduct(@event));

    private async Task Deduct(OrderStatusChangedToConfirmedIntegrationEvent @event)
    {
        if (@event.Items.Count == 0)
        {
            logger.LogWarning("Order {OrderId} confirmed without line items - nothing to deduct", @event.OrderId);
            return;
        }

        var reference = SaleDeduction.ReferenceFor(@event.OrderId);

        if (await ledger.HasReferenceAsync(reference))
        {
            logger.LogInformation("Order {OrderId} already deducted - redelivery ignored", @event.OrderId);
            return;
        }

        var recipeList = await recipes.GetManyAsync(@event.Items.Select(i => i.ProductId));
        var drafts = SaleDeduction.BuildDrafts(@event.OrderId, @event.Items, recipeList.ToDictionary(r => r.CatalogItemId));

        if (drafts.Count == 0)
        {
            logger.LogInformation("Order {OrderId} has no tracked items - nothing to deduct", @event.OrderId);
            return;
        }

        // A replayed offline sale that arrives after a stocktake: the count
        // already saw the shelf without these units, and booked them as
        // missing. The sale still costs its goods; a correction to the count
        // puts the units back where the count left them
        var lastCounted = await ledger.GetLastCountedAtAsync(@event.BranchId, drafts.Select(d => d.StockItemId));
        var counted = SaleDeduction.CountedSince(@event.OrderId, drafts, @event.PlacedAt, lastCounted);

        if (counted.Count > 0)
        {
            logger.LogInformation(
                "Order {OrderId} placed {PlacedAt}: {Counted} item(s) counted since, the count corrected",
                @event.OrderId, @event.PlacedAt, counted.Count);
        }

        // Its cost lands on the day it was sold, not the day a late replay arrived
        await posting.PostAsync(@event.BranchId, [.. drafts, .. counted], "system", @event.PlacedAt);

        logger.LogInformation(
            "Order {OrderId} deducted {Count} stock item(s) at branch {BranchId}",
            @event.OrderId, drafts.Count, @event.BranchId);
    }
}
