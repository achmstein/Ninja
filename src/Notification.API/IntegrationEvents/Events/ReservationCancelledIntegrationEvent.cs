using Chillax.EventBus.Events;
using Chillax.Notification.API.Model;

namespace Chillax.Notification.API.IntegrationEvents.Events;

/// <summary>
/// Integration event received when a customer cancels their reservation
/// </summary>
public record ReservationCancelledIntegrationEvent(
    int ReservationId,
    // LEGACY(places): old RoomId/RoomName Spaces still fills beside PlaceId/PlaceKind/PlaceName — remove when every till and customer app is on /api/places and /api/stays.
    int RoomId,
    LocalizedText RoomName,
    string? CustomerId,
    string? CustomerName,
    int BranchId = 1,
    int PlaceId = 0,
    string PlaceKind = "Room",
    LocalizedText? PlaceName = null,
    bool WasRunning = false) : IntegrationEvent;
