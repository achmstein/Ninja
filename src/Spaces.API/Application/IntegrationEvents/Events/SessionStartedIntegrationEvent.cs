using Chillax.EventBus.Events;
using Chillax.Spaces.Domain.SeedWork;

namespace Chillax.Spaces.API.Application.IntegrationEvents.Events;

/// <summary>
/// Integration event published when admin starts a session (customer begins playing)
/// Used to notify connected clients about room status change
/// </summary>
public record SessionStartedIntegrationEvent(
    int ReservationId,
    int RoomId,
    LocalizedText RoomName,
    string? CustomerId,
    string? CustomerName,
    DateTime? ActualStartTime,
    string? PlayerMode,
    int BranchId = 0) : IntegrationEvent;
