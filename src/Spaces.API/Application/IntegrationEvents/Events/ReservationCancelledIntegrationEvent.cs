using Chillax.EventBus.Events;
using Chillax.Spaces.Domain.SeedWork;

namespace Chillax.Spaces.API.Application.IntegrationEvents.Events;

/// <summary>
/// Integration event published when a customer cancels their reservation
/// Used to notify admin/staff about cancellations
/// </summary>
public record ReservationCancelledIntegrationEvent(
    int ReservationId,
    int RoomId,
    LocalizedText RoomName,
    string? CustomerId,
    string? CustomerName,
    int BranchId = 1) : IntegrationEvent;
