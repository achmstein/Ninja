using Ninja.EventBus.Events;

namespace Ninja.Sales.API.Application.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the event Spaces publishes when a reservation is given
/// up or a running stay is cut short (services share no contracts assembly
/// — each declares the fields it reads). Sales only cares about the second:
/// ReservationId is then the session a ticket was opened for, and its
/// still-empty ticket is dropped — no time is coming for it. A reservation
/// that never seated anyone has no ticket, and its id is from another
/// sequence, so WasRunning is what tells the two apart.
/// </summary>
public record ReservationCancelledIntegrationEvent(
    int ReservationId,
    int PlaceId,
    string PlaceKind,
    LocalizedText PlaceName,
    string? CustomerId,
    string? CustomerName,
    int BranchId = 1,
    bool WasRunning = false) : IntegrationEvent;
