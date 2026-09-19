using Ninja.EventBus.Events;

namespace Ninja.Sales.API.Application.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the event Spaces publishes when a session starts (services
/// share no contracts assembly — each declares the fields it reads).
/// Sales opens the session's ticket off it.
/// </summary>
public record SessionStartedIntegrationEvent(
    int ReservationId,
    // LEGACY(places): the old RoomId/RoomName, superseded by PlaceId/PlaceName — remove when every till and customer app is on /api/places and /api/stays.
    int RoomId,
    LocalizedText RoomName,
    DateTime? ActualStartTime,
    // LEGACY(places): the old "Single"/"Multi" word — remove when every till and customer app is on /api/places and /api/stays.
    string? PlayerMode,
    int BranchId = 0,
    string? CustomerId = null,
    int PlaceId = 0,
    string PlaceKind = "Room",
    LocalizedText? PlaceName = null) : IntegrationEvent;
