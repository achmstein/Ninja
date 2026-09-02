using Chillax.Accounts.API.Application.Commands;
using Chillax.Accounts.API.IntegrationEvents.Events;
using Chillax.EventBus.Abstractions;
using MediatR;

namespace Chillax.Accounts.API.IntegrationEvents.EventHandling;

/// <summary>
/// The plan's "at last": a ticket settled on the Account tender posts its
/// charge automatically — the first thing that ever writes to a customer's
/// tab without a human keying it in. A shared bill can charge several tabs at
/// once, so each account holder gets their own charge. Idempotent via a
/// reference per ticket *and* customer, because the bus redelivers and a tab
/// must never pay a ticket twice.
/// </summary>
public class TicketSettledIntegrationEventHandler(
    IMediator mediator,
    ILogger<TicketSettledIntegrationEventHandler> logger)
    : IIntegrationEventHandler<TicketSettledIntegrationEvent>
{
    public async Task Handle(TicketSettledIntegrationEvent @event)
    {
        var charges = @event.AccountCharges ?? [];

        if (charges.Count == 0)
        {
            return;
        }

        foreach (var charge in charges)
        {
            if (string.IsNullOrEmpty(charge.CustomerId))
            {
                // Sales refuses an account payment that names no tab, so this
                // is a malformed event, not a normal case — say so loudly
                logger.LogError(
                    "Ticket {TicketId} settled {Amount} on account but names no customer - charge NOT posted",
                    @event.TicketId, charge.Amount);
                continue;
            }

            await mediator.Send(new AddChargeCommand(
                charge.CustomerId,
                charge.CustomerName,
                charge.Amount,
                $"POS receipt #{@event.ReceiptNumber}",
                @event.SettledBy ?? "pos",
                // Per customer as well as per ticket: two people's shares of
                // one bill are two charges, and each must dedupe on its own
                reference: $"sales-ticket:{@event.TicketId}:{charge.CustomerId}"));

            logger.LogInformation(
                "Posted {Amount} to {CustomerId}'s account for ticket {TicketId} (receipt #{Receipt})",
                charge.Amount, charge.CustomerId, @event.TicketId, @event.ReceiptNumber);
        }
    }
}
