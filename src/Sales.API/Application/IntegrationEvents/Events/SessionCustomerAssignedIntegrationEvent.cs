#nullable enable
using Chillax.EventBus.Events;

namespace Chillax.Sales.API.Application.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the event Spaces publishes when a walk-in session gets
/// its customer. Sales notes them on the session's ticket so they may read
/// the receipt later.
/// </summary>
public record SessionCustomerAssignedIntegrationEvent(
    int ReservationId,
    int RoomId,
    string CustomerId,
    string? CustomerName = null,
    int BranchId = 0) : IntegrationEvent;
