using Chillax.EventBus.Events;
using Chillax.Notification.API.Model;

namespace Chillax.Notification.API.IntegrationEvents.Events;

/// <summary>
/// Integration event received when a customer joins an active session
/// Used to send session notification to the joining member
/// </summary>
public record SessionMemberJoinedIntegrationEvent(
    int ReservationId,
    int RoomId,
    LocalizedText RoomName,
    string MemberUserId,
    DateTime? ActualStartTime,
    string? PlayerMode,
    int PlaceId = 0,
    string PlaceKind = "Room",
    LocalizedText? PlaceName = null,
    string? OptionCode = null) : IntegrationEvent;
