#nullable enable
namespace Ninja.Ordering.API.Application.IntegrationEvents.EventHandling;

/// <summary>
/// A bill was opened at a place: Ordering keeps which, so what is rung up onto the bill goes to the
/// kitchen under that place's name. Orders the bill already holds without a place are given it.
/// Hearing of the same bill twice changes nothing.
/// </summary>
public class TicketOpenedIntegrationEventHandler(
    ITicketPlaces ticketPlaces,
    ILogger<TicketOpenedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<TicketOpenedIntegrationEvent>
{
    public async Task Handle(TicketOpenedIntegrationEvent @event)
    {
        var placed = await ticketPlaces.LearnAsync(@event.TicketId, @event.BranchId, @event.PlaceId, @event.PlaceKind, @event.PlaceName);
        if (placed > 0)
        {
            logger.LogInformation("Ticket {TicketId} is at place {PlaceId}: {Count} order(s) already on it given their place", @event.TicketId, @event.PlaceId, placed);
        }
    }
}
