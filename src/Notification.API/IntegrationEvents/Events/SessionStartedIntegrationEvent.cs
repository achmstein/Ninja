using Ninja.EventBus.Events;
using Ninja.Notification.API.Model;

namespace Ninja.Notification.API.IntegrationEvents.Events;

/// <summary>
/// Integration event received when admin starts a session (customer begins playing)
/// </summary>
public record SessionStartedIntegrationEvent(
    int ReservationId,
    // LEGACY(places): old RoomId/RoomName Spaces still fills beside PlaceId/PlaceKind/PlaceName — remove when every till and customer app is on /api/places and /api/stays.
    int RoomId,
    LocalizedText RoomName,
    string? CustomerId,
    DateTime? ActualStartTime,
    // LEGACY(places): the option's English name, superseded by OptionCode — remove when every till and customer app is on /api/places and /api/stays.
    string? PlayerMode,
    int BranchId = 0,
    int PlaceId = 0,
    string PlaceKind = "Room",
    LocalizedText? PlaceName = null,
    string? OptionCode = null) : IntegrationEvent;
