#nullable enable
namespace Ninja.Ordering.API.Application.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the event Sales publishes when a bill is opened at a table or a room (and again,
/// at its start, for the bills already open). Same type name and properties as the source — the
/// routing key is the type name.
/// </summary>
public record TicketOpenedIntegrationEvent(
    int TicketId,
    int BranchId,
    int PlaceId,
    string? PlaceKind,
    LocalizedText? PlaceName) : IntegrationEvent;
