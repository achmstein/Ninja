using Chillax.EventBus.Events;
using Chillax.Notification.API.Model;

namespace Chillax.Notification.API.IntegrationEvents.Events;

/// <summary>
/// Integration event received when admin ends a session
/// Used to dismiss session notifications on customer devices
/// </summary>
public record SessionEndedIntegrationEvent(
    int ReservationId,
    int RoomId,
    LocalizedText RoomName,
    List<string> MemberUserIds,
    int PlaceId = 0,
    string PlaceKind = "Room",
    LocalizedText? PlaceName = null) : IntegrationEvent;
