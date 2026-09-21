using Ninja.EventBus.Events;
using Ninja.Notification.API.Model;

namespace Ninja.Notification.API.IntegrationEvents.Events;

/// <summary>A party sat down at a plain table on their reservation; the table is theirs until the staff complete it (Spaces).</summary>
public record ReservationSeatedIntegrationEvent(
    int ReservationId,
    int PlaceId,
    string PlaceKind,
    LocalizedText PlaceName,
    string? CustomerId,
    string? CustomerName,
    int BranchId = 1) : IntegrationEvent;
