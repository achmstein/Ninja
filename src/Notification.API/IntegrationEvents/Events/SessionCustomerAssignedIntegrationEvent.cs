using Ninja.Notification.API.Model;
using Ninja.EventBus.Events;

namespace Ninja.Notification.API.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the event Spaces publishes when a customer is assigned
/// to a session that had nobody named on it.
/// </summary>
public record SessionCustomerAssignedIntegrationEvent(
    int ReservationId,
    int PlaceId,
    string PlaceKind,
    LocalizedText PlaceName,
    string CustomerId,
    string? CustomerName,
    int BranchId = 0) : IntegrationEvent;
