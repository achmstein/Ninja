#nullable enable
using Ninja.EventBus.Events;

namespace Ninja.Inventory.API.Application.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of Ordering's event: some items of a confirmed order were
/// cancelled at the till, and the stock they took goes as
/// <paramref name="Disposition"/> ("Waste" or "Restock"). Once per <paramref name="Key"/>.
/// </summary>
public record OrderItemsStockReleasedIntegrationEvent(
    int OrderId,
    int BranchId,
    Guid Key,
    string Disposition,
    List<OrderConfirmedItem> Items) : IntegrationEvent;
