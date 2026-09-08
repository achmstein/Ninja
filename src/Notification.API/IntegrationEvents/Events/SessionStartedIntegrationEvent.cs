using Chillax.EventBus.Events;
using Chillax.Notification.API.Model;

namespace Chillax.Notification.API.IntegrationEvents.Events;

/// <summary>
/// Integration event received when admin starts a session (customer begins playing)
/// </summary>
public record SessionStartedIntegrationEvent(
    int ReservationId,
    int RoomId,
    LocalizedText RoomName,
    string? CustomerId,
    DateTime? ActualStartTime,
    string? PlayerMode) : IntegrationEvent;
