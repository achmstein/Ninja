using Chillax.EventBus.Events;
using Chillax.Spaces.Domain.SeedWork;

namespace Chillax.Spaces.API.Application.IntegrationEvents.Events;

/// <summary>
/// Integration event published when admin ends a session
/// Used to dismiss session notifications on customer devices
/// </summary>
public record SessionEndedIntegrationEvent(
    int ReservationId,
    int RoomId,
    LocalizedText RoomName,
    List<string> MemberUserIds) : IntegrationEvent;
