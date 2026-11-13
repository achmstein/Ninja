#nullable enable
namespace Ninja.Ordering.API.Application.IntegrationEvents.EventHandling;

/// <summary>
/// An empty bill was thrown away: which place it was the bill of is let go, as it is when a bill is
/// settled or voided. The place's next bill is a new bill with a number of its own.
/// </summary>
public class TicketDiscardedIntegrationEventHandler(ITicketPlaces ticketPlaces)
    : IIntegrationEventHandler<TicketDiscardedIntegrationEvent>
{
    public Task Handle(TicketDiscardedIntegrationEvent @event) => ticketPlaces.ForgetAsync(@event.TicketId);
}
