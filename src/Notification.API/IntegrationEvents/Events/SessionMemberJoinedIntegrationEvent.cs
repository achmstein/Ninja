using Ninja.EventBus.Events;
using Ninja.Notification.API.Model;

namespace Ninja.Notification.API.IntegrationEvents.Events;

/// <summary>
/// Integration event received when a customer joins an active session
/// Used to send session notification to the joining member
/// </summary>
public record SessionMemberJoinedIntegrationEvent(
    int ReservationId,
    // LEGACY(places): old RoomId/RoomName Spaces still fills beside PlaceId/PlaceKind/PlaceName — remove when every till and customer app is on /api/places and /api/stays.
    int RoomId,
    LocalizedText RoomName,
    string MemberUserId,
    DateTime? ActualStartTime,
    // LEGACY(places): the option's English name, superseded by OptionCode — remove when every till and customer app is on /api/places and /api/stays.
    string? PlayerMode,
    int PlaceId = 0,
    string PlaceKind = "Room",
    LocalizedText? PlaceName = null,
    string? OptionCode = null) : IntegrationEvent;
