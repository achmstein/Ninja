using Chillax.EventBus.Events;

namespace Chillax.Sales.API.Application.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the event Spaces publishes when a session starts (services
/// share no contracts assembly — each declares the fields it reads).
/// Sales opens the session's ticket off it.
/// </summary>
public record SessionStartedIntegrationEvent(
    int ReservationId,
    int RoomId,
    LocalizedText RoomName,
    DateTime? ActualStartTime,
    string? PlayerMode,
    int BranchId = 0,
    string? CustomerId = null) : IntegrationEvent;
