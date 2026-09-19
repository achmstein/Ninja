using Ninja.EventBus.Events;
using Ninja.Notification.API.Model;

namespace Ninja.Notification.API.IntegrationEvents.Events;

/// <summary>
/// Integration event received when admin starts a session (customer begins playing)
/// </summary>
public record SessionStartedIntegrationEvent(
    int ReservationId,
    int PlaceId,
    string PlaceKind,
    LocalizedText PlaceName,
    string? CustomerId,
    DateTime? ActualStartTime,
    int BranchId = 0,
    string? OptionCode = null) : IntegrationEvent;
