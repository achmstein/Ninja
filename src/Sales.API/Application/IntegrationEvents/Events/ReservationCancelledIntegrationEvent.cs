using Ninja.EventBus.Events;

namespace Ninja.Sales.API.Application.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the event Spaces publishes when a reservation or an
/// active session is cancelled (services share no contracts assembly — each
/// declares the fields it reads). Sales drops the session's still-empty
/// ticket off it: no time is coming for it.
/// </summary>
public record ReservationCancelledIntegrationEvent(
    int ReservationId,
    int PlaceId,
    string PlaceKind,
    LocalizedText PlaceName,
    string? CustomerId,
    string? CustomerName,
    int BranchId = 1) : IntegrationEvent;
