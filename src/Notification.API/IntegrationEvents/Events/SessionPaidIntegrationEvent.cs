using Ninja.Notification.API.Model;
using Ninja.EventBus.Events;

namespace Ninja.Notification.API.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the event Spaces publishes when a room bill was paid.
/// Carried to each member's own SignalR group so their session list
/// refetches; a pointer, never money.
/// </summary>
public record SessionPaidIntegrationEvent(
    int ReservationId,
    // LEGACY(places): old RoomId Spaces still fills beside PlaceId/PlaceKind/PlaceName — remove when every till and customer app is on /api/places and /api/stays.
    int RoomId,
    IReadOnlyCollection<string> MemberIds,
    int ReceiptNumber,
    int BranchId,
    int PlaceId = 0,
    string PlaceKind = "Room",
    LocalizedText? PlaceName = null) : IntegrationEvent;
