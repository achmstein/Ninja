using Chillax.EventBus.Events;
using Chillax.Notification.API.Model;

namespace Chillax.Notification.API.IntegrationEvents.Events;

/// <summary>
/// Integration event received when a customer cancels their reservation
/// </summary>
public record ReservationCancelledIntegrationEvent(
    int ReservationId,
    int RoomId,
    LocalizedText RoomName,
    string? CustomerId,
    string? CustomerName,
    int BranchId = 1,
    int PlaceId = 0,
    string PlaceKind = "Room",
    LocalizedText? PlaceName = null,
    bool WasRunning = false) : IntegrationEvent;
