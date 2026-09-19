using Ninja.EventBus.Events;
using Ninja.Notification.API.Model;

namespace Ninja.Notification.API.IntegrationEvents.Events;

/// <summary>
/// Integration event received when a customer joins an active session
/// Used to send session notification to the joining member
/// </summary>
public record SessionMemberJoinedIntegrationEvent(
    int ReservationId,
    int PlaceId,
    string PlaceKind,
    LocalizedText PlaceName,
    string MemberUserId,
    DateTime? ActualStartTime,
    string? OptionCode = null) : IntegrationEvent;
