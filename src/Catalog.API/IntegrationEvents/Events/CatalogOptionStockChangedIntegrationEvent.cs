namespace Ninja.Catalog.API.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the event Inventory publishes when a tracked ingredient a
/// customization option needs ran out (<see cref="InStock"/> false) or came
/// back (true) at a branch. Catalog folds it into <see cref="BranchOptionStockOut"/> rows.
/// </summary>
public record CatalogOptionStockChangedIntegrationEvent(int BranchId, List<int> OptionIds, bool InStock) : IntegrationEvent;
