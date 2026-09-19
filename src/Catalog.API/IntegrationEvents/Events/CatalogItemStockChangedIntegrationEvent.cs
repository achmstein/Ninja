namespace Ninja.Catalog.API.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the event Inventory publishes when a tracked ingredient a
/// menu item needs ran out (<see cref="InStock"/> false) or came back (true)
/// at a branch. Catalog folds it into the branch override's out-of-stock flag.
/// </summary>
public record CatalogItemStockChangedIntegrationEvent(int BranchId, List<int> CatalogItemIds, bool InStock) : IntegrationEvent;
