using Chillax.EventBus.Events;

namespace Chillax.Inventory.API.Application.IntegrationEvents.Events;

/// <summary>
/// Customization options whose tracked ingredient ran out at a branch
/// (InStock false) or is back (true): a roast whose beans are gone. Catalog
/// hides the option at that branch and tells every menu. Published only on
/// a change.
/// </summary>
public record CatalogOptionStockChangedIntegrationEvent(int BranchId, List<int> OptionIds, bool InStock) : IntegrationEvent;
