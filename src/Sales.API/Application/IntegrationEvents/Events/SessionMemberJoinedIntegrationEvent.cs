#nullable enable
using Ninja.EventBus.Events;

namespace Ninja.Sales.API.Application.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the event Spaces publishes when somebody joins a room
/// session by scanning its QR. Sales notes them on the session's ticket so
/// they may read the receipt later: the people who sat in the room are the
/// people the bill belongs to.
/// </summary>
public record SessionMemberJoinedIntegrationEvent(
    int ReservationId,
    // LEGACY(places): the old RoomId/RoomName, the same values as the place id and name — remove when every till and customer app is on /api/places and /api/stays.
    int RoomId,
    LocalizedText RoomName,
    string MemberUserId,
    DateTime? ActualStartTime = null,
    // LEGACY(places): the old "Single"/"Multi" word — remove when every till and customer app is on /api/places and /api/stays.
    string? PlayerMode = null) : IntegrationEvent;
