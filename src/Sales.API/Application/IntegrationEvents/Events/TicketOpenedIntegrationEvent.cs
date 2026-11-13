using Ninja.EventBus.Events;

namespace Ninja.Sales.API.Application.IntegrationEvents.Events;

/// <summary>
/// A bill was opened at a place (a table or a room): the bill is that place's until it is settled or
/// voided. Ordering keeps it, so an order rung up onto the bill goes to the kitchen with the place's
/// name whichever till sent it, and without the till having to say where the bill is. A counter bill
/// has no place and is not announced. Sent again for the bills already open when Sales starts, so a
/// consumer that had not heard of one learns of it; applying it twice changes nothing.
/// </summary>
public record TicketOpenedIntegrationEvent(
    int TicketId,
    int BranchId,
    int PlaceId,
    // "Room" or "Table"
    string? PlaceKind,
    LocalizedText? PlaceName) : IntegrationEvent;
