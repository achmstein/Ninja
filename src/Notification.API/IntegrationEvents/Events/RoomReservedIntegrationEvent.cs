using Chillax.EventBus.Events;
using Chillax.Notification.API.Model;

namespace Chillax.Notification.API.IntegrationEvents.Events;

/// <summary>
/// Integration event published when a customer reserves a room
/// </summary>
public record RoomReservedIntegrationEvent(
    int ReservationId,
    int RoomId,
    LocalizedText RoomName,
    string? CustomerId,
    string? CustomerName,
    DateTime? ExpiresAt,
    int BranchId = 1,
    int PlaceId = 0,
    string PlaceKind = "Room",
    LocalizedText? PlaceName = null,
    bool StartOnConfirm = false) : IntegrationEvent;
