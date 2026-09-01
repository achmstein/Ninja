using Chillax.EventBus.Events;
using Chillax.Spaces.Domain.SeedWork;

namespace Chillax.Spaces.API.Application.IntegrationEvents.Events;

/// <summary>
/// Integration event published when a customer reserves a room
/// Used to notify admin/staff about new reservations
/// </summary>
public record RoomReservedIntegrationEvent(
    int ReservationId,
    int RoomId,
    LocalizedText RoomName,
    string? CustomerId,
    string? CustomerName,
    DateTime? ExpiresAt,
    int BranchId = 1) : IntegrationEvent;
