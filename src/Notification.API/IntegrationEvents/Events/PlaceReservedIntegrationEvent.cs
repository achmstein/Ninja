using Ninja.EventBus.Events;
using Ninja.Notification.API.Model;

namespace Ninja.Notification.API.IntegrationEvents.Events;

/// <summary>
/// Integration event published when a customer reserves a room
/// </summary>
public record PlaceReservedIntegrationEvent(
    int ReservationId,
    int PlaceId,
    string PlaceKind,
    LocalizedText PlaceName,
    string? CustomerId,
    string? CustomerName,
    DateTime? ExpiresAt,
    int BranchId = 1,
    bool StartOnConfirm = false) : IntegrationEvent;
