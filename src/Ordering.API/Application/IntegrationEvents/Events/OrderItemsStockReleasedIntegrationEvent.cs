#nullable enable
namespace Ninja.Ordering.API.Application.IntegrationEvents.Events;

/// <summary>
/// Some items of a confirmed order will never be sold (cancelled at the till):
/// the stock they took is let go, as waste or back to the shelf. Inventory
/// reverses that part of the order's sale, once per <see cref="Key"/>; a
/// release of the whole order later leaves out what this gave back.
/// </summary>
/// <param name="Disposition">"Waste" (the food was made) or "Restock" (it never was).</param>
public record OrderItemsStockReleasedIntegrationEvent(
    int OrderId,
    int BranchId,
    Guid Key,
    string Disposition,
    IReadOnlyCollection<ReleasedOrderItem> Items) : IntegrationEvent;

/// <summary>A cancelled item as Inventory reads a sale: the catalog item, how many, and the options that decide its recipe.</summary>
public record ReleasedOrderItem(int ProductId, int Units, IReadOnlyList<int>? OptionIds);
