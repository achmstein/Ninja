using Ninja.EventBus.Events;

namespace Ninja.Inventory.API.Application.IntegrationEvents.Events;

/// <summary>
/// Stock left the shelf and cost something: consumed by a sale (through
/// the recipes) or thrown away. The cost is what the units were worth at
/// their branch average when they left — the cost of goods, for Finance's
/// profit and loss. One event per posting; its id is the replay guard.
/// <para>
/// <c>Kind</c> is "Sale", "Waste", or "SaleReversal": a confirmed order that
/// was never sold gives back what its sale cost (at the cost it went out at),
/// to take out of the cost of goods. A made one then posts its "Waste".
/// </para>
/// </summary>
public record StockConsumedIntegrationEvent(
    int BranchId,
    string Kind,
    string? Reference,
    decimal Cost,
    DateTime At) : IntegrationEvent;
