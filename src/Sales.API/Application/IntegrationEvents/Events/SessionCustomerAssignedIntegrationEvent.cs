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
    // LEGACY(places): the old RoomId, the same value as the place id — remove when every till and customer app is on /api/places and /api/stays.
    int RoomId,
    string CustomerId,
    string? CustomerName = null,
    int BranchId = 0) : IntegrationEvent;
