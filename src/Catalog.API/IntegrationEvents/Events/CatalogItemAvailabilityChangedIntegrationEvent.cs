namespace Ninja.Catalog.API.IntegrationEvents.Events;

/// <summary>
/// An item was marked available / sold out. BranchId is null when the global
/// flag changed, otherwise the branch whose override moved; IsAvailable is
/// the effective state that branch's menus now show.
/// </summary>
public record CatalogItemAvailabilityChangedIntegrationEvent(int ItemId, int? BranchId, bool IsAvailable) : IntegrationEvent;
