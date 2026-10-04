#nullable enable
using Ninja.EventBus.Abstractions;
using Ninja.Inventory.API.Application.IntegrationEvents.Events;
using Ninja.Inventory.API.Application.Services;

namespace Ninja.Inventory.API.Application.IntegrationEvents.EventHandling;

/// <summary>
/// A confirmed order will never be sold: its sale is reversed, and what was
/// made is written off as waste, what was not goes back on the shelf
/// (<see cref="SaleRelease"/>). Idempotent per order by the reversal's
/// reference. An order that took nothing (no recipes, or counted since) posts nothing.
/// </summary>
public class OrderStockReleasedIntegrationEventHandler(
    IStockLedger ledger,
    IStockPostingService posting,
    InventoryTransaction transaction,
    ILogger<OrderStockReleasedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<OrderStockReleasedIntegrationEvent>
{
    public Task Handle(OrderStockReleasedIntegrationEvent @event)
        => transaction.RunAsync(nameof(OrderStockReleasedIntegrationEvent), () => Release(@event));

    private async Task Release(OrderStockReleasedIntegrationEvent @event)
    {
        if (@event.Disposition is not (SaleRelease.Waste or SaleRelease.Restock))
        {
            logger.LogWarning("Order {OrderId} released as {Disposition}, which is neither - ignored", @event.OrderId, @event.Disposition);
            return;
        }

        if (await ledger.HasReferenceAsync(SaleRelease.ReferenceFor(@event.OrderId)))
        {
            logger.LogInformation("Order {OrderId} already released - redelivery ignored", @event.OrderId);
            return;
        }

        var sale = await ledger.GetByReferenceAsync(SaleDeduction.ReferenceFor(@event.OrderId));

        if (sale.Count == 0)
        {
            logger.LogInformation("Order {OrderId} took no stock - nothing to release", @event.OrderId);
            return;
        }

        var lastCounted = await ledger.GetLastCountedAtAsync(@event.BranchId, sale.Select(m => m.StockItemId));
        var drafts = SaleRelease.BuildDrafts(@event.OrderId, @event.Disposition, sale, lastCounted);

        if (drafts.Count == 0)
        {
            logger.LogInformation("Order {OrderId}: every item counted since the sale - left alone", @event.OrderId);
            return;
        }

        await posting.PostAsync(@event.BranchId, drafts, "system");

        logger.LogInformation(
            "Order {OrderId} {Reason}: {Count} stock item(s) released as {Disposition} at branch {BranchId}",
            @event.OrderId, @event.Reason, sale.Count, @event.Disposition, @event.BranchId);
    }
}
