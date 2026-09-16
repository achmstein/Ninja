using Chillax.Notification.API.Model;
using Chillax.EventBus.Events;

namespace Chillax.Notification.API.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the event Spaces publishes when a customer is assigned
/// to a session that had nobody named on it.
/// </summary>
public record SessionCustomerAssignedIntegrationEvent(
    int ReservationId,
    int RoomId,
    string CustomerId,
    string? CustomerName,
    int BranchId = 0,
    int PlaceId = 0,
    string PlaceKind = "Room",
    LocalizedText? PlaceName = null) : IntegrationEvent;
