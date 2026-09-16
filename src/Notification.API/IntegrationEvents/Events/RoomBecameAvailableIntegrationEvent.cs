using Chillax.EventBus.Events;
using Chillax.Notification.API.Model;

namespace Chillax.Notification.API.IntegrationEvents.Events;

public record RoomBecameAvailableIntegrationEvent(
    int RoomId,
    LocalizedText RoomName,
    int BranchId = 1,
    int PlaceId = 0,
    string PlaceKind = "Room",
    LocalizedText? PlaceName = null) : IntegrationEvent;
