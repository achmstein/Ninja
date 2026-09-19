using Ninja.EventBus.Events;

namespace Ninja.Notification.API.IntegrationEvents.Events;

// Local copy of Catalog.API's event: the type name is the routing key, the
// property names the JSON contract.
public record CatalogItemAvailabilityChangedIntegrationEvent(
    int ItemId,
    int? BranchId,
    bool IsAvailable) : IntegrationEvent;
