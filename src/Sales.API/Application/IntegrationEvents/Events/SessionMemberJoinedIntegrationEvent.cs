#nullable enable
using Chillax.EventBus.Events;

namespace Chillax.Sales.API.Application.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the event Spaces publishes when somebody joins a room
/// session by scanning its QR. Sales notes them on the session's ticket so
/// they may read the receipt later: the people who sat in the room are the
/// people the bill belongs to.
/// </summary>
public record SessionMemberJoinedIntegrationEvent(
    int ReservationId,
    int RoomId,
    LocalizedText RoomName,
    string MemberUserId,
    DateTime? ActualStartTime = null,
    string? PlayerMode = null) : IntegrationEvent;
