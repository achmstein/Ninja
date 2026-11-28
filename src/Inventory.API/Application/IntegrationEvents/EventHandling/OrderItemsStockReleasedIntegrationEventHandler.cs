#nullable enable
using Ninja.EventBus.Abstractions;
using Ninja.Inventory.API.Application.IntegrationEvents.Events;
using Ninja.Inventory.API.Application.Services;

namespace Ninja.Inventory.API.Application.IntegrationEvents.EventHandling;

/// <summary>
/// Some items of a confirmed order will never be sold: what their recipes
/// took comes back off the order's sale, and made, goes out as waste
/// (<see cref="SaleRelease.BuildPartDrafts"/>). Idempotent per cancel by its
/// key. Items without a recipe took nothing and give back nothing.
/// </summary>
public class OrderItemsStockReleasedIntegrationEventHandler(
    IRecipeRepository recipes,
    IStockLedger ledger,
    IStockPostingService posting,
    InventoryTransaction transaction,
    ILogger<OrderItemsStockReleasedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<OrderItemsStockReleasedIntegrationEvent>
{
    public Task Handle(OrderItemsStockReleasedIntegrationEvent @event)
        => transaction.RunAsync(nameof(OrderItemsStockReleasedIntegrationEvent), () => Release(@event));

    private async Task Release(OrderItemsStockReleasedIntegrationEvent @event)
    {
        if (@event.Disposition is not (SaleRelease.Waste or SaleRelease.Restock))
        {
            logger.LogWarning("Order {OrderId} items released as {Disposition}, which is neither - ignored", @event.OrderId, @event.Disposition);
            return;
        }

        if (await ledger.HasReferenceAsync(SaleRelease.PartReferenceFor(@event.OrderId, @event.Key))
            || await ledger.HasReferenceAsync(SaleRelease.ReferenceFor(@event.OrderId)))
        {
            logger.LogInformation("Order {OrderId}: these items, or the whole order, already released - ignored", @event.OrderId);
            return;
        }

        var sale = await ledger.GetByReferenceAsync(SaleDeduction.ReferenceFor(@event.OrderId));
        if (sale.Count == 0 || @event.Items.Count == 0)
        {
            logger.LogInformation("Order {OrderId} took no stock - nothing to release", @event.OrderId);
            return;
        }

        // What these items' recipes take, by stock item: the sale's own arithmetic, on just them
        var recipeList = await recipes.GetManyAsync(@event.Items.Select(i => i.ProductId));
        var wanted = SaleDeduction.BuildDrafts(@event.OrderId, @event.Items, recipeList.ToDictionary(r => r.CatalogItemId))
            .ToDictionary(d => d.StockItemId, d => -d.Quantity);

        var givenBack = await ledger.GetByReferencePrefixAsync(SaleRelease.PartPrefixFor(@event.OrderId));
        var lastCounted = await ledger.GetLastCountedAtAsync(@event.BranchId, sale.Select(m => m.StockItemId));
        var drafts = SaleRelease.BuildPartDrafts(@event.OrderId, @event.Key, @event.Disposition, wanted, sale, givenBack, lastCounted);

        if (drafts.Count == 0)
        {
            logger.LogInformation("Order {OrderId}: nothing of the cancelled items left to release", @event.OrderId);
            return;
        }

        await posting.PostAsync(@event.BranchId, drafts, "system");

        logger.LogInformation(
            "Order {OrderId}: cancelled items released {Count} movement(s) as {Disposition} at branch {BranchId}",
            @event.OrderId, drafts.Count, @event.Disposition, @event.BranchId);
    }
}
