using Chillax.EventBus.Events;

namespace Chillax.Spaces.API.Application.IntegrationEvents.Events;

/// <summary>
/// Integration event published when a customer is assigned to a session that
/// had nobody named on it. A pointer for the room screens: the session, its
/// room and who it now belongs to.
/// </summary>
public record SessionCustomerAssignedIntegrationEvent(
    int ReservationId,
    int RoomId,
    string CustomerId,
    string? CustomerName,
    int BranchId = 0) : IntegrationEvent;
