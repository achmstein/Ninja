using Ninja.EventBus.Events;

namespace Ninja.Inventory.API.Application.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of Ordering's event: a confirmed order will never be sold,
/// and the stock its confirmation took goes as <paramref name="Disposition"/>
/// ("Waste" or "Restock"). Once per order.
/// </summary>
/// <param name="Reason">"Cancelled", "Voided" or "PlatformCancelled": the movements' story, nothing more.</param>
public record OrderStockReleasedIntegrationEvent(
    int OrderId,
    int BranchId,
    string Disposition,
    string Reason) : IntegrationEvent;
