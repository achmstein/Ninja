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
    int PlaceId,
    string PlaceKind,
    LocalizedText PlaceName,
    IReadOnlyCollection<string> MemberIds,
    int ReceiptNumber,
    int BranchId) : IntegrationEvent;
