#nullable enable
using Chillax.EventBus.Abstractions;
using Chillax.Sales.API.Application.IntegrationEvents.Events;

namespace Chillax.Sales.API.Application.IntegrationEvents.EventHandling;

/// <summary>
/// The till forgot the customer and Ordering was told afterwards: the order's
/// lines, wherever they landed, take the new snapshot so the bill groups and
/// settles under the right person. A settled or voided ticket keeps its
/// receipt as printed; its lines only learn the account behind an order that
/// had none (a guest who signed in), so the bill shows in their history.
/// Idempotent by nature: the same snapshot applied twice changes nothing.
/// </summary>
public class OrderCustomerAssignedIntegrationEventHandler(
    ITicketRepository ticketRepository,
    SalesTransaction transaction,
    ILogger<OrderCustomerAssignedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<OrderCustomerAssignedIntegrationEvent>
{
    // One transaction per event, its floor nudge published after the commit
    public Task Handle(OrderCustomerAssignedIntegrationEvent @event)
        => transaction.RunAsync(nameof(OrderCustomerAssignedIntegrationEvent), () => Retag(@event));

    private async Task Retag(OrderCustomerAssignedIntegrationEvent @event)
    {
        // Across every ticket, like the confirmation dedupe: the order's lines
        // may have been moved onto another bill since they landed
        var tickets = await ticketRepository.FindByOrderAsync(@event.OrderId);

        if (tickets.Count == 0)
        {
            // Assigned before the confirmation reached Sales — that event
            // carries the customer itself, so nothing is lost
            logger.LogWarning("Order {OrderId} is not on any ticket - nothing to re-tag", @event.OrderId);
            return;
        }

        // The account behind the name, when there is one — the same reading
        // the confirmed handler gives a fresh order
        var customerId = string.IsNullOrEmpty(@event.BuyerIdentityGuid)
            ? null
            : @event.BuyerIdentityGuid;

        foreach (var ticket in tickets)
        {
            if (ticket.Status != TicketStatus.Open)
            {
                if (customerId is not null && ticket.AttachOrderCustomer(@event.OrderId, customerId))
                {
                    logger.LogInformation(
                        "Ticket {TicketId} is {Status} - order {OrderId}'s lines now belong to {Customer}'s account, names as printed",
                        ticket.Id, ticket.Status, @event.OrderId, @event.CustomerName);
                }
                continue;
            }

            ticket.AssignOrderCustomer(@event.OrderId, customerId, @event.CustomerName);

            logger.LogInformation(
                "Order {OrderId} on ticket {TicketId} re-tagged for {Customer}",
                @event.OrderId, ticket.Id, @event.CustomerName);
        }

        await ticketRepository.UnitOfWork.SaveEntitiesAsync();
    }
}
