using Chillax.EventBus.Events;

namespace Chillax.Inventory.API.Application.IntegrationEvents.Events;

/// <summary>
/// Stock left the shelf and cost something: consumed by a sale (through
/// the recipes) or thrown away. The cost is what the units were worth at
/// their branch average when they left — the cost of goods, for Finance's
/// profit and loss. One event per posting; its id is the replay guard.
/// </summary>
public record StockConsumedIntegrationEvent(
    int BranchId,
    string Kind,
    string? Reference,
    decimal Cost,
    DateTime At) : IntegrationEvent;
