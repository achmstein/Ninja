using Ninja.EventBus.Events;
using Ninja.Notification.API.Model;

namespace Ninja.Notification.API.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the event Inventory publishes when a stock item's on-hand
/// quantity at a branch drops to or below its reorder level. Carried to the
/// staff SignalR group so the admin and till can show a low-stock notice.
/// </summary>
public record StockLowIntegrationEvent(
    int BranchId,
    int StockItemId,
    LocalizedText Name,
    string Unit,
    decimal OnHand,
    decimal ReorderLevel) : IntegrationEvent;
