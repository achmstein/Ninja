using Ninja.Notification.API.Model;
using Ninja.EventBus.Events;

namespace Ninja.Notification.API.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the event Spaces publishes when a customer is assigned
/// to a session that had nobody named on it.
/// </summary>
public record SessionCustomerAssignedIntegrationEvent(
    int ReservationId,
    // LEGACY(places): old RoomId Spaces still fills beside PlaceId/PlaceKind/PlaceName — remove when every till and customer app is on /api/places and /api/stays.
    int RoomId,
    string CustomerId,
    string? CustomerName,
    int BranchId = 0,
    int PlaceId = 0,
    string PlaceKind = "Room",
    LocalizedText? PlaceName = null) : IntegrationEvent;
