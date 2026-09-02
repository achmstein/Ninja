using Chillax.Accounts.API.Application.Commands;
using Chillax.Accounts.API.IntegrationEvents.Events;
using Chillax.EventBus.Abstractions;
using MediatR;

namespace Chillax.Accounts.API.IntegrationEvents.EventHandling;

/// <summary>
/// The plan's "at last": a ticket settled on the Account tender posts its
/// charge automatically — the first thing that ever writes to a customer's
/// tab without a human keying it in. Idempotent via the per-ticket reference,
/// because the bus redelivers and a tab must never pay a ticket twice.
/// </summary>
public class TicketSettledIntegrationEventHandler(
    IMediator mediator,
    ILogger<TicketSettledIntegrationEventHandler> logger)
    : IIntegrationEventHandler<TicketSettledIntegrationEvent>
{
    public async Task Handle(TicketSettledIntegrationEvent @event)
    {
        if (@event.AccountAmount <= 0)
        {
            return;
        }

        if (string.IsNullOrEmpty(@event.CustomerId))
        {
            // Sales refuses account tenders on customer-less tickets, so this
            // is a malformed event, not a normal case — say so loudly
            logger.LogError(
                "Ticket {TicketId} settled {Amount} on account but carries no customer - charge NOT posted",
                @event.TicketId, @event.AccountAmount);
            return;
        }

        await mediator.Send(new AddChargeCommand(
            @event.CustomerId,
            @event.CustomerName,
            @event.AccountAmount,
            $"POS receipt #{@event.ReceiptNumber}",
            @event.SettledBy ?? "pos",
            reference: $"sales-ticket:{@event.TicketId}"));

        logger.LogInformation(
            "Posted {Amount} to {CustomerId}'s account for ticket {TicketId} (receipt #{Receipt})",
            @event.AccountAmount, @event.CustomerId, @event.TicketId, @event.ReceiptNumber);
    }
}
