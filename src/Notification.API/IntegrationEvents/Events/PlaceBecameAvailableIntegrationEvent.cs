using Ninja.EventBus.Events;
using Ninja.Notification.API.Model;

namespace Ninja.Notification.API.IntegrationEvents.Events;

public record PlaceBecameAvailableIntegrationEvent(
    int PlaceId,
    string PlaceKind,
    LocalizedText PlaceName,
    int BranchId = 1) : IntegrationEvent;
