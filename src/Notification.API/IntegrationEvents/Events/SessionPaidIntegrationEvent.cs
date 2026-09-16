using Chillax.Notification.API.Model;
using Chillax.EventBus.Events;

namespace Chillax.Notification.API.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the event Spaces publishes when a room bill was paid.
/// Carried to each member's own SignalR group so their session list
/// refetches; a pointer, never money.
/// </summary>
public record SessionPaidIntegrationEvent(
    int ReservationId,
    int RoomId,
    IReadOnlyCollection<string> MemberIds,
    int ReceiptNumber,
    int BranchId,
    int PlaceId = 0,
    string PlaceKind = "Room",
    LocalizedText? PlaceName = null) : IntegrationEvent;
