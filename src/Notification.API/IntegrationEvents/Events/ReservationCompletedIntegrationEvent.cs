using Ninja.EventBus.Events;
using Ninja.Notification.API.Model;

namespace Ninja.Notification.API.IntegrationEvents.Events;

/// <summary>The party left a plain table; the reservation is over and the table is free (Spaces).</summary>
public record ReservationCompletedIntegrationEvent(
    int ReservationId,
    int PlaceId,
    string PlaceKind,
    LocalizedText PlaceName,
    string? CustomerId,
    string? CustomerName,
    int BranchId = 1) : IntegrationEvent;
