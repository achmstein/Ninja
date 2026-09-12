using Chillax.EventBus.Events;

namespace Chillax.Inventory.API.Application.IntegrationEvents.Events;

/// <summary>
/// Menu items whose tracked ingredients ran out at a branch (InStock false)
/// or are all back (InStock true). Catalog turns it into the branch's
/// out-of-stock flag and tells every menu. Published only on a change, never
/// on every movement.
/// </summary>
public record CatalogItemStockChangedIntegrationEvent(int BranchId, List<int> CatalogItemIds, bool InStock) : IntegrationEvent;
