using Ninja.EventBus.Abstractions;
using Ninja.Spaces.API.Application.IntegrationEvents.Events;
using Ninja.Spaces.Domain.AggregatesModel.StayAggregate;
using Ninja.Spaces.Domain.Exceptions;

namespace Ninja.Spaces.API.Application.IntegrationEvents.EventHandling;

/// <summary>
/// The till moved a customer's bill onto a room's: the customer is in the
/// room now. An unclaimed room takes the first of them as its owner, the
/// rest join the party, exactly as the till's own "add to room" does.
/// Idempotent: someone already in the party is left as they are.
/// </summary>
public class TicketCustomersMovedToSessionIntegrationEventHandler(
    IStayRepository stays,
    ILogger<TicketCustomersMovedToSessionIntegrationEventHandler> logger)
    : IIntegrationEventHandler<TicketCustomersMovedToSessionIntegrationEvent>
{
    public async Task Handle(TicketCustomersMovedToSessionIntegrationEvent @event)
    {
        var stay = await stays.GetWithMembersAsync(@event.SessionId);
        if (stay is null)
        {
            logger.LogWarning("Ticket {TicketId} took customers for stay {StayId}, which Spaces does not know", @event.TicketId, @event.SessionId);
            return;
        }

        var added = 0;
        foreach (var customer in @event.Customers ?? [])
        {
            if (string.IsNullOrWhiteSpace(customer.CustomerId) || stay.HasMember(customer.CustomerId))
                continue;
            try
            {
                stay.AddMember(customer.CustomerId, customer.CustomerName);
                added++;
            }
            catch (SpacesDomainException ex)
            {
                // A stay already settled or cancelled: the bill moved, the room's roster is closed
                logger.LogInformation("Customer {CustomerId} not added to stay {StayId}: {Reason}", customer.CustomerId, stay.Id, ex.Message);
            }
        }
        if (added == 0) return;

        stays.Update(stay);
        await stays.UnitOfWork.SaveEntitiesAsync();
        logger.LogInformation("Stay {StayId} took {Count} customer(s) moved onto its bill (ticket {TicketId})", stay.Id, added, @event.TicketId);
    }
}
