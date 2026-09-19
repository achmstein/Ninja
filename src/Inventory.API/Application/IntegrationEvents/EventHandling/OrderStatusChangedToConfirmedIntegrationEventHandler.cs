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
/// void or refund later never puts stock back (the café cannot know whether
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
        // already saw the shelf without these units
        var lastCounted = await ledger.GetLastCountedAtAsync(@event.BranchId, drafts.Select(d => d.StockItemId));
        var toPost = SaleDeduction.DropCountedAfter(drafts, @event.PlacedAt, lastCounted);

        if (toPost.Count < drafts.Count)
        {
            logger.LogInformation(
                "Order {OrderId} placed {PlacedAt}: {Skipped} item(s) counted since, left alone",
                @event.OrderId, @event.PlacedAt, drafts.Count - toPost.Count);
        }

        if (toPost.Count == 0)
            return;

        await posting.PostAsync(@event.BranchId, toPost, "system");

        logger.LogInformation(
            "Order {OrderId} deducted {Count} stock item(s) at branch {BranchId}",
            @event.OrderId, drafts.Count, @event.BranchId);
    }
}
