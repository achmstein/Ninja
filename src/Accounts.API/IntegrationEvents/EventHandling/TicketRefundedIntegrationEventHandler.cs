using Chillax.Accounts.API.Application.Commands;
using Chillax.Accounts.Domain.AggregatesModel.CustomerAccountAggregate;
using Chillax.Accounts.API.IntegrationEvents.Events;
using Chillax.EventBus.Abstractions;
using MediatR;

namespace Chillax.Accounts.API.IntegrationEvents.EventHandling;

/// <summary>
/// A refund that went back onto a tab is a payment on it: the balance owed
/// drops by the credit note's amount. Cash refunds never reach here — the
/// drawer handled them. Idempotent via a reference per credit note, because
/// the bus redelivers and a tab must never be credited twice.
/// </summary>
public class TicketRefundedIntegrationEventHandler(
    IMediator mediator,
    ILogger<TicketRefundedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<TicketRefundedIntegrationEvent>
{
    public async Task Handle(TicketRefundedIntegrationEvent @event)
    {
        if (!string.Equals(@event.Tender, "Account", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        if (string.IsNullOrEmpty(@event.CustomerId))
        {
            // Sales refuses an account refund that names no tab, so this is a
            // malformed event, not a normal case — say so loudly
            logger.LogError(
                "Credit note #{Number} for ticket {TicketId} credits {Amount} on account but names no customer - NOT posted",
                @event.Number, @event.TicketId, @event.Amount);
            return;
        }

        await mediator.Send(new RecordPaymentCommand(
            @event.CustomerId,
            @event.Amount,
            description: null,
            @event.RefundedBy,
            reference: $"sales-refund:{@event.RefundId}",
            source: TransactionSource.PosCreditNote,
            sourceNumber: @event.Number));

        logger.LogInformation(
            "Credited {Amount} to {CustomerId}'s account for credit note #{Number} on ticket {TicketId}",
            @event.Amount, @event.CustomerId, @event.Number, @event.TicketId);
    }
}
