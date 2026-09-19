using Ninja.EventBus.Events;

namespace Ninja.Inventory.API.Application.IntegrationEvents.Events;

/// <summary>
/// A stock item dropped to or below its reorder level at a branch, on this
/// movement. Notification pushes it to the back office.
/// </summary>
public record StockLowIntegrationEvent(
    int BranchId,
    int StockItemId,
    LocalizedText Name,
    string Unit,
    decimal OnHand,
    decimal ReorderLevel) : IntegrationEvent;
