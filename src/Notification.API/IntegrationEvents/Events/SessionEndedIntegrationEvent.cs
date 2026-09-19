using Ninja.EventBus.Events;
using Ninja.Notification.API.Model;

namespace Ninja.Notification.API.IntegrationEvents.Events;

/// <summary>
/// Integration event received when admin ends a session
/// Used to dismiss session notifications on customer devices
/// </summary>
public record SessionEndedIntegrationEvent(
    int ReservationId,
    // LEGACY(places): old RoomId/RoomName Spaces still fills beside PlaceId/PlaceKind/PlaceName — remove when every till and customer app is on /api/places and /api/stays.
    int RoomId,
    LocalizedText RoomName,
    List<string> MemberUserIds,
    int PlaceId = 0,
    string PlaceKind = "Room",
    LocalizedText? PlaceName = null) : IntegrationEvent;
