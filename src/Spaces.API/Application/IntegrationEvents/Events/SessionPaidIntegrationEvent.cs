using Chillax.EventBus.Events;

namespace Chillax.Spaces.API.Application.IntegrationEvents.Events;

/// <summary>
/// The room bill a session's time was on was paid. Carries the people who
/// sat in the room, so Notification can nudge each one's screens to refetch
/// their sessions. No money travels; the session itself says what changed.
/// </summary>
public record SessionPaidIntegrationEvent(
    int ReservationId,
    int RoomId,
    IReadOnlyCollection<string> MemberIds,
    int ReceiptNumber,
    int BranchId) : IntegrationEvent;
